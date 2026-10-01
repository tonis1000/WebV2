import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/source-hunt-enigma2.js', import.meta.url), 'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const catalog=fs.readFileSync(new URL('../src/search/curated-source-catalog.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../workers/webtv-source-discovery.js',import.meta.url),'utf8');

// Historical browser adapter remains structurally compatible for reference/rollback,
// but Unified Search consolidation retires it from active page execution.
assert.match(source, /core\/enigma2-core\.js\?v=20260930-enigma2-e3b/,
  'retired frontend Enigma2 adapter must continue to consume the shared structural core');
assert.match(source, /parseEnigma2Bouquet\s*\(/,
  'retired frontend Enigma2 adapter must still derive bouquet structure from the shared core');
assert.doesNotMatch(source, /function\s+extractService\s*\(/,
  'retired frontend Enigma2 adapter must not regain an independent SERVICE parser');
assert.doesNotMatch(source, /function\s+safeDecode\s*\(/,
  'retired frontend Enigma2 adapter must not regain independent percent-decoding');
assert.doesNotMatch(source, /function\s+parseBouquet\s*\([^)]*\)\s*\{[\s\S]*?split\s*\(\/\\r\?\\n\//,
  'retired parseBouquet adapter must not traverse raw bouquet lines independently');

assert.match(source, /function\s+isPrivateHost\s*\(/,'historical private-host policy remains in the retired adapter');
assert.match(source, /function\s+safeHeadersFromSuffix\s*\(/,'historical header allowlisting remains in the retired adapter');
assert.match(source, /workerFetchText\s*\(/,'historical bouquet transport fallback remains outside the structural core');

// Consolidation ownership: Discovery Worker + shared catalog own active Enigma2 scanning.
assert.doesNotMatch(index,/\.\/src\/source-hunt-enigma2\.js(?:\?|"|')/,
  'legacy frontend Enigma2 scanner must remain retired from active page load');
assert.match(index,/\.\/src\/search\/search-ui\.js\?v=20260930-unified-search-a/,
  'Unified Search must be the active automatic search surface');
assert.match(catalog,/format:'enigma2'/,'canonical curated source catalog must declare Enigma2 feeds');
assert.match(worker,/parseEnigma2Bouquet/,'active Discovery Worker must consume the shared Enigma2 structural core');
assert.match(worker,/curated-source-catalog\.js/,'active Discovery Worker must source Enigma2 feeds from the canonical curated catalog');
assert.doesNotMatch(index,/source-hunt-enigma2\.js\?v=20260929-enigma2-visible-proxy/,
  'stale pre-E3b Enigma2 cache key must remain retired');

console.log('frontend Enigma2 parity + Unified Search ownership PASS');
