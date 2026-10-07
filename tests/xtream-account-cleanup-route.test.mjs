import assert from 'node:assert/strict';

const worker=(await import('../workers/webtv-xtream.js')).default;

const accountId='xt_cleanupfixture';
const accountRows=new Map([[accountId,{id:accountId,name:'test',server:'https://provider.invalid'}]]);
let myReferences=1;
let customReferences=0;

const DB={
  prepare(sql){
    const text=String(sql);
    return{
      bind(...args){
        return{
          async first(){
            if(/SELECT id FROM xtream_accounts WHERE id=\?/i.test(text))return accountRows.get(args[0])||null;
            if(/JOIN my_playlist/i.test(text)&&/instr\(s\.url, \?\)/i.test(text))return{n:myReferences};
            if(/FROM playlist_channel_sources/i.test(text)&&/instr\(url, \?\)/i.test(text))return{n:customReferences};
            return null;
          },
          async run(){
            if(/DELETE FROM xtream_accounts WHERE id=\?/i.test(text))accountRows.delete(args[0]);
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
  REGISTRY:{fetch:async()=>new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}})},
};
const trusted={'x-webtv-session':'fixture-session'};

const retainedResponse=await worker.fetch(new Request(`https://webtv-xtream.example/api/accounts/${accountId}`,{method:'DELETE',headers:trusted}),env);
assert.equal(retainedResponse.status,200);
let retained=await retainedResponse.json();
assert.equal(retained.deleted,false);
assert.equal(retained.reason,'still-referenced');
assert.equal(retained.references,1);
assert.equal(accountRows.has(accountId),true);

myReferences=0;
customReferences=1;
retained=await (await worker.fetch(new Request(`https://webtv-xtream.example/api/accounts/${accountId}`,{method:'DELETE',headers:trusted}),env)).json();
assert.equal(retained.deleted,false);
assert.equal(retained.references,1);
assert.equal(accountRows.has(accountId),true);

customReferences=0;
const deleted=await (await worker.fetch(new Request(`https://webtv-xtream.example/api/accounts/${accountId}`,{method:'DELETE',headers:trusted}),env)).json();
assert.equal(deleted.deleted,true);
assert.equal(deleted.reason,'deleted');
assert.equal(accountRows.has(accountId),false);

const again=await (await worker.fetch(new Request(`https://webtv-xtream.example/api/accounts/${accountId}`,{method:'DELETE',headers:trusted}),env)).json();
assert.equal(again.deleted,false);
assert.equal(again.reason,'not-found');

console.log('Xtream full account cleanup route tests PASS');
