import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entryModule=await import('../workers/webtv-registry-entry.js?pin-auth-disabled-test=2');
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
assert.equal(status.pinAuthDisabled,true,'status must expose the temporary maintenance bypass explicitly');

response=await worker.fetch(new Request('https://registry.example/api/project-checkpoints'),env);
assert.equal(response.status,200,'admin checkpoint reads must not require PIN while the temporary flag is enabled');

response=await worker.fetch(new Request('https://registry.example/api/session/maintenance',{method:'POST'}),env);
assert.equal(response.status,200,'maintenance mode must be able to mint a scoped browser session without prompting for PIN');
const maintenance=await response.json();
assert.equal(maintenance.ok,true);
assert.equal(maintenance.maintenance,true);
assert.match(String(maintenance.token||''),/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,'maintenance session must be a signed session token');

response=await worker.fetch(new Request('https://registry.example/api/session',{headers:{authorization:`Bearer ${maintenance.token}`}}),env);
assert.equal(response.status,200,'maintenance-scoped session must validate while bypass remains enabled');

const lockedEnv={...env,PIN_AUTH_DISABLED:'0'};
response=await worker.fetch(new Request('https://registry.example/api/session',{headers:{authorization:`Bearer ${maintenance.token}`}}),lockedEnv);
assert.equal(response.status,401,'maintenance-scoped session must stop validating as soon as the bypass is disabled');

response=await worker.fetch(new Request('https://registry.example/api/session/maintenance',{method:'POST'}),lockedEnv);
assert.equal(response.status,403,'maintenance session minting must be unavailable when PIN auth is enabled');

const pinAuthSource=readFileSync('src/pin-auth.js','utf8');
assert.match(pinAuthSource,/api\/session\/maintenance/,'frontend auth layer must mint a scoped maintenance session when Registry pinAuth=false');
assert.match(pinAuthSource,/localStorage\.setItem\(TOKEN_KEY/,'frontend auth layer must persist the minted maintenance session for Xtream/API consumers');

const xtreamSource=readFileSync('src/xtream-client.js','utf8');
assert.match(xtreamSource,/ensureTrustedSession/,'Xtream client must retain its trusted-session boundary');
assert.match(xtreamSource,/x-webtv-session/,'Xtream client must continue sending the trusted session to the Xtream Worker');

const deployWorkflow=readFileSync('.github/workflows/deploy-webtv-registry.yml','utf8');
assert.match(deployWorkflow,/PIN_AUTH_DISABLED\s*=\s*["']1["']/,'Registry deploy must explicitly enable the temporary PIN bypass');

console.log('temporary PIN auth disabled regression: PASS');
