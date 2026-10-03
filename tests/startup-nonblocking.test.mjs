import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
const favorites = readFileSync(path.join(ROOT, 'src/favorites-ui.js'), 'utf8');
const playlistManager = readFileSync(path.join(ROOT, 'src/playlist-manager.js'), 'utf8');
const cloudReadSync = readFileSync(path.join(ROOT, 'src/cloud-read-sync.js'), 'utf8');

const bootMatch = main.match(/async function boot\(\)\{([\s\S]*?)\n\}/);
assert.ok(bootMatch, 'main.js must expose the boot function');
const boot = bootMatch[1];

const sourceRefresh = boot.indexOf('sources.refresh()');
const playlistAwait = boot.indexOf("await loadCloudMyPlaylist({reason:'startup',preserveSelection:false})");
const readyFlag = boot.indexOf('window.WebTVPlaylistAPI.ready=true');
const readyEvent = boot.indexOf("window.dispatchEvent(new CustomEvent('webtv:ready'))");
const epgAwait = boot.indexOf('await epgTask');

assert.ok(sourceRefresh >= 0, 'boot must still start the remote Source Registry refresh');
assert.ok(playlistAwait > sourceRefresh, 'remote Source Registry refresh should start in parallel before the D1 playlist completes');
assert.ok(readyFlag > playlistAwait, 'the app should become ready only after the D1 My Playlist is loaded');
assert.ok(readyEvent > readyFlag, 'webtv:ready must be emitted after the ready flag is set');
assert.ok(epgAwait > readyEvent, 'EPG completion must not block webtv:ready');
assert.doesNotMatch(boot, /await\s+sourceTask\b/, 'remote Source Registry must never block initial interactivity');
assert.doesNotMatch(boot, /const\s+sourceTask\s*=\s*sources\.refresh\(\)/, 'boot should not create a Source Registry promise that is later awaited');
assert.match(boot, /sources\.refresh\(\)[\s\S]*?\.then\(\(\)=>\{[\s\S]*?if\(window\.WebTVPlaylistAPI\?\.ready\)renderChannels\(\)/, 'background Source Registry completion should refresh channel route counts after startup');


const cachedPlaylistRead = boot.indexOf('const cachedPlaylist=loadStartupMyPlaylistCache()');
const cachedPlaylistPaint = boot.indexOf('applyCachedStartupPlaylist(cachedPlaylist)');
assert.ok(cachedPlaylistRead >= 0, 'boot must read the last successful D1 My Playlist cache for fast presentation');
assert.ok(cachedPlaylistPaint > cachedPlaylistRead, 'boot must paint the cached My Playlist after reading it');
assert.ok(cachedPlaylistPaint < playlistAwait, 'cached My Playlist presentation must happen before awaiting the live D1 playlist');
assert.ok(readyFlag > playlistAwait, 'cached presentation must never make the app authoritative-ready before live D1 succeeds');
assert.match(main, /function loadStartupMyPlaylistCache\(\)[\s\S]*?JSON\.parse\([\s\S]*?MY_PLAYLIST_STARTUP_CACHE_KEY/, 'main must expose a bounded local startup cache reader');
assert.match(main, /function saveStartupMyPlaylistCache\(rows\)[\s\S]*?localStorage\.setItem\(MY_PLAYLIST_STARTUP_CACHE_KEY/, 'main must persist only the last successful cloud My Playlist snapshot as startup cache');
assert.match(main, /async function loadCloudMyPlaylist[\s\S]*?const remote=await fetchCloudMyPlaylist\(\);[\s\S]*?saveStartupMyPlaylistCache\(remote\)/, 'a successful D1 My Playlist fetch must refresh the startup cache');

const favoritesReady = favorites.match(/window\.addEventListener\('webtv:ready',[^;]+;/)?.[0] || '';
assert.ok(favoritesReady, 'Favorites must react to webtv:ready');
assert.doesNotMatch(favoritesReady, /loadCloud\s*\(/, 'webtv:ready must not trigger a second Favorites cloud read');
assert.equal((favorites.match(/loadCloud\(\)\.then\(/g) || []).length, 1, 'Favorites must start exactly one initial cloud read');
assert.doesNotMatch(favorites, /for\(const id of load\(\)\)set\.add\(id\)/, 'A successful D1 Favorites read must replace stale local favorites instead of unioning them back in');
assert.match(favorites, /const j=await r\.json\(\),set=new Set\(\(j\.favorites\|\|\[\]\)\.map\(String\)\);\s*save\(set\);cloudReady=true;return set;/, 'A successful D1 Favorites read must persist the exact D1 set as the local cache');

const sharedHelper = playlistManager.match(/function initialMyPlaylistFromApp\(\)\{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(sharedHelper, 'Playlist Manager must expose a startup cache reuse helper');
assert.match(sharedHelper, /bridge\?\.ready/, 'Playlist Manager may reuse startup data only after the main playlist API is ready');
assert.match(sharedHelper, /getCatalogMode\?\.\(\)!=='cloud'/, 'Playlist Manager may reuse startup data only for the cloud D1 catalog');
assert.match(sharedHelper, /bridge\.getChannels\?\.\(\)/, 'Playlist Manager must reuse the channels already loaded by main.js');
const playlistStartup = playlistManager.match(/async function startup\(\)\{[^\n]+\}/)?.[0] || '';
assert.ok(playlistStartup, 'Playlist Manager must expose startup');
assert.match(playlistStartup, /const shared=initialMyPlaylistFromApp\(\)/, 'Playlist Manager startup must try the shared main cache first');
assert.match(playlistStartup, /myCache=shared\|\|await fetchMyPlaylist\(\)/, 'Playlist Manager startup must fall back to D1 when shared cache reuse is unavailable');

const savedSyncStarter = cloudReadSync.match(/function startInitialSync\(\)\{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(savedSyncStarter, 'Saved Playlists cloud sync must expose a deferred startup helper');
assert.match(savedSyncStarter, /window\.WebTVPlaylistAPI\?\.ready/, 'Saved Playlists sync may run immediately only if the main app is already ready');
assert.match(savedSyncStarter, /window\.addEventListener\('webtv:ready'/, 'Saved Playlists initial sync must wait for webtv:ready when the app is still booting');
assert.equal((savedSyncStarter.match(/runSync\('startup', \{ force:true \}\)/g) || []).length, 2, 'Deferred startup helper must cover both already-ready and future-ready paths');
const cloudSyncTail = cloudReadSync.slice(cloudReadSync.indexOf('window.WebTVSavedPlaylistsReadAPI'));
assert.match(cloudSyncTail, /startInitialSync\(\);/, 'Saved Playlists sync must start through the deferred helper');
assert.doesNotMatch(cloudSyncTail.replace(savedSyncStarter, ''), /^\s*runSync\('startup', \{ force:true \}\);/m, 'Saved Playlists sync must not issue a bare pre-ready startup request');

const staleHelperSource = cloudReadSync.match(/function staleLocalPlaylistIds\(localRows=\[\],remoteRows=\[\],syncStartedAt=Date\.now\(\)\)\{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(staleHelperSource, 'Saved Playlist sync must expose stale local reconciliation logic');
const staleLocalPlaylistIds = Function(`${staleHelperSource}; return staleLocalPlaylistIds;`)();
const syncStartedAt = 1000;
const localRows = [
  { id:'keep', updatedAt:100 },
  { id:'deleted', updatedAt:100 },
  { id:'fresh-concurrent', updatedAt:1000 },
  { id:'__my_playlist__', updatedAt:1 },
  { id:'legacy-no-time' },
];
const remoteRows = [{ id:'keep' }];
assert.deepEqual(staleLocalPlaylistIds(localRows, remoteRows, syncStartedAt), ['deleted','legacy-no-time'], 'D1-absent stale cache entries should be removed while remote, protected, and concurrent fresh rows survive');
assert.match(cloudReadSync, /const staleIds=staleLocalPlaylistIds\(localRows,remoteRows,syncStartedAt\);\s*const removed=await removeSavedCached\(staleIds\);/, 'Saved Playlist sync must apply stale reconciliation before refreshing remote rows');

console.log('startup non-blocking regression: PASS');
