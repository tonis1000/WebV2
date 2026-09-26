import assert from 'node:assert/strict';
import fs from 'node:fs';

const files=[
  '../src/discovery/discovery-ui.js',
  '../src/discovery/discovery-state.js',
  '../src/discovery/candidate-model.js',
  '../src/discovery/local-data-reader.js',
  '../src/discovery/local-candidates.js',
  '../src/discovery/verifier-client.js',
  '../src/discovery/external-discovery-client.js',
];
const text=Object.fromEntries(files.map(file=>[file,fs.readFileSync(new URL(file,import.meta.url),'utf8')]));
const combined=Object.values(text).join('\n');
const ui=text['../src/discovery/discovery-ui.js'];
const verifier=text['../src/discovery/verifier-client.js'];
const external=text['../src/discovery/external-discovery-client.js'];
const nonNetwork=Object.entries(text).filter(([file])=>!file.endsWith('/verifier-client.js')&&!file.endsWith('/external-discovery-client.js')).map(([,value])=>value).join('\n');

for (const forbidden of ['MutationObserver','saveBestSourceToCurrent','WebTVMyPlaylistAPI','reloadCloudMyPlaylist','/api/my-playlist','/api/playlists','source-registry.js','core/player.js','source-save-policy.js','WebTVPlaybackAPI','PlayerController','indexedDB']) assert.equal(combined.includes(forbidden),false,`Discovery Phase 4 must not reference ${forbidden}`);
assert.equal(/\bfetch\s*\(/.test(nonNetwork),false,'Only dedicated Discovery clients may perform browser network calls');
assert.equal(/fetchImpl\s*\(/.test(verifier),true,'Verifier client must isolate its network call behind fetchImpl');
assert.equal(verifier.includes('/verify'),true,'Verifier client may call only the verifier endpoint');
assert.equal(verifier.includes('MAX_CONCURRENCY=2'),true,'Verifier client concurrency must remain bounded at 2');
assert.equal(verifier.includes('REQUEST_TIMEOUT_MS=7000'),true,'Verifier client request timeout must remain bounded');
assert.equal(/fetchImpl\s*\(/.test(external),true,'External discovery client must isolate its network call behind fetchImpl');
assert.equal(external.includes('/discover'),true,'External discovery client may call only the discovery endpoint');
assert.equal(external.includes('EXTERNAL_DISCOVERY_TIMEOUT_MS=9000'),true,'External discovery request timeout must remain bounded');
assert.equal(external.includes('curated-remote-feeds'),true,'Phase 4 must retain the curated remote feed provider');
assert.equal(external.includes('github-public-playlists'),true,'Phase 4 must expose the GitHub public playlist provider explicitly');
assert.equal(external.includes('recent-web-search'),true,'Phase 4 must expose the recent web search provider explicitly');
assert.equal(external.includes('strm-specific-discovery'),true,'Phase 4 must expose the STRM-specific provider explicitly');
assert.equal(combined.includes('api.github.com'),false,'Browser Discovery must not call GitHub directly; GitHub access belongs to the Worker provider');
assert.equal(combined.includes('api.search.brave.com'),false,'Browser Discovery must not call Brave directly; web search belongs to the Worker provider');
assert.equal(combined.includes('BRAVE_API_KEY'),false,'Brave credentials must never enter browser Discovery modules');
assert.equal(combined.includes('localStorage'),false,'Discovery results must not persist in localStorage');
assert.equal(combined.includes('sessionStorage'),false,'Discovery results must not persist in sessionStorage');
assert.equal(combined.includes('WebTVSavedPlaylistsReadAPI'),true,'Saved Playlist cache must be read through its owner API');
assert.equal(ui.includes('WebTVPlaylistAPI?.getSelectedChannel'),true,'Discovery may read selected channel through read-only public API');
assert.equal(/(?:^|[^A-Za-z])play\s*\(/m.test(ui),false,'Discovery shell must not trigger direct play() calls');
assert.equal(ui.includes('Save Source'),false,'Phase 4 must not expose source persistence');
assert.equal(ui.includes('Add to My Playlist'),false,'Phase 4 must not expose My Playlist mutation');
console.log('discovery Phase 4 isolation tests PASS');
