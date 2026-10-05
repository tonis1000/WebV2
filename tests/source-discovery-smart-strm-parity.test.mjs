import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../workers/webtv-source-discovery-smart.js', import.meta.url), 'utf8');

assert.match(source, /strm-core\.js/,
  'Discovery smart wrapper must consume the shared STRM core');
assert.doesNotMatch(source, /function\s+parseStrm\s*\(/,
  'Discovery smart wrapper must not keep an independent STRM document parser');
assert.doesNotMatch(source, /function\s+kodiHeaders\s*\(/,
  'Discovery smart wrapper must not keep duplicate Kodi header parsing');
assert.match(source, /parseStrmDocument\s*\(/,
  'Discovery smart wrapper must use shared STRM document structure');
assert.match(source, /isStrmReference\s*\(/,
  'nested STRM recognition must use the shared STRM core');

assert.match(source, /MAX_STRM_RESOLVES=4/,
  'curated smart wrapper resolve budget remains local');
assert.match(source, /STRM_TIMEOUT_MS=6000/,
  'curated smart wrapper timeout remains local');
assert.match(source, /STRM_MAX_DEPTH=3/,
  'curated smart wrapper recursion depth remains local');
assert.match(source, /STRM_MAX_BYTES=256000/,
  'curated smart wrapper body limit remains local');
assert.match(source, /function\s+privateHost\s*\(/,
  'private-host policy remains local to Discovery');
assert.match(source, /function\s+isAllowedCuratedCandidate\s*\(/,
  'curated candidates must pass the Discovery public-target gate');
assert.match(source, /!privateHost\(url\.hostname\)/,
  'curated candidate filtering must reuse the existing private-host policy');
assert.match(source, /DRM-marked STRM is not auto-promoted/,
  'curated smart wrapper must retain DRM auto-promotion rejection');
assert.match(source, /provider\|\|''\)===['"]curated-remote-feeds['"]/,
  'smart STRM pre-resolution remains limited to curated remote feeds');

console.log('Discovery smart STRM parity tests PASS');
