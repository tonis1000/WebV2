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
const buildTargets = Object.values(importMap.imports || {}).filter(value => String(value).startsWith('./src/'));
assert.ok(buildTargets.length > 0, 'Import map should cache-bust core modules');
assert.equal(new Set(buildTargets.map(value => String(value).split('?v=')[1])).size, 1, 'Core import map should use one build id');

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
assert.match(oneClick, /WebTVPlaybackAPI/, 'One-click must call the playback service API');
assert.doesNotMatch(oneClick, /waitForPlayback\(/, 'One-click must not infer playback success by observing diagnostics DOM');
assert.doesNotMatch(oneClick, /testButton\.click\(/, 'One-click must not simulate the manual Test button');

const main = read('src/main.js');
assert.match(main, /window\.WebTVPlaybackAPI/, 'main.js should expose the narrow playback API bridge');
assert.match(main, /DEBUG_STORAGE/, 'storage persistence diagnostics should be explicitly gated');
const debugBlock = index.match(/<script>\s*\(\(\) => \{[\s\S]*?PREBOOT V2 DEBUG[\s\S]*?<\/script>/i)?.[0] || '';
assert.match(debugBlock, /debug\.has\('storage'\)/, 'preboot storage tracing must require ?debug=storage');

const sourceRegistry = read('src/core/source-registry.js');
assert.match(sourceRegistry, /isRejectedChannelSource/, 'channel-specific source rejection rules should live outside SourceRegistry');
assert.doesNotMatch(sourceRegistry, /channelKey\s*!==\s*['"]mega['"]/, 'SourceRegistry core must not hard-code MEGA rules');
assert.ok(existsSync(path.join(ROOT, 'src/core/source-rules.js')), 'source-rules.js should exist');
assert.ok(existsSync(path.join(ROOT, 'src/core/health-scoring.js')), 'health-scoring.js should exist');

const healthStore = read('src/core/health-store.js');
const savePolicy = read('src/source-save-policy.js');
assert.match(healthStore, /scoreHealthEntry/, 'HealthStore should use shared health scoring');
assert.match(savePolicy, /scoreSourceUrl/, 'Source save policy should use shared health scoring');
assert.doesNotMatch(savePolicy, /function routeHealthScore/, 'Source save policy must not keep a second scoring formula');

assert.match(index, /Content-Security-Policy/, 'index.html should define a CSP boundary');

const engine = read('src/source-hunt-engine.js');
assert.match(engine, /Official Fallback Discovery/, 'Source Hunt should render a separate official fallback lane');
assert.match(engine, /Not stored as an IPTV source/, 'Official fallback UI should state separation from IPTV persistence');

const tvCacheWorkflow = read('.github/workflows/deploy-tv-cache.yml');
assert.doesNotMatch(tvCacheWorkflow, /- 'src\/core\/player\.js'/, 'Frontend-only player changes should not trigger TV Cache deploy');
assert.doesNotMatch(tvCacheWorkflow, /- 'tests\/header-aware-proxy\.test\.mjs'/, 'Shared regression test changes should not by themselves trigger TV Cache deploy');

const frontendWorkflow = read('.github/workflows/validate-frontend.yml');
assert.match(frontendWorkflow, /src\/\*\*\/\*\.js/, 'Frontend validation should cover all src/**/*.js changes');
assert.match(frontendWorkflow, /tests\/\*\*\/\*\.mjs/, 'Frontend validation should cover all tests/**/*.mjs changes');
assert.match(frontendWorkflow, /workers\/webtv-source-discovery\.js/, 'Frontend validation should cover Source Discovery Worker changes');
assert.match(frontendWorkflow, /workers\/source-discovery\/\*\*\/\*\.js/, 'Frontend validation should cover Source Discovery provider modules');
assert.match(frontendWorkflow, /source-discovery-worker\.test\.mjs/, 'Frontend validation should run Source Discovery Worker regression');
assert.match(frontendWorkflow, /github-public-playlists-provider\.test\.mjs/, 'Frontend validation should run GitHub provider regression');

const discoveryClient=read('src/discovery/external-discovery-client.js');
assert.match(discoveryClient,/webtv-source-discovery\.atonis\.workers\.dev/, 'Phase 4 client must use the dedicated Source Discovery Worker');
assert.match(discoveryClient,/curated-remote-feeds/, 'Phase 4 client must expose the curated remote feed provider');
assert.match(discoveryClient,/github-public-playlists/, 'Phase 4 client must expose the GitHub public playlist provider');
assert.doesNotMatch(discoveryClient,/api\.github\.com|WebTVPlaybackAPI|WebTVMyPlaylistAPI|SourceRegistry/, 'Browser external discovery must stay behind its Worker and outside playback/persistence');

const discoveryWorker=read('workers/webtv-source-discovery.js');
const githubProvider=read('workers/source-discovery/github-public-playlists.js');
assert.match(discoveryWorker,/github-public-playlists\.js/, 'Source Discovery Worker must route through the dedicated GitHub provider module');
assert.match(githubProvider,/GITHUB_MAX_SUBREQUESTS=10/, 'GitHub provider must retain a hard subrequest budget');
assert.match(githubProvider,/pushed:>=/, 'GitHub provider must apply repository freshness at the search query');
assert.doesNotMatch(githubProvider,/search\/code/, 'GitHub provider must not use credential-sensitive Code Search');

const discoveryDeploy=read('.github/workflows/deploy-source-discovery.yml');
assert.match(discoveryDeploy,/workers\/webtv-source-discovery\.js/, 'Source Discovery deploy must be scoped to its canonical Worker');
assert.match(discoveryDeploy,/workers\/source-discovery\/\*\*\/\*\.js/, 'Source Discovery deploy must include provider module changes');
assert.match(discoveryDeploy,/github-public-playlists/, 'Source Discovery live gate must cover the GitHub provider');
assert.doesNotMatch(discoveryDeploy,/src\/main\.js|src\/core\/player\.js/, 'Frontend-only runtime changes must not trigger Source Discovery deploy');

for (const rel of [
  'workers/webtv-registry.js',
  'workers/epg-proxy-gr.js',
  'workers/source-huntatonisworkersdev.js',
  'workers/tv-cache.js',
  'workers/webtv-source-verifier.js',
  'workers/webtv-source-discovery.js',
  'workers/source-discovery/github-public-playlists.js',
  '.github/workflows/deploy-webtv-registry.yml',
  '.github/workflows/deploy-epg-proxy-gr.yml',
  '.github/workflows/deploy-source-hunt.yml',
  '.github/workflows/deploy-tv-cache.yml',
  '.github/workflows/deploy-source-verifier.yml',
  '.github/workflows/deploy-source-discovery.yml',
]) {
  assert.ok(existsSync(path.join(ROOT, rel)), `Canonical runtime/deploy file missing: ${rel}`);
}

console.log(`frontend integration audit: PASS · ${jsFiles.length} src JS files · ${localScripts.length} local scripts`);
