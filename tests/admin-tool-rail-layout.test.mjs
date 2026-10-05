import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin=fs.readFileSync(new URL('../src/admin-gate.js',import.meta.url),'utf8');
const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
const search=fs.readFileSync(new URL('../src/search/search-ui.js',import.meta.url),'utf8');
const gateCss=fs.readFileSync(new URL('../admin-gate.css',import.meta.url),'utf8');

assert.match(admin,/unified-search-panel/,'locking admin must close Unified Search');
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

assert.match(rail,/\[brand,catalog,clock\]/,'player header must order TONI\'S WEBTV, My Playlist, then clock');
assert.doesNotMatch(rail,/\[playlists,catalog\]/,'My Playlist badge must not remain in the Library rail group');
assert.match(rail,/\.player-header-admin \.rail-brand\{[^}]*font-size:/,'TONI\'S WEBTV must have an explicit larger header size');
assert.match(rail,/#current-catalog-badge\.header-catalog-badge/,'My Playlist badge must use the compact player-header presentation');

assert.match(rail,/\.player-header-admin \.rail-brand #admin-unlock-trigger\{[^}]*font-size:/,'TONI\'S WEBTV size rule must target the actual admin button, not only its wrapper');
console.log('admin tool rail layout contract ok');
