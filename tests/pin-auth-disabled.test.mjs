import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entryModule=await import('../workers/webtv-registry-entry.js?pin-auth-disabled-test=1');
const worker=entryModule.default;

function changes(n=0){return{success:true,changes:n,meta:{changes:n}};}
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
        async all(){
          if(/SELECT name, byte_length, sha256, updated_at FROM project_checkpoints/i.test(s))return{results:[]};
          throw new Error(`Unexpected all SQL: ${s}`);
        },
        async run(){
          if(/^CREATE TABLE IF NOT EXISTS project_(checkpoints|checkpoint_history)/i.test(s))return changes();
          throw new Error(`Unexpected run SQL: ${s}`);
        }
      };
    }
  };
}

const env={DB:createFakeD1(),ADMIN_TOKEN:'test-admin-token',ADMIN_PIN:'123456',PIN_AUTH_DISABLED:'1'};

let response=await worker.fetch(new Request('https://registry.example/api/status'),env);
assert.equal(response.status,200);
const status=await response.json();
assert.equal(status.pinAuth,false,'status must advertise that PIN auth is disabled');

response=await worker.fetch(new Request('https://registry.example/api/project-checkpoints'),env);
assert.equal(response.status,200,'admin checkpoint reads must not require PIN while the temporary flag is enabled');

const pinAuthSource=readFileSync('src/pin-auth.js','utf8');
assert.match(pinAuthSource,/pinAuth\s*===\s*false|pinAuth\s*!==\s*true/,'frontend auth layer must recognize Registry pinAuth=false and avoid prompting for a PIN');

const deployWorkflow=readFileSync('.github/workflows/deploy-webtv-registry.yml','utf8');
assert.match(deployWorkflow,/PIN_AUTH_DISABLED\s*=\s*["']1["']/,'Registry deploy must explicitly enable the temporary PIN bypass');

console.log('temporary PIN auth disabled regression: PASS');
