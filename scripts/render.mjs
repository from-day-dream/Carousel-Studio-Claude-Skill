#!/usr/bin/env node
// Slide HTML -> PNG (+ a one-page PDF beside it) with the brand's exact fonts, plus layout + retention checks and a contact sheet.
//
// Usage:
//   node render.mjs <carousel-dir> [--slide 03] [--brand <slug> | --brand-dir <path>] [--workspace <path>]
//   node render.mjs --file <slide.html> [--out <png>] [--role hook|body|cta] [--brand ... | --brand-dir ...]
//   node render.mjs --specimen [--brand <slug> | --brand-dir <path>]
//
// Exit codes: 0 = rendered, no errors; 1 = rendered, report has errors; 2 = fatal (fonts, missing files).
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, fail, readJSON, writeJSON, resolveWorkspace, resolveBrandDir,
} from './lib/workspace.mjs';
import {
  inject, sourceChecks, measureInPage, retentionChecks, contrastChecks,
  openBrowser, loadAndVerify, FontError, contactSheet, printReport, context, renderSpecimen,
} from './lib/render-core.mjs';

const args = parseArgs();

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
    // Same slide as a one-page PDF next to the PNG (vector text, screen styles).
    const outPdf = outPng.replace(/\.png$/i, '.pdf');
    await page.emulateMedia({ media: 'screen' });
    await page.pdf({ path: outPdf, width: `${W}px`, height: `${H}px`, printBackground: true, pageRanges: '1', margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    const m =await page.evaluate(measureInPage, {
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
    return { slide: path.basename(srcFile, '.html'), role, png: outPng, pdf: outPdf, errors, warnings, metrics: ret.metrics };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// Carousels default to 5 slides (set by the skill) and may have up to MAX_SLIDES.
const MAX_SLIDES = 20;

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
  if (all.length > MAX_SLIDES) fail(`${all.length} slides in ${slidesDir}; the maximum is ${MAX_SLIDES}`, 2);
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
  const rel = p => p && path.relative(dir, p).replace(/\\/g, '/');
  const strip = s => ({ ...s, png: rel(s.png), pdf: rel(s.pdf) });
  writeJSON(reportFile, {
    renderedAt: new Date().toISOString(), brand: path.basename(ctx.brandDir),
    summary: { errors: slides.reduce((n, s) => n + s.errors.length, 0), warnings: slides.reduce((n, s) => n + s.warnings.length, 0) },
    slides: slides.map(strip),
  });
  console.log(`Rendered ${results.length} slide(s) → ${path.join(dir, 'png')} (PNG + PDF)\n`);
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
  writeJSON(out.replace(/\.png$/i, '.report.json'), { ...r, png: path.basename(out), pdf: path.basename(r.pdf) });
  console.log(`Rendered → ${out}\n`);
  process.exit(printReport([r]) ? 1 : 0);
}

if (args.specimen) await renderSpecimen(resolveBrandDir(args, resolveWorkspace(args)));
else if (args.file) await renderFile(args.file);
else if (args._[0]) await renderCarousel(path.resolve(args._[0]));
else fail('usage: render.mjs <carousel-dir> [--slide NN] | --file <slide.html> | --specimen   (plus --brand <slug> | --brand-dir <path>)');
