import assert from 'node:assert/strict';
import fs from 'node:fs';

const inspector=fs.readFileSync(new URL('../src/saved-sources-ui.js',import.meta.url),'utf8');
const manager=fs.readFileSync(new URL('../src/playlist-manager.js',import.meta.url),'utf8');

assert.doesNotMatch(inspector,/\/api\/my-playlist\/channel/,'Playback Inspector must not own a direct My Playlist Registry write path');
assert.doesNotMatch(inspector,/function\s+putMyPlaylistChannel\s*\(/,'Playback Inspector must not define a second My Playlist writer');
assert.match(inspector,/WebTVMyPlaylistAPI/,'Playback Inspector mutations must delegate to the canonical My Playlist API');
assert.match(inspector,/addSourceToCurrent/,'Playback Inspector Add source must use the canonical My Playlist API');
assert.match(inspector,/replaceSourcesForCurrent/,'Playback Inspector Edit/Delete must use the canonical My Playlist API');
assert.match(manager,/replaceSourcesForCurrent[\s\S]*assertGenericMyMutationAllowed\s*\(c\)/,'canonical source replacement must keep the loaded-Xtream mutation guard');
assert.match(manager,/addSourceToCurrent[\s\S]*assertGenericMyMutationAllowed\s*\(c\)/,'canonical source add must keep the loaded-Xtream mutation guard');

console.log('Playback Inspector persistence boundary PASS');
