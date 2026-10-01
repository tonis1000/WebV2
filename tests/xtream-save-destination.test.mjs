import assert from 'node:assert/strict';
import { saveVerifiedXtreamChannel } from '../src/xtream-save-destination.js';

const candidate={
  candidateId:'cand_preview',channelName:'MEGA',sourceType:'xtream-preview',
  sourceUrl:'https://bridge.test/preview-stream/501.m3u8?t=opaque',verificationStatus:'VERIFIED',verified:true,
  xtreamPreviewToken:'opaque-preview-token',xtreamStreamId:'501',xtreamPreviewExpiresAt:new Date(Date.now()+600000).toISOString(),
};
const channel={id:'mega',originalId:'MEGA',tvgId:'mega.gr',name:'MEGA',group:'Γενικά'};
const permanent={id:'xch_demo',streamId:'501',server:'https://provider.test',playbackUrl:'https://bridge.test/channel-stream/xch_demo/501.m3u8?s=signed'};

async function run(destination,sourceScope='selected',overrides={}){
  const calls=[];
  const result=await saveVerifiedXtreamChannel({candidate,channel,destination,sourceScope,deps:{
    saveChannel:async()=>{calls.push(['saveChannel']);return permanent;},
    deleteChannelSource:async id=>{calls.push(['deleteChannelSource',id]);return{deleted:true};},
    writeMyPlaylist:async(ch,sources)=>{calls.push(['my',ch.id,sources.map(s=>s.url)]);return{ok:true};},
    createCustomPlaylist:async({name})=>{calls.push(['createCustom',name]);return{id:'newpl',name,kind:'custom'};},
    deleteCustomPlaylist:async id=>{calls.push(['deleteCustom',id]);},
    writeCustomChannel:async(id,ch,sources)=>{calls.push(['custom',id,ch.id,sources.map(s=>s.url)]);return{ok:true};},
    getKnownContext:async()=>({
      myPlaylist:[{...channel,directUrls:['https://known.example/m3u.m3u8']}],
      customPlaylists:[{id:'backup',channels:[{...channel,sources:[{url:'https://known.example/backup.m3u8'}]}]}],
      loadedCatalog:[],
    }),
    ...overrides,
  }});
  return{result,calls};
}

let x=await run({kind:'my'});
assert.deepEqual(x.calls.find(c=>c[0]==='my')[2],[permanent.playbackUrl]);
x=await run({kind:'custom',playlistId:'greek'});
assert.deepEqual(x.calls.find(c=>c[0]==='custom').slice(1,3),['greek','mega']);
x=await run({kind:'new-custom',name:'Greek'});
assert.ok(x.calls.some(c=>c[0]==='createCustom'));
assert.ok(x.calls.some(c=>c[0]==='custom'&&c[1]==='newpl'));
x=await run({kind:'custom',playlistId:'backup'},'all-known');
const urls=x.calls.find(c=>c[0]==='custom')[3];
assert.deepEqual(new Set(urls),new Set([permanent.playbackUrl,'https://known.example/m3u.m3u8','https://known.example/backup.m3u8']));

let cleaned='';
await assert.rejects(()=>run({kind:'custom',playlistId:'broken'},'selected',{
  writeCustomChannel:async()=>{throw new Error('destination exploded');},
  deleteChannelSource:async id=>{cleaned=id;},
}),/destination exploded/);
assert.equal(cleaned,'xch_demo','materialized source must be compensated when destination write fails');

let deletedParent='';cleaned='';
await assert.rejects(()=>run({kind:'new-custom',name:'Broken'},'selected',{
  writeCustomChannel:async()=>{throw new Error('child write failed');},
  deleteCustomPlaylist:async id=>{deletedParent=id;},
  deleteChannelSource:async id=>{cleaned=id;},
}),/child write failed/);
assert.equal(deletedParent,'newpl','new empty custom parent must be compensated');
assert.equal(cleaned,'xch_demo');

const stores=new Map();
const isolationDeps={
  saveChannel:async()=>permanent,deleteChannelSource:async()=>{},
  writeMyPlaylist:async()=>{},createCustomPlaylist:async()=>{throw new Error('unused');},deleteCustomPlaylist:async()=>{},
  writeCustomChannel:async(id,_ch,sources)=>{stores.set(id,sources.map(s=>s.url));},
  getKnownContext:async()=>({myPlaylist:[],customPlaylists:[{id:'backup',channels:[{...channel,sources:[{url:'https://b.example/mega.m3u8'}]}]}],loadedCatalog:[]}),
};
await saveVerifiedXtreamChannel({candidate,channel,destination:{kind:'custom',playlistId:'greek'},sourceScope:'selected',deps:isolationDeps});
await saveVerifiedXtreamChannel({candidate,channel,destination:{kind:'custom',playlistId:'backup'},sourceScope:'all-known',deps:isolationDeps});
assert.deepEqual(stores.get('greek'),[permanent.playbackUrl]);
assert.deepEqual(new Set(stores.get('backup')),new Set([permanent.playbackUrl,'https://b.example/mega.m3u8']));

console.log('Xtream save destination PASS');
