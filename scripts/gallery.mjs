#!/usr/bin/env node
// Rebuild <workspace>/index.json from output/*/ and refresh <workspace>/gallery.html.
//
//   node gallery.mjs [--workspace <path>]                 rebuild index + viewer
//   node gallery.mjs --serve [--port 4173] [--workspace]  rebuild, then serve the workspace on localhost
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { SKILL_DIR, parseArgs, fail, readJSON, writeJSON, resolveWorkspace } from './lib/workspace.mjs';

const args = parseArgs();
const ws = resolveWorkspace(args);
const outDir = path.join(ws, 'output');
if (!fs.existsSync(outDir)) fail(`no output folder in ${ws} - generate a carousel first`);

const rel = p => path.relative(ws, p).replace(/\\/g, '/');
const bust = p => `${rel(p)}?v=${Math.round(fs.statSync(p).mtimeMs)}`;
const readText = p => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '');

function entry(folder) {
  const dir = path.join(outDir, folder);
  const meta = readJSON(path.join(dir, 'meta.json'), {});
  const pngDir = path.join(dir, 'png');
  const pngs = fs.existsSync(pngDir) ? fs.readdirSync(pngDir).filter(f => /^\d+\.png$/.test(f)).sort() : [];
  if (!pngs.length) return null;
  const report = readJSON(path.join(dir, 'render-report.json'), null);
  const slides = pngs.map(f => {
    const n = parseInt(f, 10);
    const s = (meta.slides || []).find(x => Number(x.n) === n) || {};
    const side = readJSON(path.join(dir, 'images', f.replace('.png', '.json')), null);
    const body = [s.key, s.support, ...(s.items || []).map(i => `→ ${i}`)].filter(Boolean).join('\n');
    return {
      n, png: bust(path.join(pngDir, f)), file: `${folder}-${f}`,
      role: s.role || '', headline: s.headline || '', body,
      layout: s.layout || '', composition: s.composition || '', notes: s.notes || '', transition: s.transition || '',
      imagePrompt: side?.passes ? side.passes.map(ps => `Pass ${ps.n}: ${ps.prompt}`).join('\n\n') : side?.prompt || s.image?.prompt || '',
      imageModel: side ? `${side.provider} / ${side.model}${side.partial ? `, partial ${side.completedPasses}/${side.plannedPasses}` : ''}` : '',
      fallback: s.image?.fallback || '',
    };
  });
  const cs = path.join(dir, 'contact-sheet.png');
  const date = folder.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || (meta.createdAt || '').slice(0, 10);
  return {
    id: folder, date, createdAt: meta.createdAt || date,
    title: meta.title || meta.topic || folder, topic: meta.topic || '', brand: meta.brand || '',
    framework: meta.framework || '', layouts: meta.layouts || [],
    positioning: meta.positioning || '', context: meta.context || null, ideas: meta.ideas || [],
    caption: readText(path.join(dir, 'caption.txt')) || [meta.caption, (meta.hashtags || []).join(' ')].filter(Boolean).join('\n\n'),
    images: meta.images || null,
    contactSheet: fs.existsSync(cs) ? bust(cs) : null,
    report: report ? report.summary : null,
    slides,
  };
}

const items = fs.readdirSync(outDir, { withFileTypes: true }).filter(d => d.isDirectory())
  .map(d => entry(d.name)).filter(Boolean)
  .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.id.localeCompare(a.id));

writeJSON(path.join(ws, 'index.json'), { generatedAt: new Date().toISOString(), carousels: items });
fs.copyFileSync(path.join(SKILL_DIR, 'templates', 'gallery.html'), path.join(ws, 'gallery.html'));
console.log(`Indexed ${items.length} carousel(s) → ${path.join(ws, 'index.json')}`);

if (args.serve) {
  const port = Number(args.port) || 4173;
  const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
  http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.resolve(ws, '.' + (urlPath === '/' ? '/gallery.html' : urlPath));
    // Serve only files inside the workspace, never .env or dotfiles.
    if (!file.startsWith(path.resolve(ws) + path.sep) || /(^|[\\/])\./.test(path.relative(ws, file)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  }).listen(port, '127.0.0.1', () => console.log(`Gallery: http://localhost:${port}/  (Ctrl+C to stop)`))
    .on('error', e => fail(e.code === 'EADDRINUSE' ? `port ${port} is in use - try --port ${port + 1}` : e.message));
}
