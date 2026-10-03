import assert from 'node:assert/strict';
import fs from 'node:fs';

const retiredSource=new URL('../src/source-hunt-engine.js',import.meta.url);
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const registry=fs.readFileSync(new URL('../src/search/source-registry.js',import.meta.url),'utf8');
const catalog=fs.readFileSync(new URL('../src/search/curated-source-catalog.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../workers/webtv-source-discovery.js',import.meta.url),'utf8');

// Consolidation ownership: the old browser scanner is retired completely after zero-consumer proof.
assert.equal(fs.existsSync(retiredSource),false,'legacy frontend Hunt M3U scanner must remain deleted');

// Active parity now belongs to shared cores + Unified Search/Worker consumers.
assert.doesNotMatch(index,/\.\/src\/source-hunt-engine\.js(?:\?|"|')/,'legacy frontend Hunt M3U scanner must remain retired from active page load');
assert.match(index,/\.\/src\/search\/search-ui\.js\?v=[^\"']+/,'Unified Search must be the active automatic search surface regardless of cache-bust version');
assert.match(registry,/curated-source-catalog\.js/,'Unified Search registry must derive curated sources from the shared source catalog');
assert.match(worker,/curated-source-catalog\.js/,'Discovery Worker must consume the same shared curated source catalog');
assert.match(catalog,/format:'m3u'/,'canonical curated catalog must retain M3U source declarations');

const importMap=index.match(/<script\s+type="importmap">([\s\S]*?)<\/script>/i)?.[1]||'';
assert.match(importMap,/\.\/src\/core\/channel-catalog\.js[^\n]*20261003-epg-recovery-a/,'browser import map must preserve Channel Catalog cache ownership under the current atomic build id');

console.log('frontend M3U parity + Unified Search ownership PASS');
