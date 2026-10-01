import assert from 'node:assert/strict';

const {
  previewChoiceBlockReason,
  assertPreviewChoice,
  materializePreviewChannel,
  materializePreviewAccount,
}=await import('../src/xtream-preview-policy.js');

const now=Date.parse('2026-10-01T10:00:00Z');
const expected={id:'mega',originalId:'MEGA',tvgId:'mega.gr',name:'MEGA'};
const candidate={
  candidateId:'cand_preview',channelName:'MEGA',sourceType:'xtream-preview',
  sourceUrl:'https://bridge.test/preview-stream/501.m3u8?t=opaque',
  verificationStatus:'VERIFIED',verified:true,
  xtreamPreviewToken:'opaque-preview-token',xtreamStreamId:'501',
  xtreamPreviewExpiresAt:'2026-10-01T10:10:00Z',
};

assert.equal(previewChoiceBlockReason(candidate,{expectedChannel:expected,currentChannel:expected,now}),'');
assert.equal(previewChoiceBlockReason({...candidate,verificationStatus:'UNVERIFIED',verified:false},{expectedChannel:expected,currentChannel:expected,now}),'Only VERIFIED Xtream previews can be saved');
assert.equal(previewChoiceBlockReason({...candidate,xtreamPreviewToken:''},{expectedChannel:expected,currentChannel:expected,now}),'Xtream preview token is missing');
assert.equal(previewChoiceBlockReason({...candidate,xtreamStreamId:''},{expectedChannel:expected,currentChannel:expected,now}),'Xtream stream ID is missing');
assert.match(previewChoiceBlockReason({...candidate,xtreamPreviewExpiresAt:'2026-10-01T09:59:59Z'},{expectedChannel:expected,currentChannel:expected,now}),/preview expired/i);
assert.match(previewChoiceBlockReason(candidate,{expectedChannel:expected,currentChannel:{id:'skai',name:'SKAI'},now}),/Selected channel changed/);
assert.doesNotThrow(()=>assertPreviewChoice(candidate,{expectedChannel:expected,currentChannel:expected,now}));

let deletedChannel='';
await assert.rejects(()=>materializePreviewChannel(candidate,{
  expectedChannel:expected,currentChannel:expected,now,
  saveChannel:async()=>({id:'xch_demo',streamId:'501',server:'https://provider.test',playbackUrl:'https://bridge.test/channel-stream/xch_demo/501.m3u8?s=signed'}),
  writeDestination:async()=>{throw new Error('destination failed');},
  deleteChannelSource:async id=>{deletedChannel=id;return{deleted:true,id};},
}),/destination failed/);
assert.equal(deletedChannel,'xch_demo','destination failure must compensate the newly materialized channel secret');

let deletedAccount='';
await assert.rejects(()=>materializePreviewAccount(candidate,{
  expectedChannel:expected,currentChannel:expected,now,
  saveAccount:async()=>({id:'xt_demo',name:'Demo',server:'https://provider.test'}),
  writeLibraryEntry:async()=>{throw new Error('library marker failed');},
  deleteAccount:async id=>{deletedAccount=id;},
}),/library marker failed/);
assert.equal(deletedAccount,'xt_demo','library marker failure must compensate the newly saved account');

console.log('Xtream preview neutral policy PASS');
