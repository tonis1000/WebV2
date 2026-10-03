import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin=fs.readFileSync(new URL('../src/admin-gate.js',import.meta.url),'utf8');
const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
const search=fs.readFileSync(new URL('../src/search/search-ui.js',import.meta.url),'utf8');
const gateCss=fs.readFileSync(new URL('../admin-gate.css',import.meta.url),'utf8');

assert.match(admin,/unified-search-panel/,'locking admin must close Unified Search');
assert.match(admin,/channel-logo-find/,'locking admin must hide Find logo');
assert.match(admin,/channel-logo-repair-missing/,'locking admin must hide Repair missing');

assert.match(search,/unified-search-toggle/,'Unified Search must expose one admin toggle');
assert.match(search,/panel\.hidden=true|panel\.hidden = true/,'Unified Search must start closed');

for(const id of ['unified-search-toggle','channel-logo-find','channel-logo-repair-missing']){
  assert.match(rail,new RegExp(id),'desktop rail must move '+id);
}
assert.match(rail,/Search & Logos/,'desktop rail must group search/logo tools');
assert.match(rail,/Library/,'desktop rail must group library tools');
assert.match(rail,/Channel/,'desktop rail must group channel actions');

assert.match(gateCss,/#unified-search-toggle/,'locked CSS must hide the search control');
assert.match(gateCss,/#channel-logo-find/,'locked CSS must hide Find logo');
assert.match(gateCss,/#channel-logo-repair-missing/,'locked CSS must hide Repair missing');

assert.match(rail,/\.player-card\{width:100%/,'viewer player card should use available desktop width');
assert.match(rail,/max-height:calc\(100vh - 300px\)|height:min\(/,'player stage must be viewport-bounded');

console.log('admin tool rail layout contract ok');
