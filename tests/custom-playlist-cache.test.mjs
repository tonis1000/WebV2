import assert from 'node:assert/strict';
import fs from 'node:fs';
import { savedPlaylistCacheItem } from '../src/saved-playlist-cache-policy.js';

const custom=savedPlaylistCacheItem({id:'pl1',name:'Greek',kind:'custom',channelCount:2,groupCount:1,createdAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-01T10:05:00Z',channels:[{name:'LEAK'}],rawM3u:''},null,1000);
assert.equal(custom.type,'custom');
assert.equal(custom.text,'');
assert.equal(custom.channelCount,2);
assert.equal('channels' in custom,false,'custom child membership must not enter IndexedDB shell');
const source=savedPlaylistCacheItem({id:'pl2',name:'URL',kind:'url',sourceUrl:'https://list.test/a.m3u',rawM3u:'#EXTM3U\n#EXTINF:-1 group-title="G",A\nhttps://a.test/live.m3u8\n',createdAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-01T10:05:00Z'},null,1000);
assert.match(source.text,/#EXTINF/);
assert.equal(source.channelCount,1);

const syncSource=fs.readFileSync(new URL('../src/cloud-read-sync.js',import.meta.url),'utf8');
assert.match(syncSource,/window\.WebTVCloudReadSync\s*=\s*Object\.freeze\(\{[^}]*run\s*:\s*runSync/s,'cloud read sync must expose a bounded run hook so new custom playlist metadata can refresh immediately after D1 writes');

console.log('custom playlist cache policy PASS');
