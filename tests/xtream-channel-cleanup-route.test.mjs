import assert from 'node:assert/strict';

if(!globalThis.btoa)globalThis.btoa=value=>Buffer.from(value,'binary').toString('base64');
if(!globalThis.atob)globalThis.atob=value=>Buffer.from(value,'base64').toString('binary');

const { handleXtreamPreviewRoute } = await import('../workers/xtream-preview-routes.js');

const sourceId='xch_cleanupfixture1234';
const channelRows=new Map([[sourceId,{id:sourceId}]]);
let activeReferences=1;

const DB={
  prepare(sql){
    const text=String(sql);
    return{
      bind(...args){
        return{
          async first(){
            if(/JOIN my_playlist/i.test(text)&&/instr\(s\.url, \?\)/i.test(text))return{n:activeReferences};
            if(/SELECT id FROM xtream_channel_sources WHERE id=\?/i.test(text))return channelRows.get(args[0])||null;
            return null;
          },
          async run(){
            if(/DELETE FROM xtream_channel_sources WHERE id=\?/i.test(text))channelRows.delete(args[0]);
            return{success:true};
          },
        };
      },
      async run(){return{success:true};},
      async first(){return null;},
    };
  },
};

const env={
  DB,
  XTREAM_ENCRYPTION_KEY:'phase53-test-encryption-key-that-is-long-enough',
  REGISTRY:{fetch:async()=>new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}})},
};
const trusted={'x-webtv-session':'fixture-session'};

const denied=await handleXtreamPreviewRoute(new Request(`https://webtv-xtream.example/api/channel-sources/${sourceId}`,{method:'DELETE'}),env);
assert.equal(denied.status,401);
assert.equal(channelRows.has(sourceId),true);

const retainedResponse=await handleXtreamPreviewRoute(new Request(`https://webtv-xtream.example/api/channel-sources/${sourceId}`,{method:'DELETE',headers:trusted}),env);
assert.equal(retainedResponse.status,200);
const retained=await retainedResponse.json();
assert.equal(retained.deleted,false);
assert.equal(retained.reason,'still-referenced');
assert.equal(retained.references,1);
assert.equal(channelRows.has(sourceId),true);

activeReferences=0;
const deletedResponse=await handleXtreamPreviewRoute(new Request(`https://webtv-xtream.example/api/channel-sources/${sourceId}`,{method:'DELETE',headers:trusted}),env);
assert.equal(deletedResponse.status,200);
const deleted=await deletedResponse.json();
assert.equal(deleted.deleted,true);
assert.equal(channelRows.has(sourceId),false);

const againResponse=await handleXtreamPreviewRoute(new Request(`https://webtv-xtream.example/api/channel-sources/${sourceId}`,{method:'DELETE',headers:trusted}),env);
assert.equal(againResponse.status,200);
const again=await againResponse.json();
assert.equal(again.deleted,false);
assert.equal(again.reason,'not-found');

const invalid=await handleXtreamPreviewRoute(new Request('https://webtv-xtream.example/api/channel-sources/not-an-xch',{method:'DELETE',headers:trusted}),env);
assert.equal(invalid.status,400);

console.log('Xtream channel cleanup route tests PASS');
