import assert from 'node:assert/strict';
import fs from 'node:fs';

const retiredSource = new URL('../src/source-hunt-enigma2.js', import.meta.url);
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const catalog=fs.readFileSync(new URL('../src/search/curated-source-catalog.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../workers/webtv-source-discovery.js',import.meta.url),'utf8');

// The historical browser Enigma2 adapter is retired completely after zero-consumer proof.
assert.equal(fs.existsSync(retiredSource),false,
  'legacy frontend Enigma2 scanner must remain deleted after Unified Search consolidation');

// Consolidation ownership: Discovery Worker + shared catalog own active Enigma2 scanning.
assert.doesNotMatch(index,/source-hunt-enigma2\.js/,
  'legacy frontend Enigma2 scanner must remain absent from active page load');
assert.match(index,/\.\/src\/search\/search-ui\.js\?v=[^\"']+/,
  'Unified Search must be the active automatic search surface regardless of cache-bust version');
assert.match(catalog,/format:'enigma2'/,'canonical curated source catalog must declare Enigma2 feeds');
assert.match(worker,/selectEnigma2BouquetServices/,'active Discovery Worker must consume the shared Enigma2 structural core through its selective API');
assert.match(worker,/curated-source-catalog\.js/,'active Discovery Worker must source Enigma2 feeds from the canonical curated catalog');
assert.doesNotMatch(index,/source-hunt-enigma2\.js\?v=20260929-enigma2-visible-proxy/,
  'stale pre-E3b Enigma2 cache key must remain retired');

console.log('frontend Enigma2 parity + Unified Search ownership PASS');
