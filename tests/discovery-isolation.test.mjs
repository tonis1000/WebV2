import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../src/discovery/discovery-ui.js',import.meta.url),'utf8');
const state=fs.readFileSync(new URL('../src/discovery/discovery-state.js',import.meta.url),'utf8');
const model=fs.readFileSync(new URL('../src/discovery/candidate-model.js',import.meta.url),'utf8');
const combined=`${ui}\n${state}\n${model}`;

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
]) assert.equal(combined.includes(forbidden),false,`Discovery Phase 1 must not reference ${forbidden}`);

assert.equal(/\bfetch\s*\(/.test(combined),false,'Phase 1 discovery must not make network requests');
assert.equal(combined.includes('localStorage'),false,'Phase 1 discovery results must not persist in localStorage');
assert.equal(combined.includes('sessionStorage'),false,'Phase 1 discovery results must not persist in sessionStorage');
assert.equal(ui.includes('WebTVPlaylistAPI?.getSelectedChannel'),true,'Discovery may read selected channel through read-only public API');
assert.equal(/(?:^|[^A-Za-z])play\s*\(/m.test(ui),false,'Discovery shell must not trigger direct play() calls');
console.log('discovery isolation tests PASS');
