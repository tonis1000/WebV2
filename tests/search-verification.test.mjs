import assert from 'node:assert/strict';
import { verifySearchCandidates } from '../src/search/search-verification.js';

const candidates=[
  {candidateId:'hls1',channelName:'ERT1',sourceType:'hls',sourceUrl:'https://stream.test/ert1.m3u8',verificationStatus:'UNVERIFIED'},
  {candidateId:'rtsp1',channelName:'Legacy',sourceType:'rtsp',sourceUrl:'rtsp://stream.test/live',verificationStatus:'UNVERIFIED'},
];
const seen=[];
const verified=await verifySearchCandidates(candidates,{
  verifyImpl:async(items,{onResult})=>{
    assert.deepEqual(items.map(item=>item.candidateId),['hls1'],'unsupported verifier formats must be skipped');
    const result={status:'VERIFIED',verified:true,lastHttpStatus:200,mediaType:'hls',detail:'manifest ok',finalRouteKey:'route_fixture_123',finalTarget:{host:'cdn.test',pathname:'/final.m3u8',queryCount:0,queryKeys:[]},redirects:[{status:302,from:{host:'edge.test',pathname:'/start',queryCount:0,queryKeys:[]},to:{host:'cdn.test',pathname:'/final.m3u8',queryCount:0,queryKeys:[]},hostChanged:true,responseHeaders:{headerNames:['location'],hasSetCookie:false,hasWwwAuthenticate:false}}]};
    onResult?.(result,0,items[0]);
    return [result];
  },
  onResult:item=>seen.push(item),
});
assert.equal(verified.length,1);
assert.equal(verified[0].candidateId,'hls1');
assert.equal(verified[0].verificationStatus,'VERIFIED');
assert.equal(verified[0].lastHttpStatus,200);
assert.equal(seen.length,1);
assert.equal(seen[0].verificationStatus,'VERIFIED');
assert.equal(verified[0].finalRouteKey,'route_fixture_123','Verifier final-route fingerprint must survive the candidate bridge');
assert.equal(verified[0].finalTarget.host,'cdn.test');
assert.equal(verified[0].redirects.length,1,'sanitized redirect provenance must survive verification');

console.log('unified search verifier bridge contract PASS');
