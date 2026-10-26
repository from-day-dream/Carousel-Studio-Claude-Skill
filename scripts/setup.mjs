#!/usr/bin/env node
// First-run setup and preflight.
//
//   node setup.mjs            install npm deps (if needed) + Playwright Chromium
//   node setup.mjs --check    print readiness as JSON; exit 1 if not ready (no installs)
//   node setup.mjs --init [--brand <slug>] [--workspace <path>]
//                             create the workspace and an empty brand kit from templates/brand
//   node setup.mjs --demo [--workspace <path>]
//                             copy examples/brand-demo into the workspace as brand "demo"
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { SKILL_DIR, parseArgs, readJSON, writeJSON, resolveWorkspace, fail } from './lib/workspace.mjs';

const args = parseArgs();
const require = createRequire(path.join(SKILL_DIR, 'package.json'));

function status() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const deps = ['playwright', 'sharp', 'dotenv'].every(d => { try { require.resolve(d); return true; } catch { return false; } });
  let chromium = false;
  if (deps) {
    try { chromium = fs.existsSync(require('playwright').chromium.executablePath()); } catch { /* not installed */ }
  }
  const ws = resolveWorkspace(args);
  const config = readJSON(path.join(ws, 'config.json'), null);
  return {
    node: process.versions.node, nodeOk: nodeMajor >= 18, deps, chromium,
    workspace: ws, workspaceExists: !!config,
    activeBrand: config?.activeBrand ?? null,
    brands: config ? fs.readdirSync(path.join(ws, 'brands')).filter(b => fs.existsSync(path.join(ws, 'brands', b, 'tokens.json'))) : [],
  };
}

const run = cmd => execSync(cmd, { cwd: SKILL_DIR, stdio: 'inherit' });

function copyDir(src, dst, skip = []) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true }).filter(e => !skip.includes(e.name))) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else if (!fs.existsSync(d)) fs.copyFileSync(s, d);
  }
}

function ensureWorkspace(ws, activeBrand) {
  for (const d of ['brands', 'output']) fs.mkdirSync(path.join(ws, d), { recursive: true });
  const cfgFile = path.join(ws, 'config.json');
  const cfg = readJSON(cfgFile, {});
  if (activeBrand && !cfg.activeBrand) cfg.activeBrand = activeBrand;
  writeJSON(cfgFile, cfg);
  const gi = path.join(ws, '.gitignore');
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, '.env\n');
  const env = path.join(ws, '.env.example');
  if (!fs.existsSync(env)) fs.writeFileSync(env, '# Optional image providers (not used until images are enabled in images.json)\nFAL_KEY=\nATLAS_CLOUD_API_KEY=\nOPENAI_API_KEY=\n');
  else if (!fs.readFileSync(env, 'utf8').includes('OPENAI_API_KEY')) fs.appendFileSync(env, 'OPENAI_API_KEY=\n');
  const gallery = path.join(ws, 'gallery.html');
  if (!fs.existsSync(gallery)) fs.copyFileSync(path.join(SKILL_DIR, 'templates', 'gallery.html'), gallery);
  return cfg;
}

if (args.check) {
  const s = status();
  console.log(JSON.stringify(s, null, 2));
  process.exit(s.nodeOk && s.deps && s.chromium ? 0 : 1);
}

if (args.init || args.demo) {
  const ws = resolveWorkspace(args);
  if (args.demo) {
    const dst = path.join(ws, 'brands', 'demo');
    ensureWorkspace(ws, 'demo');
    copyDir(path.join(SKILL_DIR, 'examples', 'brand-demo'), dst, ['sample-carousel', 'tests', 'specimen.png']);
    console.log(`Demo brand copied to ${dst}`);
  } else {
    const slug = typeof args.brand === 'string' ? args.brand : fail('--init needs --brand <slug>');
    if (!/^[a-z0-9-]+$/.test(slug)) fail('brand slug must be lowercase letters, digits and dashes');
    const dst = path.join(ws, 'brands', slug);
    if (fs.existsSync(path.join(dst, 'tokens.json'))) fail(`brand already exists: ${dst}`);
    ensureWorkspace(ws, slug);
    copyDir(path.join(SKILL_DIR, 'templates', 'brand'), dst);
    for (const d of ['fonts', 'logo', 'layouts', 'style-refs']) fs.mkdirSync(path.join(dst, d), { recursive: true });
    console.log(`Brand kit created at ${dst}`);
  }
  console.log(`Workspace: ${ws}`);
  process.exit(0);
}

const s = status();
if (!s.nodeOk) fail(`Node ${s.node} is too old; install Node 18 or newer.`);
if (!s.deps) { console.log('Installing npm dependencies…'); run('npm install --no-audit --no-fund'); }
if (!status().chromium) { console.log('Installing Playwright Chromium…'); run('npx playwright install chromium'); }
const final = status();
console.log(final.deps && final.chromium ? 'Render dependencies ready.' : 'Setup incomplete - see errors above.');
process.exit(final.deps && final.chromium ? 0 : 1);
