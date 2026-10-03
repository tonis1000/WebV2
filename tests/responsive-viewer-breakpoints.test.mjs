import assert from 'node:assert/strict';
import fs from 'node:fs';

const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
const mobile=fs.readFileSync(new URL('../mobile.css',import.meta.url),'utf8');

assert.match(rail,/@media\(min-width:1800px\)/,'large desktop breakpoint must exist');
assert.match(rail,/@media\(min-width:2400px\)/,'2K/4K breakpoint must exist');
assert.match(rail,/width:min\(2500px,calc\(100% - 32px\)\)/,'very large screens must use more of the viewport');
assert.match(rail,/height:min\(68vh,1080px\)/,'very large screens must allow a larger player stage');
assert.match(rail,/\.player-card\{width:100%;max-width:none/,'desktop player must not be capped at the old 1180px');
assert.doesNotMatch(rail,/max-width:1180px/,'old large-screen player width cap must remain retired');

assert.match(mobile,/@media\(max-width:780px\)/,'tablet/mobile portrait breakpoint must remain');
assert.match(mobile,/@media\(max-width:520px\)/,'small phone breakpoint must remain');
assert.match(mobile,/@media\(orientation:landscape\) and \(max-height:520px\) and \(max-width:950px\)/,'small landscape breakpoint must remain');
assert.match(mobile,/\.player-stage\{width:100%;aspect-ratio:16\/9;min-height:0\}/,'mobile player must keep 16:9 sizing');

console.log('responsive viewer breakpoint contract ok');
