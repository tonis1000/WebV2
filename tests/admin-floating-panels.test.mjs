import assert from 'node:assert/strict';
import fs from 'node:fs';

const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const search=fs.readFileSync(new URL('../src/search/search-ui.js',import.meta.url),'utf8');
const epg=fs.readFileSync(new URL('../src/epg-guide.js',import.meta.url),'utf8');

for(const selector of ['playlist-manager','unified-search-panel','source-hunt','diagnostics','epg-guide-shell']){
  assert.ok(rail.includes(selector),`floating panel registry must include ${selector}`);
}
assert.match(rail,/resize:both/,'desktop tool windows must be resizable');
assert.match(rail,/pointerdown/,'desktop tool windows must support drag pointer interaction');
assert.match(rail,/placeFloatingPanel/,'tool windows must receive an initial position left of the right rail');
assert.match(rail,/getBoundingClientRect\(\)/,'initial placement must use live rail/panel geometry');
assert.match(rail,/current-catalog-badge\.header-catalog-badge\{[^}]*border:0/,'header My Playlist badge must have no visible border');
assert.ok(rail.includes("badge.textContent = '★ My Playlist'")||rail.includes("catalog.textContent = '★ My Playlist'"),'header badge must stay compact and not duplicate My Playlist text');

for(const closeId of ['playlist-manager-close','source-hunt-close','diagnostics-close']){
  assert.ok(index.includes(closeId),`index must expose explicit Close control ${closeId}`);
}
assert.ok(search.includes('unified-search-close'),'Unified Search must expose an explicit Close control');
assert.ok(epg.includes('epg-guide-close'),'EPG Guide must expose an explicit Close control');
assert.match(epg,/epg-guide-shell/,'EPG Guide shell must be a floating-window target');
assert.match(index,/source-hunt-close[^>]*>Close</,'Manual Test must include visible Close text');
assert.match(index,/diagnostics-close[^>]*>Close</,'Diagnostics must include visible Close text');

console.log('admin floating tool windows contract PASS');
