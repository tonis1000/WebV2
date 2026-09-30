import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../workers/source-huntatonisworkersdev.js', import.meta.url), 'utf8');

assert.match(source, /strm-core\.js/,
  'Source Hunt Worker must consume the shared STRM core');
assert.doesNotMatch(source, /function\s+isStrm\s*\(/,
  'Source Hunt must not keep an independent STRM reference parser');
assert.match(source, /parseStrmDocument\s*\(/,
  'Source Hunt STRM resolution must use shared document structure');

assert.match(source, /function\s+extractLive\s*\(/,
  'Hunt must retain local final-media acceptance policy');
assert.match(source, /m3u8\|mpd/,
  'Hunt must retain HLS and DASH as accepted resolved media types');
assert.match(source, /class\s+Budget/,
  'Hunt subrequest budget remains caller-owned');
assert.match(source, /function\s+rank\s*\(/,
  'Hunt ranking remains caller-owned');
assert.match(source, /function\s+classifyEntry\s*\(/,
  'Hunt channel relevance policy remains caller-owned');
assert.match(source, /async\s+function\s+resolveStrm\s*\(/,
  'Hunt keeps its adapter-level resolver');

console.log('Source Hunt STRM parity tests PASS');
