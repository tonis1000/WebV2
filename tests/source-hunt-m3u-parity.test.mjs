import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../workers/source-huntatonisworkersdev.js',import.meta.url),'utf8');

assert.match(source,/function\s+classifyEntry\s*\(/,'Hunt-specific channel filtering must remain local');
assert.match(source,/function\s+isLiveUrl\s*\(/,'Hunt live HLS\/DASH filtering must remain local');
assert.match(source,/function\s+isStrm\s*\(/,'STRM recognition must remain local in E2');
assert.match(source,/async\s+function\s+resolveStrm\s*\(/,'STRM resolution must remain local in E2');
assert.match(source,/function\s+rank\s*\(/,'Hunt ranking must remain local');
assert.match(source,/Math\.min\(lines\.length,i\+10\)/,'pre-migration fixture documents the current 9-line M3U source window');

assert.match(source,/m3u-container\.js/,'Source Hunt Worker must import the shared M3U container core');
assert.match(source,/parseM3uContainer/,'Source Hunt Worker must consume parseM3uContainer');
assert.match(source,/sourceOffset\s*>?=\s*10/,'Source Hunt must preserve its current 9-line source window through neutral offset metadata');
assert.doesNotMatch(source,/function\s+parseM3u\([^)]*\)\s*\{\s*const lines=/,'Source Hunt must not retain independent M3U line traversal');
assert.match(source,/extinf:\s*extinf\.slice\(0,500\)/,'Hunt output must retain the existing bounded EXTINF snippet');

console.log('Source Hunt M3U ownership parity PASS');
