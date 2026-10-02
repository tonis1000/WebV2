import assert from 'node:assert/strict';
import fs from 'node:fs';

const manager=fs.readFileSync(new URL('../src/playlist-manager.js',import.meta.url),'utf8');
const retiredHunt=new URL('../src/source-hunt-save-destination.js',import.meta.url);
const favorites=fs.readFileSync(new URL('../src/favorites-ui.js',import.meta.url),'utf8');

assert.equal(
  fs.existsSync(retiredHunt),
  false,
  'retired Source Hunt save-destination caller must remain deleted after zero-consumer proof'
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
  /favoritesOnly\s*:\s*isMyPlaylistCatalog\(\)\s*&&\s*favoritesOnly/,
  'Favorites presentation state must disable Favorites-only filtering outside My Playlist'
);
assert.doesNotMatch(
  favorites,
  /item\.hidden\s*=/,
  'Favorites must not directly own channel-row visibility'
);
assert.match(
  favorites,
  /button\.hidden\s*=\s*!myPlaylist\s*\|\|\s*!id/,
  'Favorite channel action must be hidden outside My Playlist'
);

console.log('My Playlist action ownership PASS');
