import assert from 'node:assert/strict';
import fs from 'node:fs';

const manager=fs.readFileSync(new URL('../src/playlist-manager.js',import.meta.url),'utf8');
const hunt=fs.readFileSync(new URL('../src/source-hunt-save-destination.js',import.meta.url),'utf8');
const favorites=fs.readFileSync(new URL('../src/favorites-ui.js',import.meta.url),'utf8');

assert.doesNotMatch(
  hunt,
  /['"]\/api\/my-playlist\/channel['"]/,
  'Source Hunt must not own a direct My Playlist Registry writer'
);
assert.match(
  hunt,
  /saveDiscoveredChannel\s*\(/,
  'Source Hunt must delegate discovered-channel persistence to canonical My Playlist API'
);
assert.match(
  manager,
  /async function saveDiscoveredMyChannel\s*\(/,
  'Playlist Manager must own discovered-channel persistence'
);
assert.match(
  manager,
  /reason\s*!==\s*['"]source-hunt-save['"]/,
  'discovered-channel API must be narrow to Source Hunt save intent'
);
assert.match(
  manager,
  /const target=\{\.\.\.channel,directUrls:cleanSources\.map\(source=>source\.url\)\};[\s\S]*assertGenericMyMutationAllowed\s*\(target\)/,
  'discovered-channel save must guard the actual discovered source URLs against loaded Xtream bypass'
);
assert.match(
  manager,
  /saveDiscoveredChannel\s*:\s*\(channel,sources,options=\{\}\)\s*=>saveDiscoveredMyChannel\(channel,sources,options\)/,
  'public My Playlist API must delegate discovered-channel writes to Playlist Manager owner'
);

assert.match(
  favorites,
  /function isMyPlaylistCatalog\s*\(\)\s*\{[^}]*getCatalogMode\?\.\(\)===['"]cloud['"]/s,
  'Favorites must explicitly scope themselves to the D1 My Playlist catalog'
);
assert.match(
  favorites,
  /if\s*\(!isMyPlaylistCatalog\(\)\)\s*return;/,
  'Favorite mutation must refuse non-My-Playlist catalogs'
);
assert.match(
  favorites,
  /filter\.hidden\s*=\s*!myPlaylist/,
  'Favorites filter must be hidden outside My Playlist'
);
assert.match(
  favorites,
  /if\s*\(!myPlaylist\)\s*\{[^}]*item\.hidden\s*=\s*false/s,
  'Favorites filtering must not hide channels outside My Playlist'
);
assert.match(
  favorites,
  /button\.hidden\s*=\s*!myPlaylist\s*\|\|\s*!id/,
  'Favorite channel action must be hidden outside My Playlist'
);

console.log('My Playlist action ownership PASS');
