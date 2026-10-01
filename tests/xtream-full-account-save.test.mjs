import assert from 'node:assert/strict';

globalThis.window={};
globalThis.localStorage={getItem:()=>'',setItem(){},removeItem(){}};

const mod=await import('../src/xtream-full-account-save.js');
const {buildXtreamLibraryMarker,saveVerifiedFullXtreamAccount}=mod;

const candidate={
  sourceType:'xtream-preview',verificationStatus:'VERIFIED',verified:true,
  xtreamPreviewToken:'opaque-preview-token',xtreamStreamId:'501',channelName:'MEGA',
  xtreamPreviewExpiresAt:new Date(Date.now()+5*60*1000).toISOString(),
};
const identity={id:'mega',originalId:'MEGA',tvgId:'mega.gr',name:'MEGA'};
const preview={
  account:{name:'Provider A',server:'https://provider.invalid'},
  channels:[
    {streamId:'501',name:'MEGA',logo:'https://img.invalid/mega.png',group:'Greece',categoryId:'10',tvgId:'mega.gr'},
    {streamId:'502',name:'SKAI',logo:'',group:'Greece',categoryId:'10',tvgId:'skai.gr'},
    {streamId:'700',name:'SPORT 1',logo:'',group:'Sports',categoryId:'20',tvgId:'sport1'},
  ],
};

const marker=buildXtreamLibraryMarker({account:{id:'xt_saved',name:'Provider A',server:'https://provider.invalid'},preview,name:'My Provider'});
assert.equal(marker.kind,'xtream');
assert.equal(marker.sourceUrl,'xtream:xt_saved');
assert.equal(marker.channelCount,3);
assert.equal(marker.groupCount,2);
assert.match(marker.rawM3u,/#EXT-X-WEBTV-XTREAM-ACCOUNT:xt_saved/);
assert.equal(/opaque-preview-token|username|password/i.test(JSON.stringify(marker)),false,'library marker must not contain preview token or credentials');
assert.equal(marker.channels,undefined,'full provider catalog must not be flattened into the library marker');
assert.deepEqual(marker.sampleMetadata,{streamId:'501',name:'MEGA',logo:'https://img.invalid/mega.png',group:'Greece',categoryId:'10',tvgId:'mega.gr'});
assert.equal('country' in marker.sampleMetadata,false,'country must not be invented');

let accountWrites=0;let libraryWrites=0;let deletes=0;
const result=await saveVerifiedFullXtreamAccount({candidate,expectedChannel:identity,currentChannel:identity,preview,name:'My Provider'}, {
  saveAccount:async(token,{name})=>{accountWrites++;assert.equal(token,'opaque-preview-token');assert.equal(name,'My Provider');return{id:'xt_saved',name:'Provider A',server:'https://provider.invalid'};},
  writeLibraryEntry:async(entry)=>{libraryWrites++;assert.equal(entry.sourceUrl,'xtream:xt_saved');assert.equal(entry.channelCount,3);return{id:entry.id};},
  deleteAccount:async()=>{deletes++;},
});
assert.equal(accountWrites,1);
assert.equal(libraryWrites,1);
assert.equal(deletes,0);
assert.equal(result.account.id,'xt_saved');
assert.equal(result.entry.kind,'xtream');

await assert.rejects(()=>saveVerifiedFullXtreamAccount({candidate,expectedChannel:identity,currentChannel:identity,preview,name:'Broken'}, {
  saveAccount:async()=>({id:'xt_orphan',name:'Broken',server:'https://provider.invalid'}),
  writeLibraryEntry:async()=>{throw new Error('registry write failed');},
  deleteAccount:async(id)=>{deletes++;assert.equal(id,'xt_orphan');},
}),/registry write failed/);
assert.equal(deletes,1,'failed library marker write must compensate the newly-created account exactly once');

await assert.rejects(()=>saveVerifiedFullXtreamAccount({candidate:{...candidate,verified:false,verificationStatus:'UNVERIFIED'},expectedChannel:identity,currentChannel:identity,preview,name:'Nope'}, {
  saveAccount:async()=>{throw new Error('must not write');},
  writeLibraryEntry:async()=>{throw new Error('must not write');},
}),/Only VERIFIED Xtream previews can be saved/);

console.log('Xtream full-account save tests PASS');
