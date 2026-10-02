import assert from 'node:assert/strict';
import fs from 'node:fs';

const playlist=fs.readFileSync(new URL('../src/playlist-manager.js',import.meta.url),'utf8');

assert.doesNotMatch(
  playlist,
  /async function\s+saveDiscoveredMyChannel\s*\(/,
  'orphan saveDiscoveredMyChannel implementation must remain retired'
);
assert.doesNotMatch(
  playlist,
  /saveDiscoveredChannel\s*:/,
  'orphan WebTVMyPlaylistAPI.saveDiscoveredChannel export must remain retired'
);

for(const required of [
  /upsertChannel\s*:/,
  /addSourceToCurrent\s*:/,
  /replaceSourcesForCurrent\s*:/
]){
  assert.match(playlist,required,'active My Playlist persistence APIs must remain');
}

assert.match(
  playlist,
  /reason!==['"]xtream-preview-save['"]/,
  'verified Xtream preview persistence boundary must remain'
);
assert.match(
  playlist,
  /assertGenericMyMutationAllowed/,
  'loaded-Xtream generic mutation guard must remain'
);

console.log('saveDiscoveredChannel retirement PASS');
