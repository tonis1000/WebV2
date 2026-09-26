import assert from 'node:assert/strict';
import fs from 'node:fs';

const files=[
  '../src/discovery/discovery-ui.js',
  '../src/discovery/discovery-state.js',
  '../src/discovery/candidate-model.js',
  '../src/discovery/local-data-reader.js',
  '../src/discovery/local-candidates.js',
];
const text=Object.fromEntries(files.map(file=>[file,fs.readFileSync(new URL(file,import.meta.url),'utf8')]));
const combined=Object.values(text).join('\n');
const ui=text['../src/discovery/discovery-ui.js'];
const reader=text['../src/discovery/local-data-reader.js'];

for (const forbidden of [
  'MutationObserver',
  'saveBestSourceToCurrent',
  'WebTVMyPlaylistAPI',
  'reloadCloudMyPlaylist',
  '/api/my-playlist',
  '/api/playlists',
  'source-registry.js',
  'core/player.js',
  'source-save-policy.js',
  'WebTVPlaybackAPI',
  'PlayerController',
]) assert.equal(combined.includes(forbidden),false,`Discovery Phase 2 must not reference ${forbidden}`);

assert.equal(/\bfetch\s*\(/.test(combined),false,'Phase 2 discovery must not make network requests');
assert.equal(combined.includes('localStorage'),false,'Phase 2 discovery results must not persist in localStorage');
assert.equal(combined.includes('sessionStorage'),false,'Phase 2 discovery results must not persist in sessionStorage');
assert.equal(/transaction\s*\([^)]*['"]readwrite['"]/.test(reader),false,'Saved Playlist cache access must remain readonly');
assert.equal(/\.put\s*\(/.test(reader),false,'Discovery reader must not write IndexedDB records');
assert.equal(/\.delete\s*\(/.test(reader),false,'Discovery reader must not delete IndexedDB records');
assert.equal(/\.clear\s*\(/.test(reader),false,'Discovery reader must not clear IndexedDB records');
assert.equal(ui.includes('WebTVPlaylistAPI?.getSelectedChannel'),true,'Discovery may read selected channel through read-only public API');
assert.equal(/(?:^|[^A-Za-z])play\s*\(/m.test(ui),false,'Discovery shell must not trigger direct play() calls');
console.log('discovery isolation tests PASS');
