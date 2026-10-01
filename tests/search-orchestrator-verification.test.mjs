import assert from 'node:assert/strict';
import { runUnifiedSearch } from '../src/search/search-orchestrator.js';

const updates=[];
const adapter={async search({target}){return{candidates:[{candidateId:'c1',channelName:target.name,sourceType:'hls',sourceUrl:'https://stream.test/ert1.m3u8',verificationStatus:'UNVERIFIED'}],leads:[],reports:[]};}};
let verificationStarted=false;
const run=runUnifiedSearch({
  query:'ERT1',
  context:{channels:[{id:'ert1',name:'ERT1'}],groups:[]},
  sources:[{id:'fixture',label:'Fixture',type:'fixture',enabled:true}],
  resolveAdapter:()=>adapter,
  onUpdate:update=>updates.push(update),
  verifyBatch:async(candidates,{onStart,onResult})=>{
    verificationStarted=true;
    assert.equal(candidates[0].verificationStatus,'UNVERIFIED');
    onStart(candidates[0]);
    const verified={...candidates[0],verified:true,verificationStatus:'VERIFIED',lastHttpStatus:200,resolvedMediaFormatId:'hls',browserPlayable:true};
    onResult(verified);
    return [verified];
  },
});
const result=await run.done;
assert.equal(verificationStarted,true);
assert.ok(updates.some(update=>update.snapshot?.candidates?.some(item=>item.verificationStatus==='UNVERIFIED')),'candidate must be visible before verification completes');
assert.ok(updates.some(update=>update.snapshot?.candidates?.some(item=>item.verificationStatus==='VERIFIED')),'same candidate must update progressively after verification');
assert.equal(result.snapshot.candidates[0].verificationStatus,'VERIFIED');
assert.ok(result.report.some(event=>event.type==='verification.started'&&event.candidateId==='c1'));
assert.ok(result.report.some(event=>event.type==='verification.completed'&&event.candidateId==='c1'&&event.severity==='OK'));
assert.ok(result.report.find(event=>event.type==='search.completed').at>=result.report.find(event=>event.type==='verification.completed').at,'search completion must wait for scheduled verification tasks');

console.log('progressive unified search verification integration PASS');
