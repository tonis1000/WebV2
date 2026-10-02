import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../src/xtream-save-destination-ui.js',import.meta.url),'utf8');
const registry=fs.readFileSync(new URL('../src/registry-default.js',import.meta.url),'utf8');
const cloudReadSync=fs.readFileSync(new URL('../src/cloud-read-sync.js',import.meta.url),'utf8');

assert.match(registry,/xtream-save-destination-ui\.js/,'production registry entrypoint must load the Xtream save-destination owner');
assert.match(ui,/webtv:xtream-preview-save-channel-request/,'destination owner must listen to the verified preview channel-save event');
assert.match(ui,/saveVerifiedXtreamChannel/,'destination owner must delegate persistence to the tested orchestration layer');
assert.match(ui,/listCustomPlaylists/,'destination UI must offer existing Custom Saved Playlists');
assert.match(ui,/getCustomPlaylistChannels/,'all-known scope must read already-saved Custom Playlist sources');
assert.match(ui,/getMyPlaylist/,'all-known scope must include already-known My Playlist sources');
assert.match(ui,/getChannels/,'all-known scope may include the current already-loaded catalog without discovery');
assert.match(ui,/WebTVSavedPlaylistsReadAPI/,'all-known scope must include existing source-backed Saved Playlists');
assert.match(ui,/getAllCached/,'all-known scope must read Saved Playlist snapshots without starting network discovery');
assert.match(cloudReadSync,/WebTVSavedPlaylistsReadAPI/,'cloud read sync must remain the single Saved Playlist read owner');
assert.match(cloudReadSync,/getAllCached/,'Saved Playlist read owner must expose the reconciled IndexedDB snapshot');
assert.match(ui,/Selected source/,'selected source must remain the default explicit option');
assert.match(ui,/All known sources/,'all-known must be a separate explicit option');
assert.match(ui,/New Custom Playlist/,'destination UI must support creating a new Custom Playlist');
assert.doesNotMatch(ui,/from\s+['"][^'"]*(?:unified-search|discovery|source-hunt)[^'"]*['"]|\bfetch\s*\(/i,'save destination owner must not import/call search, discovery, Source Hunt, or raw network fetch directly');
assert.doesNotMatch(ui,/xtreamPreviewToken[^\n]{0,80}(textContent|innerHTML|value)/,'opaque preview token must never be rendered');

console.log('Xtream save-destination UI ownership contract PASS');
