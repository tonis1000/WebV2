import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collectKnownSources } from '../src/known-source-collector.js';

const mega={id:'mega',originalId:'MEGA',tvgId:'mega.gr',name:'MEGA'};
const selected={url:'https://xtream.example/channel-stream/xch_a/501.m3u8?s=one',origin:'xtream'};
const result=collectKnownSources(mega,{
  selectedSource:selected,
  myPlaylist:[{...mega,directUrls:['https://m3u.example/mega.m3u8',selected.url]}],
  customPlaylists:[
    {id:'greek',channels:[{...mega,sources:[{url:'https://backup.example/mega.m3u8',origin:'custom'}]}]},
    {id:'wrong',channels:[{id:'skai',name:'SKAI',sources:[{url:'https://wrong.example/skai.m3u8'}]}]},
  ],
  loadedCatalog:[{...mega,directUrls:['https://loaded.example/mega.m3u8']},{id:'skai',name:'SKAI',directUrls:['https://wrong.example/skai2.m3u8']}],
});
assert.equal(result[0].url,selected.url,'selected permanent source must remain first');
assert.equal(result.filter(row=>row.url===selected.url).length,1,'selected source must dedupe');
assert.deepEqual(new Set(result.map(row=>row.url)),new Set([
  selected.url,
  'https://m3u.example/mega.m3u8',
  'https://backup.example/mega.m3u8',
  'https://loaded.example/mega.m3u8',
]));
assert.equal(result.some(row=>row.url.includes('wrong.example')),false,'different channel sources must never merge');

// Regression from the production browser proof: My Playlist normalizes its local
// row id for rendering while preserving the provider identity in originalId.
// All-known must still recognize the row as the same unprofiled channel.
const providerChannel={
  streamId:'5000001',
  tvgId:'webtv.test.5000.0001',
  name:'WebTV 5000 Channel 0001',
};
const providerSelected={
  url:'https://xtream.example/channel-stream/xch_scale/5000001.m3u8?s=one',
  origin:'xtream',
};
const unprofiledResult=collectKnownSources(providerChannel,{
  selectedSource:providerSelected,
  myPlaylist:[{
    id:'webtv-test-5000-0001',
    originalId:'webtv.test.5000.0001',
    name:'WebTV 5000 Channel 0001',
    directUrls:['https://known.example/webtv.test.5000.0001.m3u8'],
  }],
});
assert.deepEqual(unprofiledResult.map(row=>row.url),[
  providerSelected.url,
  'https://known.example/webtv.test.5000.0001.m3u8',
],'all-known must merge a My Playlist source when only the local rendered id was normalized differently');

const source=fs.readFileSync(new URL('../src/known-source-collector.js',import.meta.url),'utf8');
for(const forbidden of ['search-orchestrator','external-discovery-client','local-data-reader','source-hunt','fetch(']){
  assert.equal(source.includes(forbidden),false,`known-source collector must not depend on ${forbidden}`);
}
console.log('known source collector PASS');
