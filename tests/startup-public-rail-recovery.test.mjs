import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const registryDefault=fs.readFileSync(new URL('../src/registry-default.js',import.meta.url),'utf8');
const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');

assert.match(main,/loadStartupCloudPlaylist/,'main startup must use a bounded resilient cloud playlist loader');
assert.match(main,/if\(channels\.length\).*cache|continue.*cache|cached/i,'startup must be able to continue from an already-painted cache when the first cloud read fails');
assert.match(registryDefault,/setTimeout\(\(\)=>recoverCloudSidebar\(\),\s*1800\)/,'sidebar recovery must run even when WebTVPlaylistAPI.ready is still false');
assert.doesNotMatch(registryDefault,/if\(window\.WebTVPlaylistAPI\?\.ready\)recoverCloudSidebar\(\)/,'startup recovery must not be gated by ready');

assert.match(rail,/const DESKTOP = '\(min-width: 900px\)'/,'public desktop rail must remain available on scaled desktop viewports');
assert.match(rail,/@media\(min-width:900px\) and \(max-width:1179px\)/,'scaled desktop rail must use a compact three-column layout');
assert.match(rail,/desktop-control-rail\{display:block!important\}/,'locked public rail must remain visible');

console.log('startup recovery + scaled public rail contract ok');
