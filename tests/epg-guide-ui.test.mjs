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
assert.match(ui,/setInterval\([^\n]*updateNowPresentation/,'Guide must refresh only NOW presentation while open');
assert.match(css,/\.epg-guide-now-line/,'Guide must style the current-time line');
assert.match(css,/\.epg-guide-program\.is-now/,'Guide must style currently airing programme cells');
assert.match(css,/--epg-hour-width:225px/,'Desktop guide hour scale must be 1.5x larger');
assert.match(css,/min-height:117px/,'Desktop guide rows must be 1.5x taller');
assert.match(css,/height:96px/,'Desktop programme boxes must be 1.5x taller');
assert.match(ui,/const DESKTOP_HOUR_WIDTH=225/,'Guide JS must use the same 1.5x desktop hour scale');
assert.match(ui,/const MOBILE_HOUR_WIDTH=132/,'Mobile guide must retain the compact hour scale');
assert.match(ui,/function hourWidth\(\)/,'Guide must compute the active responsive hour scale');

assert.ok(ui.includes('TIMELINE_STEP_HOURS=3'),'Guide arrows must move three-hour timeline steps');
assert.ok(ui.includes('scrollTimelineBy'),'Guide arrows must scroll within the current day');
assert.ok(ui.includes('focusNowInTimeline'),'Today must center the current time');
assert.ok(ui.includes('keepCurrentProgrammeCopyVisible'),'Current programme copy must remain visible while horizontally clipped');

assert.ok(ui.includes('MAX_DAY_OFFSET=6'),'Guide must expose today plus the next six days');
assert.ok(ui.includes('epg-guide-day-tabs'),'Guide must render a seven-day selector beside the current day');
assert.ok(ui.includes('renderDayTabs'),'Guide must render day buttons from the selected day state');
assert.ok(ui.includes('selectGuideDay'),'Guide day buttons must change the active EPG day');
assert.ok(ui.includes('aria-pressed'),'Selected guide day must expose button state');

console.log('EPG Guide ownership/UI contract PASS');
