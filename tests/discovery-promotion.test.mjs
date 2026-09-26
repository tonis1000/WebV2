import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.window={};
globalThis.localStorage={getItem:()=>'',setItem(){},removeItem(){}};

const { promotionBlockReason, previewChoiceBlockReason, promoteCandidate, keepXtreamAccount, promotePreviewXtreamChannel, saveFullXtreamAccountFromCandidate, canPromoteCandidate, canChoosePreviewXtream } = await import('../src/discovery/promotion.js');

const expectedChannel={id:'mega',originalId:'MEGA',tvgId:'mega.gr',name:'MEGA'};
const verified={
  candidateId:'cand_ok',channelName:'MEGA',sourceType:'hls',sourceUrl:'https://example.invalid/mega.m3u8',candidateKind:'media',saveEligible:true,
  requiredHeaders:{},verificationStatus:'VERIFIED',verified:true,
};

assert.equal(canPromoteCandidate(verified,expectedChannel,{id:'mega',name:'MEGA'}),true);
assert.equal(promotionBlockReason({...verified,verificationStatus:'UNVERIFIED',verified:false},expectedChannel,expectedChannel),'Only VERIFIED candidates can be added');
assert.equal(promotionBlockReason({...verified,saveEligible:false},expectedChannel,expectedChannel),'This candidate is not eligible for My Playlist');
assert.equal(promotionBlockReason({...verified,candidateKind:'official-page'},expectedChannel,expectedChannel),'Official fallback pages cannot be saved as media sources');
assert.equal(promotionBlockReason({...verified,requiredHeaders:{Referer:'https://example.invalid/'}},expectedChannel,expectedChannel),'Persistent request-header metadata is not supported yet');
assert.match(promotionBlockReason(verified,expectedChannel,{id:'skai',name:'SKAI'}),/Selected channel changed/);

let saveCalls=0;
const promoted=await promoteCandidate(verified,{
  expectedChannel,
  getCurrentChannel:()=>({id:'mega',name:'MEGA'}),
  saveSource:async(url,options)=>{saveCalls++;assert.equal(url,verified.sourceUrl);assert.equal(options.maxSources,3);return{winner:url,kept:[url],dropped:[]};},
});
assert.equal(saveCalls,1);
assert.equal(promoted.kind,'source');
assert.equal(promoted.result.kept.length,1);
await assert.rejects(()=>promoteCandidate(verified,{expectedChannel,getCurrentChannel:()=>({id:'skai',name:'SKAI'}),saveSource:async()=>{throw new Error('must not run');}}),/Selected channel changed/);

const xtream={...verified,candidateId:'cand_xt',sourceType:'xtream',sourceUrl:'https://webtv-xtream.atonis.workers.dev/stream/xt_demo/1101.m3u8?s=opaque',xtreamAccountRef:'xt_demo',xtreamStreamId:'1101'};
const kept=await keepXtreamAccount(xtream,{listAccounts:async()=>[{id:'xt_demo',name:'Provider A',server:'https://provider.invalid'}]});
assert.deepEqual(kept,{kind:'xtream-account',state:'already-saved',account:{id:'xt_demo',name:'Provider A',server:'https://provider.invalid'}});
await assert.rejects(()=>keepXtreamAccount({...xtream,xtreamAccountRef:'missing'},{listAccounts:async()=>[{id:'xt_demo'}]}),/no longer stored/);
await assert.rejects(()=>keepXtreamAccount({...verified,sourceType:'hls'}),/Xtream candidate required/);

const preview={
  ...verified,
  candidateId:'cand_preview',
  sourceType:'xtream-preview',
  sourceUrl:'https://webtv-xtream.atonis.workers.dev/preview-stream/501.m3u8?t=opaque',
  candidateKind:'xtream-preview',
  saveEligible:false,
  xtreamPreviewToken:'opaque-preview-token',
  xtreamStreamId:'501',
  xtreamPreviewServer:'https://provider.invalid',
  xtreamPreviewExpiresAt:new Date(Date.now()+5*60*1000).toISOString(),
};
assert.match(promotionBlockReason(preview,expectedChannel,expectedChannel),/explicit Xtream preview choice/);
assert.equal(canChoosePreviewXtream(preview,expectedChannel,expectedChannel),true);
assert.equal(previewChoiceBlockReason({...preview,verificationStatus:'UNVERIFIED',verified:false},expectedChannel,expectedChannel),'Only VERIFIED Xtream previews can be saved');
assert.match(previewChoiceBlockReason(preview,expectedChannel,{id:'skai',name:'SKAI'}),/Selected channel changed/);
assert.match(previewChoiceBlockReason({...preview,xtreamPreviewExpiresAt:new Date(Date.now()-1000).toISOString()},expectedChannel,expectedChannel),/preview expired/);

let channelSecretWrites=0;let playlistWrites=0;
const channelResult=await promotePreviewXtreamChannel(preview,{
  expectedChannel,
  getCurrentChannel:()=>expectedChannel,
  saveChannel:async(token,streamId,{name})=>{channelSecretWrites++;assert.equal(token,'opaque-preview-token');assert.equal(streamId,'501');assert.equal(name,'MEGA');return{id:'xch_demo',streamId:'501',server:'https://provider.invalid',playbackUrl:'https://webtv-xtream.atonis.workers.dev/channel-stream/xch_demo/501.m3u8?s=signed'};},
  saveSource:async(url,{maxSources})=>{playlistWrites++;assert.match(url,/\/channel-stream\/xch_demo\/501\.m3u8/);assert.equal(maxSources,3);return{winner:url,kept:[url],dropped:[]};},
});
assert.equal(channelSecretWrites,1);
assert.equal(playlistWrites,1);
assert.equal(channelResult.kind,'xtream-channel');
assert.match(channelResult.source.playbackUrl,/channel-stream/);

let fullAccountWrites=0;
const fullResult=await saveFullXtreamAccountFromCandidate(preview,{
  expectedChannel,
  getCurrentChannel:()=>expectedChannel,
  saveAccount:async(token)=>{fullAccountWrites++;assert.equal(token,'opaque-preview-token');return{id:'xt_new',name:'Provider New',server:'https://provider.invalid'};},
});
assert.equal(fullAccountWrites,1);
assert.deepEqual(fullResult,{kind:'xtream-account',state:'saved',account:{id:'xt_new',name:'Provider New',server:'https://provider.invalid'}});

const source=fs.readFileSync(new URL('../src/discovery/promotion.js',import.meta.url),'utf8');
assert.equal(/\bpassword\b/i.test(source),false,'promotion layer must never handle a raw Xtream password');
assert.equal(/\busername\b/i.test(source),false,'promotion layer must never handle a raw Xtream username');
assert.match(source,/saveBestSourceToCurrent/);
assert.match(source,/saveXtreamChannelFromPreview/);
assert.match(source,/saveXtreamAccountFromPreview/);

console.log('Discovery promotion tests PASS');
