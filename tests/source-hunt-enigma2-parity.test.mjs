import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/source-hunt-enigma2.js', import.meta.url), 'utf8');

assert.match(source, /core\/enigma2-core\.js\?v=20260930-enigma2-e3b/,
  'frontend Enigma2 Hunt must consume the cache-busted shared structural core');
assert.match(source, /parseEnigma2Bouquet\s*\(/,
  'frontend Enigma2 Hunt must derive bouquet service structure from the shared core');
assert.doesNotMatch(source, /function\s+extractService\s*\(/,
  'frontend Enigma2 Hunt must not keep an independent SERVICE parser');
assert.doesNotMatch(source, /function\s+safeDecode\s*\(/,
  'frontend Enigma2 Hunt must not keep independent Enigma2 percent-decoding');
assert.doesNotMatch(source, /function\s+parseBouquet\s*\([^)]*\)\s*\{[\s\S]*?split\s*\(\/\\r\?\\n\//,
  'frontend parseBouquet adapter must not traverse raw bouquet lines independently');

assert.match(source, /function\s+isPrivateHost\s*\(/,
  'private-host rejection remains frontend policy');
assert.match(source, /function\s+safeHeadersFromSuffix\s*\(/,
  'header allowlisting remains frontend adapter policy');
assert.match(source, /function\s+splitHeaders\s*\(/,
  'header suffix separation remains frontend adapter policy');
assert.match(source, /function\s+classifyUrl\s*\(/,
  'media-type acceptance remains frontend policy');
assert.match(source, /workerFetchText\s*\(/,
  'bouquet transport fallback remains outside the shared structural core');
assert.match(source, /type===['"]rtmp['"]\|\|type===['"]rtsp['"]/,
  'unsupported RTMP/RTSP policy remains in the frontend adapter');

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(index,/\.\/src\/source-hunt-enigma2\.js\?v=20260930-enigma2-e3b/,
  'top-level Enigma2 browser module must move atomically with the E3b shared-core dependency');
assert.doesNotMatch(index,/source-hunt-enigma2\.js\?v=20260929-enigma2-visible-proxy/,
  'stale pre-E3b Enigma2 module cache key must be retired');

console.log('frontend Enigma2 parity tests PASS');
