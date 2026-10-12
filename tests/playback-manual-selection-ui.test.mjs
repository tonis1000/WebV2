import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const inspector = readFileSync(new URL('../src/saved-sources-ui.js', import.meta.url), 'utf8');
assert.match(main, /async function listSelectedPlaybackRoutes\(/, 'Expose routes from canonical SourceRegistry');
assert.match(main, /async function playSelectedPlaybackRoute\(/, 'Use canonical selected channel');
assert.match(main, /player\.playSelectedRoute\(/, 'Manual selection must delegate to sole PlayerController');
assert.match(main, /listSelectedPlaybackRoutes,/, 'Bridge must expose route list');
assert.match(main, /playSelectedPlaybackRoute,/, 'Bridge must expose manual play');
assert.match(inspector, /id="playback-source-choice"/, 'Existing inspector must offer source picker');
assert.match(inspector, /WebTVPlaybackAPI\s*\?\.listSelectedPlaybackRoutes\?\.\(/, 'Picker uses existing bridge');
assert.match(inspector, /WebTVPlaybackAPI\s*\?\.playSelectedPlaybackRoute\?\.\(/, 'Picker delegates playback');
assert.match(inspector, /result\\?\\.verifiedPlayback === false/, 'Inspector must distinguish loaded iframe from confirmed playback');
assert.match(inspector, /Embed loaded; video and audio not confirmed/, 'Unverified embed needs explicit user-facing status');
console.log('manual playback UI/bridge contract PASS');
