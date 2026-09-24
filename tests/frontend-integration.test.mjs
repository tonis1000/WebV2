import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');
const stripQuery = value => String(value || '').split(/[?#]/, 1)[0];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const index = read('index.html');
const scriptSrcs = [...index.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi)].map(m => m[1]);
const localScripts = scriptSrcs.filter(src => src.startsWith('./'));
assert.ok(localScripts.length > 0, 'index.html should load local scripts');
for (const src of localScripts) {
  const rel = stripQuery(src).replace(/^\.\//, '');
  assert.ok(existsSync(path.join(ROOT, rel)), `Missing local script referenced by index.html: ${src}`);
}

const importMapMatch = index.match(/<script\s+type="importmap">([\s\S]*?)<\/script>/i);
assert.ok(importMapMatch, 'index.html should contain an import map');
const importMap = JSON.parse(importMapMatch[1]);
for (const [specifier, target] of Object.entries(importMap.imports || {})) {
  if (!String(target).startsWith('./')) continue;
  const rel = stripQuery(target).replace(/^\.\//, '');
  assert.ok(existsSync(path.join(ROOT, rel)), `Import map target missing for ${specifier}: ${target}`);
}

const jsFiles = walk(path.join(ROOT, 'src')).filter(file => file.endsWith('.js'));
const importRe = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
for (const file of jsFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(importRe)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(file), stripQuery(specifier));
    assert.ok(existsSync(resolved), `Missing relative import from ${path.relative(ROOT, file)}: ${specifier}`);
  }
}

const enginePos = index.indexOf('./src/source-hunt-engine.js');
const webPos = index.indexOf('./src/source-hunt-web.js');
const oneClickPos = index.indexOf('./src/source-hunt-oneclick.js');
assert.ok(enginePos >= 0 && webPos > enginePos && oneClickPos > webPos, 'Source Hunt modules must load engine → external discovery → one-click');

const oneClick = read('src/source-hunt-oneclick.js');
assert.match(oneClick, /collectCandidateUrls\(\)/, 'One-click stream candidate collector should exist');
assert.doesNotMatch(oneClick, /#hunt-official-results\s+code/, 'Official fallback results must never enter stream auto-test/auto-save candidate collection');
assert.match(oneClick, /officialFallbackFor/, 'One-click should know about verified official fallback availability');

const engine = read('src/source-hunt-engine.js');
assert.match(engine, /Official Fallback Discovery/, 'Source Hunt should render a separate official fallback lane');
assert.match(engine, /Not stored as an IPTV source/, 'Official fallback UI should state separation from IPTV persistence');

const tvCacheWorkflow = read('.github/workflows/deploy-tv-cache.yml');
assert.doesNotMatch(tvCacheWorkflow, /- 'src\/core\/player\.js'/, 'Frontend-only player changes should not trigger TV Cache deploy');
assert.doesNotMatch(tvCacheWorkflow, /- 'tests\/header-aware-proxy\.test\.mjs'/, 'Shared regression test changes should not by themselves trigger TV Cache deploy');

const frontendWorkflow = read('.github/workflows/validate-frontend.yml');
assert.match(frontendWorkflow, /src\/\*\*\/\*\.js/, 'Frontend validation should cover all src/**/*.js changes');
assert.match(frontendWorkflow, /tests\/\*\*\/\*\.mjs/, 'Frontend validation should cover all tests/**/*.mjs changes');

for (const rel of [
  'workers/webtv-registry.js',
  'workers/epg-proxy-gr.js',
  'workers/source-huntatonisworkersdev.js',
  'workers/tv-cache.js',
  '.github/workflows/deploy-webtv-registry.yml',
  '.github/workflows/deploy-epg-proxy-gr.yml',
  '.github/workflows/deploy-source-hunt.yml',
  '.github/workflows/deploy-tv-cache.yml',
]) {
  assert.ok(existsSync(path.join(ROOT, rel)), `Canonical runtime/deploy file missing: ${rel}`);
}

console.log(`frontend integration audit: PASS · ${jsFiles.length} src JS files · ${localScripts.length} local scripts`);
