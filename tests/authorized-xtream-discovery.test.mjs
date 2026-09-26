import assert from 'node:assert/strict';
import {
  discoverAuthorizedXtream,
  matchesAuthorizedXtreamChannel,
  AUTHORIZED_XTREAM_DISCOVERY_PROVIDER,
  AUTHORIZED_XTREAM_MAX_ACCOUNTS,
  AUTHORIZED_XTREAM_MAX_STREAMS_PER_ACCOUNT,
  AUTHORIZED_XTREAM_MAX_CANDIDATES,
} from '../src/discovery/authorized-xtream.js';

assert.equal(AUTHORIZED_XTREAM_DISCOVERY_PROVIDER,'authorized-xtream-expansion');
assert.equal(AUTHORIZED_XTREAM_MAX_ACCOUNTS,3);
assert.equal(AUTHORIZED_XTREAM_MAX_STREAMS_PER_ACCOUNT,5000);
assert.equal(AUTHORIZED_XTREAM_MAX_CANDIDATES,8);
assert.equal(matchesAuthorizedXtreamChannel({name:'MEGA'},{name:'MEGA HD'}),true);
assert.equal(matchesAuthorizedXtreamChannel({name:'MEGA'},{name:'MEGA News'}),false);

const accounts=[
  {id:'xt_a',name:'Provider A',server:'https://provider-a.invalid'},
  {id:'xt_b',name:'Provider B',server:'https://provider-b.invalid'},
  {id:'xt_c',name:'Provider C',server:'https://provider-c.invalid'},
  {id:'xt_d',name:'Provider D',server:'https://provider-d.invalid'},
];
const calls=[];
const result=await discoverAuthorizedXtream({name:'MEGA',id:'mega'}, {
  listAccounts:async()=>accounts,
  loadChannels:async accountId=>{
    calls.push(accountId);
    return {
      account:{id:accountId,server:`https://${accountId}.invalid`},
      channels:[
        {name:'MEGA HD',tvgId:'mega.gr',streamId:`${accountId}-101`,playbackUrl:`https://webtv-xtream.example/stream/${accountId}/101.m3u8?s=opaque`},
        {name:'MEGA News',tvgId:'mega.news',streamId:`${accountId}-999`,playbackUrl:`https://webtv-xtream.example/stream/${accountId}/999.m3u8?s=opaque`},
      ],
    };
  },
});

assert.deepEqual(calls,['xt_a','xt_b','xt_c'],'account expansion must be capped at three authorized accounts');
assert.equal(result.provider,AUTHORIZED_XTREAM_DISCOVERY_PROVIDER);
assert.equal(result.candidates.length,3);
for(const candidate of result.candidates){
  assert.equal(candidate.sourceType,'xtream');
  assert.equal(candidate.verificationStatus,'UNVERIFIED');
  assert.equal(candidate.matchConfidence,'HIGH');
  assert.ok(candidate.xtreamAccountRef);
  assert.ok(candidate.xtreamStreamId);
  assert.equal(candidate.xtreamContext.username,'');
  assert.equal(candidate.xtreamContext.password,'');
  assert.match(candidate.sourceUrl,/webtv-xtream\.example\/stream\//);
}
const serialized=JSON.stringify(result);
assert.equal(serialized.includes('test_pass'),false);
assert.equal(serialized.includes('username_enc'),false);
assert.equal(serialized.includes('password_enc'),false);

const controller=new AbortController();controller.abort(new DOMException('cancelled','AbortError'));
await assert.rejects(()=>discoverAuthorizedXtream({name:'MEGA'},{signal:controller.signal,listAccounts:async()=>accounts,loadChannels:async()=>({channels:[]})}),error=>error?.name==='AbortError');

console.log('authorized Xtream discovery tests PASS');
