#!/usr/bin/env node
// Slide HTML -> PNG with the brand's exact fonts, plus layout + retention checks and a contact sheet.
//
// Usage:
//   node render.mjs <carousel-dir> [--slide 03] [--brand <slug> | --brand-dir <path>] [--workspace <path>]
//   node render.mjs --file <slide.html> [--out <png>] [--role hook|body|cta] [--brand ... | --brand-dir ...]
//   node render.mjs --specimen [--brand <slug> | --brand-dir <path>]
//
// Exit codes: 0 = rendered, no errors; 1 = rendered, report has errors; 2 = fatal (fonts, missing files).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import {
  parseArgs, fail, readJSON, writeJSON, resolveWorkspace, resolveBrandDir, loadTokens,
} from './lib/workspace.mjs';

const args = parseArgs();

// ---------- injection ----------

const FONT_FORMATS = { ttf: ['font/ttf', 'truetype'], otf: ['font/otf', 'opentype'], woff: ['font/woff', 'woff'], woff2: ['font/woff2', 'woff2'] };

function fontFaces(tokens, brandDir) {
  const faces = [];
  for (const [role, font] of Object.entries(tokens.fonts || {})) {
    for (const file of font.files || []) {
      const abs = path.resolve(brandDir, file.path);
      if (!fs.existsSync(abs)) fail(`font file missing for "${font.family}" (${role}): ${abs}`, 2);
      const ext = path.extname(abs).slice(1).toLowerCase();
      const fmt = FONT_FORMATS[ext];
      if (!fmt) fail(`unsupported font format .${ext}: ${abs}`, 2);
      faces.push({
        role, family: font.family, weight: String(file.weight ?? 400), style: file.style || 'normal',
        file: file.path, data: fs.readFileSync(abs).toString('base64'), mime: fmt[0], format: fmt[1],
      });
    }
  }
  if (!faces.length) fail('tokens.json declares no font files', 2);
  return faces;
}

function fontFaceCSS(faces) {
  return faces.map(f => `@font-face{font-family:"${f.family}";src:url(data:${f.mime};base64,${f.data}) format("${f.format}");font-weight:${f.weight};font-style:${f.style};font-display:block}`).join('\n');
}

const px = v => (typeof v === 'number' ? `${v}px` : v);
const kebab = s => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function tokenCSS(tokens) {
  const vars = [];
  for (const [name, c] of Object.entries(tokens.colors || {})) vars.push(`--brand-${kebab(name)}:${typeof c === 'string' ? c : c.value}`);
  for (const [role, f] of Object.entries(tokens.fonts || {})) vars.push(`--brand-font-${kebab(role)}:"${f.family}"`);
  for (const [lvl, v] of Object.entries(tokens.typeScale || {})) vars.push(`--brand-size-${kebab(lvl)}:${px(v)}`);
  for (const [k, v] of Object.entries(tokens.spacing || {})) vars.push(`--brand-space-${kebab(k)}:${px(v)}`);
  vars.push(`--brand-safe:${px(tokens.spacing.safeArea)}`);
  const { width: W, height: H } = tokens.canvas;
  return `:root{${vars.join(';')}}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden}
body{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}`;
}

function dataURI(abs) {
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
}

function logoURIs(tokens, brandDir) {
  const out = {};
  for (const [key, ph] of [['primary', '{{LOGO}}'], ['alt', '{{LOGO_ALT}}']]) {
    const p = tokens.logo?.[key] ?? (key === 'alt' ? tokens.logo?.primary : undefined);
    if (!p) continue;
    const abs = path.resolve(brandDir, p);
    if (!fs.existsSync(abs)) fail(`logo file missing: ${abs}`, 2);
    out[ph] = dataURI(abs);
  }
  return out;
}

function inject(html, ctx) {
  const injected = `<style data-injected>\n${ctx.fontCSS}\n${ctx.tokenCSS}\n</style>`;
  let out = html.replace('{{FONT_FACES}}', '').replace('{{TOKENS}}', '');
  for (const [ph, uri] of Object.entries(ctx.logos)) out = out.split(ph).join(uri);
  if (/\{\{LOGO(_ALT)?\}\}/.test(out)) fail('slide uses a logo placeholder but tokens.json has no logo path', 2);
  return /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, m => `${m}\n${injected}`) : `${injected}\n${out}`;
}

// Static source checks on what Claude wrote (before injection).
function sourceChecks(html, tokens) {
  const errors = [], warnings = [];
  if (/(src|href)\s*=\s*["']\s*(https?:)?\/\//i.test(html) || /url\(\s*["']?\s*(https?:)?\/\//i.test(html)) {
    errors.push({ check: 'external-url', msg: 'slide references an external URL; use local relative paths only' });
  }
  const allowed = new Set(Object.values(tokens.colors || {}).map(c => (typeof c === 'string' ? c : c.value).toLowerCase()));
  const hexes = [...new Set((html.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map(h => h.toLowerCase()))].filter(h => !allowed.has(h));
  if (hexes.length) warnings.push({ check: 'raw-hex', msg: `raw colours outside the token set: ${hexes.join(', ')} - use var(--brand-...)` });
  return { errors, warnings };
}

// ---------- in-page measurement (runs in the browser) ----------

function measureInPage({ W, H, safe, minFont, faces }) {
  const els = [...document.querySelectorAll('[data-text]')];
  const declared = new Set(faces.map(f => `${f.family.toLowerCase()}|${f.style}|${f.weight}`));
  const families = new Set(faces.map(f => f.family.toLowerCase()));
  const weightOk = (fam, style, weight) => [...declared].some(k => {
    const [f, s, w] = k.split('|');
    if (f !== fam || s !== style) return false;
    const [lo, hi = lo] = w.split(/\s+/).map(Number);
    return weight >= lo && weight <= hi;
  });
  const firstFamily = ff => ff.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
  const textRect = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  const ownText = el => {
    const c = el.cloneNode(true);
    c.querySelectorAll('[data-text]').forEach(n => n.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  };
  const opacity = el => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
  const label = (el, text) => `${el.dataset.text} "${text.split(' ').slice(0, 6).join(' ')}${text.split(' ').length > 6 ? '…' : ''}"`;

  const items = [], issues = [];
  els.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const text = ownText(el);
    const rect = textRect(el);
    const id = label(el, text);
    const fontSize = parseFloat(cs.fontSize);
    const words = text ? text.split(' ').filter(w => /[\p{L}\p{N}]/u.test(w)).length : 0;
    const emph = [...el.querySelectorAll('em,strong,b,i,u')].filter(n => n.closest('[data-text]') === el);
    const lh = cs.lineHeight === 'normal' ? fontSize * 1.2 : parseFloat(cs.lineHeight);
    const lines = rect.height ? Math.round(rect.height / lh) : 0;

    // Tight leading lets glyph ink overshoot the line box slightly; real overflow is a line or more.
    const overY = el.scrollHeight - el.clientHeight, overX = el.scrollWidth - el.clientWidth;
    if (el.clientHeight > 0 && (overY > fontSize * 0.3 || overX > 2)) {
      issues.push({ level: 'error', check: 'overflow', el: id, msg: `text overflows its box by ${Math.max(overY, overX)}px` });
    }
    if (rect.width && (rect.left < 0 || rect.top < 0 || rect.right > W || rect.bottom > H)) {
      issues.push({ level: 'error', check: 'clipped', el: id, msg: 'text runs off the slide edge' });
    } else if (rect.width && el.dataset.text !== 'meta' && (rect.left < safe - 0.5 || rect.top < safe - 0.5 || rect.right > W - safe + 0.5 || rect.bottom > H - safe + 0.5)) {
      issues.push({ level: 'error', check: 'safe-area', el: id, msg: `text outside the ${safe}px safe area (box ${Math.round(rect.left)},${Math.round(rect.top)} → ${Math.round(rect.right)},${Math.round(rect.bottom)})` });
    }
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (/(hidden|clip|scroll|auto)/.test(acs.overflow + acs.overflowX + acs.overflowY)) {
        const ar = a.getBoundingClientRect();
        if (rect.left < ar.left - 1 || rect.top < ar.top - 1 || rect.right > ar.right + 1 || rect.bottom > ar.bottom + 1) {
          issues.push({ level: 'error', check: 'clipped', el: id, msg: 'text is clipped by a parent with overflow:hidden' });
          break;
        }
      }
    }
    const min = el.dataset.text === 'meta' ? minFont.meta : minFont.default;
    if (fontSize < min) issues.push({ level: 'error', check: 'min-size', el: id, msg: `font-size ${fontSize}px < minimum ${min}px` });

    // Fonts actually requested by the element and its emphasis spans must be brand fonts in declared weights.
    for (const n of [el, ...emph]) {
      const ncs = getComputedStyle(n);
      const fam = firstFamily(ncs.fontFamily);
      if (!families.has(fam)) issues.push({ level: 'error', check: 'font', el: id, msg: `uses non-brand font "${fam}"` });
      else if (!weightOk(fam, ncs.fontStyle === 'normal' ? 'normal' : 'italic', Number(ncs.fontWeight))) {
        issues.push({ level: 'warning', check: 'font', el: id, msg: `"${fam}" ${ncs.fontWeight} ${ncs.fontStyle} is not a declared font file - browser will synthesize it` });
      }
    }

    // Colour runs for the contrast check: the element itself plus emphasis spans in a different colour.
    const runs = [{ rect: rect.toJSON(), color: cs.color, alpha: opacity(el) }];
    for (const n of emph) {
      const ncs = getComputedStyle(n);
      if (ncs.color !== cs.color) {
        const r = document.createRange(); r.selectNodeContents(n);
        runs.push({ rect: r.getBoundingClientRect().toJSON(), color: ncs.color, alpha: opacity(n) });
      }
    }
    items.push({ i, level: el.dataset.text, id, text, words, fontSize, emphasis: emph.length, lines, runs });
  });

  const root = document.querySelector('[data-slide]');
  const images = [...document.querySelectorAll('img')];
  return {
    items, issues,
    hasRoot: !!root,
    swipeCue: !!document.querySelector('[data-cue="swipe"]'),
    visuals: images.filter(img => !img.hasAttribute('data-logo')).length + document.querySelectorAll('[data-visual]').length,
    brokenImages: images.filter(img => !img.naturalWidth).map(img => img.getAttribute('src')?.slice(0, 80)),
    scroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
  };
}

// ---------- retention checks (node side) ----------

function retentionChecks(m, role, R) {
  const errors = [], warnings = [];
  const isHook = role === 'hook';
  const by = lvl => m.items.filter(it => it.level === lvl);
  const words = {};
  for (const it of m.items) words[it.level] = (words[it.level] || 0) + it.words;
  const total = m.items.filter(it => it.level !== 'meta').reduce((s, it) => s + it.words, 0);

  const heads = by('headline');
  if (heads.length !== 1) errors.push({ check: 'headline', msg: `expected exactly 1 headline, found ${heads.length}` });
  const head = heads[0];
  if (head) {
    const max = Math.max(0, ...m.items.filter(it => it !== head).map(it => it.fontSize));
    if (max >= head.fontSize) errors.push({ check: 'hierarchy', el: head.id, msg: `headline (${head.fontSize}px) is not the largest text (another element is ${max}px)` });
    const budget = isHook ? R.headlineWords.hook : R.headlineWords.other;
    if (head.words > budget) errors.push({ check: 'budget', el: head.id, msg: `headline has ${head.words} words (max ${budget})` });
  }
  const budgets = { key: R.keyWords, support: R.supportWords, item: R.itemWords, clarifier: R.clarifierWords };
  for (const [lvl, max] of Object.entries(budgets)) {
    for (const it of by(lvl)) if (it.words > max) errors.push({ check: 'budget', el: it.id, msg: `${lvl} has ${it.words} words (max ${max})` });
  }
  if (by('key').length > 1) warnings.push({ check: 'hierarchy', msg: `${by('key').length} key lines - one slide, one point` });
  for (const it of by('support')) if (it.lines > R.supportMaxLines) warnings.push({ check: 'budget', el: it.id, msg: `support runs ${it.lines} lines (aim for ≤ ${R.supportMaxLines})` });
  if (by('item').length > R.maxItems) errors.push({ check: 'budget', msg: `${by('item').length} list items (max ${R.maxItems})` });
  const slideMax = isHook ? R.slideWords.hook : R.slideWords.other;
  if (total > slideMax) errors.push({ check: 'budget', msg: `slide has ${total} words (max ${slideMax}${isHook ? ' on the hook' : ''})` });
  for (const it of m.items) if (it.emphasis > R.maxEmphasisPerElement) errors.push({ check: 'emphasis', el: it.id, msg: `${it.emphasis} emphasis spans (max ${R.maxEmphasisPerElement}) - if everything is emphasised, nothing is` });
  if (isHook && !m.swipeCue) errors.push({ check: 'swipe-cue', msg: 'hook slide has no [data-cue="swipe"] element' });
  if (m.visuals > 1) warnings.push({ check: 'overload', msg: `${m.visuals} images/visuals on one slide (aim for 1)` });
  return { errors, warnings, metrics: { words, total, budget: slideMax } };
}

// ---------- contrast (sample the background behind each text run) ----------

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [hi, lo] = a > b ? [a, b] : [b, a]; return (hi + 0.05) / (lo + 0.05); };
const parseRGB = s => { const n = s.match(/[\d.]+/g).map(Number); return { rgb: n.slice(0, 3), a: n[3] ?? 1 }; };
export function hexToRGB(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
export const contrastHex = (a, b) => ratio(lum(hexToRGB(a)), lum(hexToRGB(b)));

async function contrastChecks(bgPng, m, W, H, minContrast) {
  const { data, info } = await sharp(bgPng).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const errors = [];
  for (const it of m.items) {
    let worst = Infinity;
    for (const run of it.runs) {
      const x0 = Math.max(0, Math.floor(run.rect.left)), y0 = Math.max(0, Math.floor(run.rect.top));
      const x1 = Math.min(W, Math.ceil(run.rect.right)), y1 = Math.min(H, Math.ceil(run.rect.bottom));
      if (x1 <= x0 || y1 <= y0) continue;
      const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000)));
      const { rgb, a } = parseRGB(run.color);
      const alpha = a * run.alpha;
      const ratios = [];
      for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
        const o = (y * info.width + x) * info.channels;
        const bg = [data[o], data[o + 1], data[o + 2]];
        const fg = rgb.map((c, k) => c * alpha + bg[k] * (1 - alpha));
        ratios.push(ratio(lum(fg), lum(bg)));
      }
      ratios.sort((p, q) => p - q);
      // 20th percentile: tolerant of a few bright pixels, strict about busy backgrounds.
      worst = Math.min(worst, ratios[Math.floor(ratios.length * 0.2)]);
    }
    if (worst < minContrast) errors.push({ check: 'contrast', el: it.id, msg: `contrast ${worst.toFixed(2)}:1 against its background (min ${minContrast}:1) - add a scrim/panel or change colour` });
  }
  return errors;
}

// ---------- page rendering ----------

async function openBrowser(W, H) {
  const browser = await chromium.launch().catch(e => fail(`could not launch Chromium - run scripts/setup.mjs first.\n${e.message}`, 2));
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  return { browser, page };
}

async function loadAndVerify(page, file, faces) {
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  const result = await page.evaluate(async faceList => {
    const out = [];
    for (const f of faceList) {
      const w = f.weight.split(/\s+/)[0];
      try {
        const loaded = await document.fonts.load(`${f.style} ${w} 40px "${f.family}"`);
        out.push({ ...f, ok: loaded.some(ff => ff.status === 'loaded') });
      } catch (e) { out.push({ ...f, ok: false, err: e.message }); }
    }
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => (img.complete ? 0 : new Promise(r => { img.onload = img.onerror = r; }))));
    const errored = [...document.fonts].filter(ff => ff.status === 'error').map(ff => `${ff.family} ${ff.weight} ${ff.style}`);
    return { faces: out, errored };
  }, faces.map(({ family, weight, style, file: f }) => ({ family, weight, style, file: f })));
  const bad = result.faces.filter(f => !f.ok);
  if (bad.length || result.errored.length) {
    const list = [...bad.map(f => `"${f.family}" ${f.weight} ${f.style} (${f.file})`), ...result.errored].join('\n  ');
    throw new FontError(`brand font failed to load - output would use a fallback font:\n  ${list}`);
  }
}
class FontError extends Error {}

async function renderSlide(page, srcFile, outPng, role, ctx) {
  const html = fs.readFileSync(srcFile, 'utf8');
  const src = sourceChecks(html, ctx.tokens);
  const tmp = path.join(path.dirname(srcFile), `.render-${path.basename(srcFile)}`);
  fs.writeFileSync(tmp, inject(html, ctx));
  try {
    await loadAndVerify(page, tmp, ctx.faces);
    const { width: W, height: H } = ctx.tokens.canvas;
    fs.mkdirSync(path.dirname(outPng), { recursive: true });
    await page.screenshot({ path: outPng, clip: { x: 0, y: 0, width: W, height: H } });
    const m = await page.evaluate(measureInPage, {
      W, H, safe: ctx.tokens.spacing.safeArea, minFont: ctx.tokens.minFontSize,
      faces: ctx.faces.map(({ family, weight, style }) => ({ family, weight, style })),
    });
    // Background-only screenshot for contrast sampling.
    const hide = await page.addStyleTag({ content: '[data-text],[data-text] *{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;text-decoration-color:transparent!important}' });
    const bgPng = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
    await hide.evaluate(n => n.remove());

    const errors = [...src.errors], warnings = [...src.warnings];
    for (const is of m.issues) (is.level === 'error' ? errors : warnings).push({ check: is.check, el: is.el, msg: is.msg });
    if (!m.hasRoot) errors.push({ check: 'markup', msg: 'no element with [data-slide]' });
    if (!m.items.length) errors.push({ check: 'markup', msg: 'no [data-text] elements - tag every text element with its hierarchy level' });
    for (const s of m.brokenImages) errors.push({ check: 'image', msg: `image failed to load: ${s}` });
    if (m.scroll.w > W || m.scroll.h > H) warnings.push({ check: 'canvas', msg: `page content is ${m.scroll.w}×${m.scroll.h}, larger than the ${W}×${H} canvas` });
    const ret = retentionChecks(m, role, ctx.tokens.retention);
    errors.push(...ret.errors, ...await contrastChecks(bgPng, m, W, H, ctx.tokens.retention.minContrast));
    warnings.push(...ret.warnings);
    return { slide: path.basename(srcFile, '.html'), role, png: outPng, errors, warnings, metrics: ret.metrics };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

async function contactSheet(pngs, out) {
  const w = 270, h = 338, gap = 16;
  const tiles = await Promise.all(pngs.map(p => sharp(p).resize(w, h).toBuffer()));
  await sharp({ create: { width: gap + tiles.length * (w + gap), height: h + gap * 2, channels: 3, background: '#111111' } })
    .composite(tiles.map((input, i) => ({ input, left: gap + i * (w + gap), top: gap })))
    .png().toFile(out);
}

function printReport(slides, extra = '') {
  let errs = 0, warns = 0;
  for (const s of slides) {
    errs += s.errors.length; warns += s.warnings.length;
    const status = s.errors.length ? `FAIL (${s.errors.length} errors, ${s.warnings.length} warnings)` : s.warnings.length ? `ok (${s.warnings.length} warnings)` : 'ok';
    const words = s.metrics ? `  ${s.metrics.total}/${s.metrics.budget} words` : '';
    console.log(`${s.slide.padEnd(4)} ${s.role.padEnd(5)} ${status}${words}`);
    for (const e of s.errors) console.log(`     ERROR ${e.check}: ${e.el ? `${e.el} - ` : ''}${e.msg}`);
    for (const w of s.warnings) console.log(`     warn  ${w.check}: ${w.el ? `${w.el} - ` : ''}${w.msg}`);
  }
  console.log(`\n${errs ? `${errs} error(s)` : 'No errors'}, ${warns} warning(s).${extra}`);
  return errs;
}

function context(brandDir) {
  const tokens = loadTokens(brandDir);
  const faces = fontFaces(tokens, brandDir);
  return { brandDir, tokens, faces, fontCSS: fontFaceCSS(faces), tokenCSS: tokenCSS(tokens), logos: logoURIs(tokens, brandDir) };
}

// Slide 01 is the hook; the last slide (05 by default) is the CTA.
const roleFor = (name, last = 5) => {
  const n = parseInt(name, 10);
  return n === 1 ? 'hook' : n === last ? 'cta' : 'body';
};

// ---------- modes ----------

async function renderCarousel(dir) {
  const slidesDir = path.join(dir, 'slides');
  if (!fs.existsSync(slidesDir)) fail(`no slides/ folder in ${dir}`, 2);
  const all = fs.readdirSync(slidesDir).filter(f => /^\d+\.html$/.test(f)).sort();
  if (!all.length) fail(`no NN.html slides in ${slidesDir}`, 2);
  const only = args.slide ? String(args.slide).padStart(2, '0') : null;
  const todo = only ? all.filter(f => f.startsWith(only)) : all;
  if (only && !todo.length) fail(`slide ${only} not found in ${slidesDir}`, 2);

  const ws = resolveWorkspace(args, dir);
  const ctx = context(resolveBrandDir(args, ws, dir));
  const { browser, page } = await openBrowser(ctx.tokens.canvas.width, ctx.tokens.canvas.height);
  const results = [];
  try {
    for (const f of todo) {
      const name = path.basename(f, '.html');
      results.push(await renderSlide(page, path.join(slidesDir, f), path.join(dir, 'png', `${name}.png`), roleFor(name, parseInt(all.at(-1), 10)), ctx));
    }
  } catch (e) {
    if (e instanceof FontError) fail(e.message, 2);
    throw e;
  } finally { await browser.close(); }

  const reportFile = path.join(dir, 'render-report.json');
  let slides = results;
  if (only) {
    const prev = readJSON(reportFile, { slides: [] }).slides.filter(s => !results.some(r => r.slide === s.slide));
    slides = [...prev, ...results].sort((a, b) => a.slide.localeCompare(b.slide));
  }
  const pngs = all.map(f => path.join(dir, 'png', f.replace('.html', '.png'))).filter(p => fs.existsSync(p));
  await contactSheet(pngs, path.join(dir, 'contact-sheet.png'));
  const strip = s => ({ ...s, png: path.relative(dir, s.png).replace(/\\/g, '/') });
  writeJSON(reportFile, {
    renderedAt: new Date().toISOString(), brand: path.basename(ctx.brandDir),
    summary: { errors: slides.reduce((n, s) => n + s.errors.length, 0), warnings: slides.reduce((n, s) => n + s.warnings.length, 0) },
    slides: slides.map(strip),
  });
  console.log(`Rendered ${results.length} slide(s) → ${path.join(dir, 'png')}\n`);
  const errs = printReport(only ? results : slides, `\nReport: ${reportFile}\nContact sheet: ${path.join(dir, 'contact-sheet.png')}`);
  process.exit(errs ? 1 : 0);
}

async function renderFile(file) {
  file = path.resolve(file);
  if (!fs.existsSync(file)) fail(`file not found: ${file}`, 2);
  const ws = resolveWorkspace(args);
  const ctx = context(resolveBrandDir(args, ws));
  const out = path.resolve(args.out || file.replace(/\.html?$/i, '.png'));
  const role = args.role || roleFor(path.basename(file));
  const { browser, page } = await openBrowser(ctx.tokens.canvas.width, ctx.tokens.canvas.height);
  let r;
  try { r = await renderSlide(page, file, out, role, ctx); }
  catch (e) { if (e instanceof FontError) fail(e.message, 2); throw e; }
  finally { await browser.close(); }
  writeJSON(out.replace(/\.png$/i, '.report.json'), { ...r, png: path.basename(out) });
  console.log(`Rendered → ${out}\n`);
  process.exit(printReport([r]) ? 1 : 0);
}

async function renderSpecimen() {
  const ws = resolveWorkspace(args);
  const brandDir = resolveBrandDir(args, ws);
  const ctx = context(brandDir);
  const colors = Object.entries(ctx.tokens.colors || {}).map(([name, c]) => ({ name, value: typeof c === 'string' ? c : c.value, role: c.role || '' }));
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const ink = colors.find(c => /text/.test(c.role))?.value || '#111111';
  const paper = colors.find(c => /background/.test(c.role))?.value || '#ffffff';
  const bodyFont = (ctx.tokens.fonts.body || Object.values(ctx.tokens.fonts)[0]).family;

  const fontRows = ctx.faces.map(f => `
    <div class="row"><div class="lab">${esc(f.role)} · ${esc(f.family)} ${esc(f.weight)} ${esc(f.style)}</div>
    <div style="font-family:'${f.family}';font-weight:${f.weight.split(' ')[0]};font-style:${f.style};font-size:72px;line-height:1.05">Retention is layout.</div>
    <div style="font-family:'${f.family}';font-weight:${f.weight.split(' ')[0]};font-style:${f.style};font-size:30px">The quick brown fox jumps over the lazy dog — 0123456789 &amp; ?!</div></div>`).join('');
  const swatches = colors.map(c => `<div class="sw"><div class="chip" style="background:${c.value}"></div><b>${esc(c.name)}</b><span>${esc(c.value)} · ${esc(c.role)}</span></div>`).join('');
  const pairs = [], lows = [];
  for (const fg of colors) for (const bg of colors) {
    if (fg === bg) continue;
    const r = contrastHex(fg.value, bg.value);
    pairs.push(`<div class="pair" style="background:${bg.value};color:${fg.value}"><b>Aa</b> ${esc(fg.name)} on ${esc(bg.name)}<span>${r.toFixed(2)}:1 ${r >= 4.5 ? '✓' : r >= 3 ? 'large only' : '✗'}</span></div>`);
    const isText = /text|accent/.test(fg.role) && !/never text/.test(fg.role);
    if (r < 4.5 && isText && /background|panel|surface/.test(bg.role)) lows.push(`${fg.name} on ${bg.name}: ${r.toFixed(2)}:1`);
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{height:auto!important;overflow:visible!important}
    body{background:${paper};color:${ink};font-family:'${bodyFont}';padding:72px}
    h1{font-size:28px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 32px}
    h2{font-size:22px;letter-spacing:.12em;text-transform:uppercase;margin:56px 0 20px;opacity:.7}
    .row{padding:20px 0;border-top:1px solid currentColor}
    .lab{font-size:18px;opacity:.6;margin-bottom:8px}
    .sws{display:flex;flex-wrap:wrap;gap:24px}.sw{width:170px;font-size:18px}.sw span{display:block;opacity:.7}
    .chip{height:110px;border:1px solid rgba(127,127,127,.4);margin-bottom:8px}
    .pairs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .pair{padding:18px;font-size:20px;border:1px solid rgba(127,127,127,.3)}.pair b{font-size:34px;margin-right:8px}.pair span{display:block;margin-top:6px}
  </style></head><body><h1>${esc(path.basename(brandDir))} · type specimen</h1>${fontRows}
  <h2>Colours</h2><div class="sws">${swatches}</div><h2>Text contrast</h2><div class="pairs">${pairs.join('')}</div></body></html>`;

  const tmp = path.join(brandDir, '.specimen.html');
  fs.writeFileSync(tmp, inject(html, ctx));
  const out = path.join(brandDir, 'specimen.png');
  const { browser, page } = await openBrowser(ctx.tokens.canvas.width, 800);
  try {
    await loadAndVerify(page, tmp, ctx.faces);
    await page.screenshot({ path: out, fullPage: true });
  } catch (e) { if (e instanceof FontError) fail(e.message, 2); throw e; }
  finally { await browser.close(); fs.rmSync(tmp, { force: true }); }
  console.log(`Specimen → ${out}`);
  console.log(`All ${ctx.faces.length} font file(s) loaded.`);
  if (lows.length) console.log(`Low-contrast text pairings (below 4.5:1):\n  ${lows.join('\n  ')}`);
}

if (args.specimen) await renderSpecimen();
else if (args.file) await renderFile(args.file);
else if (args._[0]) await renderCarousel(path.resolve(args._[0]));
else fail('usage: render.mjs <carousel-dir> [--slide NN] | --file <slide.html> | --specimen   (plus --brand <slug> | --brand-dir <path>)');
