import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entryModule=await import('../workers/webtv-registry-entry.js?registry-admin-boundary=1');
const worker=entryModule.default;

function createFakeD1(){
  return{
    prepare(sql){
      const s=String(sql);
      return{
        bind(){return this;},
        async first(){
          if(/SELECT COUNT\(\*\) AS n FROM my_playlist/i.test(s))return{n:0};
          throw new Error(`Unexpected first SQL: ${s}`);
        },
        async all(){throw new Error(`Unexpected all SQL: ${s}`);},
        async run(){throw new Error(`Unexpected run SQL: ${s}`);}
      };
    }
  };
}

const env={DB:createFakeD1(),ADMIN_TOKEN:'test-admin-token',ADMIN_PIN:'123456',PIN_AUTH_DISABLED:'0'};

let response=await worker.fetch(new Request('https://registry.example/api/status'),env);
assert.equal(response.status,200);
const status=await response.json();
assert.equal(status.pinAuth,true,'status must advertise PIN auth');
assert.equal('pinAuthDisabled' in status,false,'locked Registry must not advertise maintenance bypass');

for (const [url,method,body] of [
  ['/api/project-checkpoints','GET',null],
  ['/api/project-checkpoints/WEBV2_CURRENT.md','GET',null],
  ['/api/project-checkpoints/WEBV2_CURRENT.md','PUT',JSON.stringify({content:'# unauthorized probe\n'})],
]) {
  response=await worker.fetch(new Request('https://registry.example'+url,{method,headers:body?{'content-type':'application/json'}:undefined,body}),env);
  assert.equal(response.status,401,`${method} ${url} must reject anonymous access`);
}

response=await worker.fetch(new Request('https://registry.example/api/session/maintenance',{method:'POST'}),env);
assert.equal(response.status,403,'maintenance session minting must be disabled when PIN auth is enabled');

const entrySource=readFileSync('workers/webtv-registry-entry.js','utf8');
assert.doesNotMatch(entrySource,/ADMIN_TOKEN|authorization.*Bearer/i,'entry wrapper must not inject admin credentials');

const deployWorkflow=readFileSync('.github/workflows/deploy-webtv-registry.yml','utf8');
assert.match(deployWorkflow,/PIN_AUTH_DISABLED\s*=\s*["']0["']/,'Registry deploy must keep PIN auth enabled');
assert.match(deployWorkflow,/anonymous checkpoint read\/write denied/i,'deploy must verify the locked checkpoint boundary');

console.log('Registry locked admin boundary regression: PASS');
