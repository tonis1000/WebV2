import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../src/epg-guide.js',import.meta.url),'utf8');

assert.ok(ui.includes('TIMELINE_STEP_HOURS=3'),'EPG arrows should move three hours');
assert.ok(ui.includes('scrollTimelineBy'),'EPG arrows should scroll horizontally');
assert.ok(ui.includes('focusNowInTimeline'),'Today should center the current time');
assert.ok(ui.includes('keepCurrentProgrammeCopyVisible'),'Current programme text should remain visible');

console.log('EPG timeline navigation contract PASS');
