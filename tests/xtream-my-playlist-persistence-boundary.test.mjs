import assert from 'node:assert/strict';
import fs from 'node:fs';

const manager=fs.readFileSync(new URL('../src/playlist-manager.js',import.meta.url),'utf8');
const destination=fs.readFileSync(new URL('../src/xtream-save-destination.js',import.meta.url),'utf8');

assert.match(destination,/upsertChannel\(channel,sources,\{replaceSources:false,reason:'xtream-preview-save'\}\)/,'canonical Xtream My Playlist save must use the narrow upsertChannel API');
assert.match(manager,/isLoadedXtreamChannel\s*\(channel\)/,'Playlist Manager must identify channels from the currently loaded Xtream account');
assert.match(manager,/assertGenericMyMutationAllowed\s*\(channel\)/,'generic My Playlist mutations must share one Xtream boundary guard');
assert.match(manager,/Use Xtream Test \/ Preview[^'"]*Save Channel/,'blocked generic Xtream persistence must tell the user to use the verified Save Channel flow');

const addBlock=manager.split('async function addMyChannel(channel)')[1]?.split('async function removeMyChannel(channel)')[0]||'';
assert.match(addBlock,/assertGenericMyMutationAllowed\s*\(channel\)/,'generic Add to My Playlist must reject loaded Xtream account channels');

const apiBlock=manager.split('window.WebTVMyPlaylistAPI=')[1]||'';
assert.match(apiBlock,/upsertChannel\s*:/,'My Playlist API must expose canonical upsertChannel');
assert.match(apiBlock,/reason\s*=\s*['"]xtream-preview-save['"]|xtream-preview-save/,'canonical upsert path must preserve verified-save reason ownership');

const upsertBlock=manager.split('async function upsertMyChannel(')[1]?.split('window.WebTVMyPlaylistAPI=')[0]||'';
assert.match(upsertBlock,/reason\s*!==\s*['"]xtream-preview-save['"]/,'upsertMyChannel must reject callers outside the verified Xtream preview flow');
assert.match(upsertBlock,/sources/,'verified upsert must preserve explicit source objects');
assert.match(upsertBlock,/putRegistryChannel/,'verified upsert must use the existing My Playlist Registry owner');

console.log('Xtream My Playlist persistence boundary PASS');
