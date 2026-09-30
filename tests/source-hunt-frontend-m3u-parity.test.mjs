import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/source-hunt-engine.js',import.meta.url),'utf8');

assert.match(source,/function\s+extractM3u8\s*\(/,'frontend Hunt must keep its HLS-only URL extractor local');
assert.match(source,/\.m3u8/,'frontend exact M3U path must remain HLS-focused');
assert.match(source,/function\s+collectFromLooseText\s*\(/,'loose-text fallback must remain local and independent');
assert.match(source,/40\s*\+\s*headerScore\s*\*\s*5\s*\+\s*urlRelevance\(url,\s*name\)\s*\*\s*3/,'exact M3U scoring formula must remain unchanged');
assert.match(source,/exact\.length\s*\?\s*exact\s*:\s*collectFromLooseText/,'loose-text fallback decision must remain unchanged');

assert.match(source,/m3u-container\.js/,'frontend Source Hunt must import the shared M3U container core');
assert.match(source,/parseM3uContainer/,'frontend Source Hunt must consume parseM3uContainer');
assert.match(source,/entry\.extinf\.startsWith\(['"]#EXTINF['"]\)/,'frontend Hunt must preserve its previous case-sensitive EXTINF acceptance');
assert.match(source,/extractM3u8\(entry\.sourceLine/,'shared structural source must still pass through the local HLS-only extractor');
assert.doesNotMatch(source,/function\s+collectFromM3U\([^)]*\)\s*\{\s*const lines\s*=/,'frontend Hunt must not retain independent M3U line traversal');

console.log('frontend Source Hunt M3U parity PASS');
