import assert from 'node:assert/strict';

const { diffRemovedUrls, extractXtreamChannelSourceIds, cleanupRemovedXtreamChannelSources } = await import('../src/xtream-channel-lifecycle.js');

const bridgeBase='https://webtv-xtream.example';
const a='https://webtv-xtream.example/channel-stream/xch_abcdefgh12345678/501.m3u8?s=one';
const b='https://webtv-xtream.example/channel-stream/xch_ijklmnop87654321/777.m3u8?s=two';
const duplicate='https://webtv-xtream.example/channel-stream/xch_abcdefgh12345678/501.m3u8?s=other';
const foreign='https://foreign.example/channel-stream/xch_foreign12345678/999.m3u8?s=nope';

assert.deepEqual(diffRemovedUrls([a,b,'https://plain.example/live.m3u8'],[a,'https://plain.example/live.m3u8']),[b]);
assert.deepEqual(extractXtreamChannelSourceIds([a,duplicate,b,foreign,'bad'],{bridgeBase}),['xch_abcdefgh12345678','xch_ijklmnop87654321']);

const calls=[];
const result=await cleanupRemovedXtreamChannelSources([a,duplicate,b,foreign],{
  bridgeBase,
  deleteSource:async id=>{
    calls.push(id);
    if(id==='xch_abcdefgh12345678')return{deleted:true,id};
    return{deleted:false,id,reason:'still-referenced',references:2};
  },
});
assert.deepEqual(calls,['xch_abcdefgh12345678','xch_ijklmnop87654321']);
assert.deepEqual(result.cleaned,['xch_abcdefgh12345678']);
assert.deepEqual(result.retained,[{id:'xch_ijklmnop87654321',reason:'still-referenced',references:2}]);
assert.deepEqual(result.failed,[]);

const failure=await cleanupRemovedXtreamChannelSources([a],{
  bridgeBase,
  deleteSource:async()=>{throw new Error('bridge unavailable');},
});
assert.equal(failure.failed.length,1);
assert.equal(failure.failed[0].error,'bridge unavailable');

console.log('Xtream channel lifecycle tests PASS');
