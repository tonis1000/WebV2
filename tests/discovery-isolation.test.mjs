import assert from 'node:assert/strict';
import fs from 'node:fs';

const files=[
  '../src/discovery/discovery-ui.js',
  '../src/discovery/discovery-state.js',
  '../src/discovery/candidate-model.js',
  '../src/discovery/local-data-reader.js',
  '../src/discovery/local-candidates.js',
  '../src/discovery/verifier-client.js',
];
const text=Object.fromEntries(files.map(file=>[file,fs.readFileSync(new URL(file,import.meta.url),'utf8')]));
const combined=Object.values(text).join('\n');
const ui=text['../src/discovery/discovery-ui.js'];
const verifier=text['../src/discovery/verifier-client.js'];
const nonVerifier=Object.entries(text).filter(([file])=>!file.endsWith('/verifier-client.js')).map(([,value])=>value).join('\n');

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
  'indexedDB',
]) assert.equal(combined.includes(forbidden),false,`Discovery Phase 3 must not reference ${forbidden}`);

assert.equal(/\bfetch\s*\(/.test(nonVerifier),false,'Only verifier-client may perform Discovery network verification');
assert.equal(/fetchImpl\s*\(/.test(verifier),true,'Verifier client must isolate its network call behind fetchImpl');
assert.equal(verifier.includes('/verify'),true,'Verifier client may call only the verifier endpoint');
assert.equal(verifier.includes('MAX_CONCURRENCY=2'),true,'Verifier client concurrency must remain bounded at 2');
assert.equal(verifier.includes('REQUEST_TIMEOUT_MS=7000'),true,'Verifier client request timeout must remain bounded');
assert.equal(combined.includes('localStorage'),false,'Discovery results must not persist in localStorage');
assert.equal(combined.includes('sessionStorage'),false,'Discovery results must not persist in sessionStorage');
assert.equal(combined.includes('WebTVSavedPlaylistsReadAPI'),true,'Saved Playlist cache must be read through its owner API');
assert.equal(ui.includes('WebTVPlaylistAPI?.getSelectedChannel'),true,'Discovery may read selected channel through read-only public API');
assert.equal(/(?:^|[^A-Za-z])play\s*\(/m.test(ui),false,'Discovery shell must not trigger direct play() calls');
assert.equal(ui.includes('Save Source'),false,'Phase 3 must not expose source persistence');
assert.equal(ui.includes('Add to My Playlist'),false,'Phase 3 must not expose My Playlist mutation');
console.log('discovery Phase 3 isolation tests PASS');
