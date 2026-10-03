import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../src/epg-guide.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../epg-guide.css',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
const gate=fs.readFileSync(new URL('../admin-gate.css',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

for(const required of ['epg-guide-toggle','epg-guide-overlay','epg-program-dialog','EPG Guide','Play'])
  assert.ok(ui.includes(required),'EPG Guide UI must include '+required);
assert.match(ui,/playlist\(\)\?\.getChannels/,'Guide must derive rows from the current sidebar catalog');
assert.match(ui,/api\(\)\?\.getSchedule/,'Guide must consume the canonical EPG owner');
assert.match(ui,/WebTVPlaybackAPI\?\.playChannelById/,'Guide Play must delegate to the existing Player owner');
assert.match(ui,/event\.target===overlay/,'backdrop click must close the guide');
assert.match(ui,/event\.key===['"]Escape['"]/,'Escape must close the guide');
assert.match(main,/playChannelById/,'main must expose a narrow channel playback bridge');
assert.match(main,/window\.WebTVEPGAPI/,'main must expose a narrow EPG read bridge');
assert.match(rail,/epg-guide-toggle/,'desktop protected rail must move the EPG Guide button');
assert.match(index,/id="epg-guide-toggle"/,'EPG Guide control must exist statically in index.html');
assert.match(ui,/epgGuideBound/,'EPG Guide script must bind the static control exactly once');
assert.match(gate,/#epg-guide-toggle/,'locked mode must hide the EPG Guide control');
assert.match(gate,/#epg-guide-overlay/,'locked mode must hide an open EPG Guide');
assert.match(css,/\.epg-guide-grid/,'EPG Guide must own a dedicated grid');
assert.match(css,/position:fixed/,'EPG Guide must be an overlay rather than changing Player layout');
assert.match(ui,/epg-guide-now-line/,'Guide must render a current-time line');
assert.match(ui,/ΤΩΡΑ/,'Guide must label the current-time marker');
assert.match(ui,/classList\.add\('is-now'\)/,'Guide must mark currently airing programmes');
assert.match(ui,/setInterval\([^\n]*renderGuide/,'Guide must refresh the current-time presentation while open');
assert.match(css,/\.epg-guide-now-line/,'Guide must style the current-time line');
assert.match(css,/\.epg-guide-program\.is-now/,'Guide must style currently airing programme cells');
assert.match(css,/--epg-hour-width:150px/,'Desktop guide must use roomier hour cells');
assert.match(css,/min-height:78px/,'Desktop guide rows must be taller for readability');

console.log('EPG Guide ownership/UI contract PASS');
