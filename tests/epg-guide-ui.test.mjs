import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../src/epg-guide.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../epg-guide.css',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
const gate=fs.readFileSync(new URL('../admin-gate.css',import.meta.url),'utf8');

for(const required of ['epg-guide-toggle','epg-guide-overlay','epg-program-dialog','EPG Guide','Play'])
  assert.ok(ui.includes(required),'EPG Guide UI must include '+required);
assert.match(ui,/WebTVPlaylistAPI\?\.getChannels/,'Guide must derive rows from the current sidebar catalog');
assert.match(ui,/WebTVEPGAPI\?\.getSchedule/,'Guide must consume the canonical EPG owner');
assert.match(ui,/WebTVPlaybackAPI\?\.playChannelById/,'Guide Play must delegate to the existing Player owner');
assert.match(ui,/event\.target===overlay/,'backdrop click must close the guide');
assert.match(ui,/event\.key===['"]Escape['"]/,'Escape must close the guide');
assert.match(main,/playChannelById/,'main must expose a narrow channel playback bridge');
assert.match(main,/window\.WebTVEPGAPI/,'main must expose a narrow EPG read bridge');
assert.match(rail,/epg-guide-toggle/,'desktop protected rail must move the EPG Guide button');
assert.match(gate,/#epg-guide-toggle/,'locked mode must hide the EPG Guide control');
assert.match(gate,/#epg-guide-overlay/,'locked mode must hide an open EPG Guide');
assert.match(css,/\.epg-guide-grid/,'EPG Guide must own a dedicated grid');
assert.match(css,/position:fixed/,'EPG Guide must be an overlay rather than changing Player layout');

console.log('EPG Guide ownership/UI contract PASS');
