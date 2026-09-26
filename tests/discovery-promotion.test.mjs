import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.window={};
globalThis.localStorage={getItem:()=>'',setItem(){},removeItem(){}};

const { promotionBlockReason, promoteCandidate, keepXtreamAccount, canPromoteCandidate } = await import('../src/discovery/promotion.js');

const expectedChannel={id:'mega',originalId:'MEGA',tvgId:'mega.gr',name:'MEGA'};
const verified={
  candidateId:'cand_ok',channelName:'MEGA',sourceType:'hls',sourceUrl:'https://example.invalid/mega.m3u8',candidateKind:'media',saveEligible:true,
  requiredHeaders:{},verificationStatus:'VERIFIED',verified:true,
};

assert.equal(canPromoteCandidate(verified,expectedChannel,{id:'mega',name:'MEGA'}),true);
assert.equal(promotionBlockReason({...verified,verificationStatus:'UNVERIFIED',verified:false},expectedChannel,expectedChannel),'Only VERIFIED candidates can be added');
assert.equal(promotionBlockReason({...verified,saveEligible:false},expectedChannel,expectedChannel),'This candidate is not eligible for My Playlist');
assert.equal(promotionBlockReason({...verified,candidateKind:'official-page'},expectedChannel,expectedChannel),'This candidate is not eligible for My Playlist');
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

const source=fs.readFileSync(new URL('../src/discovery/promotion.js',import.meta.url),'utf8');
assert.equal(source.includes('saveXtreamAccount'),false,'promotion layer must not request or rewrite Xtream credentials');
assert.equal(/password/i.test(source),false,'promotion layer must not handle Xtream passwords');
assert.match(source,/saveBestSourceToCurrent/);
assert.match(source,/listXtreamAccounts/);

console.log('Discovery promotion tests PASS');
