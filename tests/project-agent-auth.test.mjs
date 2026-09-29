import assert from 'node:assert/strict';

const registryModule = await import('../workers/webtv-registry.js?project-agent-auth-test=2');
const worker = registryModule.default;

for (const name of ['createProjectAgentPairing','approveProjectAgentPairing','completeProjectAgentPairing','verifyProjectAgentSession','revokeProjectAgentSession']) {
  assert.equal(typeof registryModule[name], 'function', `${name} must be exported`);
}

function changes(n=0){return{success:true,changes:n,meta:{changes:n}};}
function createFakeD1(){
  const pairings=new Map();
  const sessions=new Map();
  const checkpoints=new Map([
    ['WEBV2_CURRENT.md',{content:'# WEBV2 CURRENT\n\nCanonical test state.\n',byte_length:40,sha256:'a'.repeat(64),updated_at:'2026-09-29 12:00:00'}],
  ]);
  const history=[];
  const statement=(sql,args=[])=>({
    _sql:String(sql),_args:args,
    bind(...next){return statement(sql,next);},
    async first(){
      const s=String(sql);
      if(/FROM project_agent_pairings WHERE pairing_id=\?/i.test(s)){const row=pairings.get(args[0]);return row?{...row}:null;}
      if(/FROM project_agent_sessions WHERE session_id=\?/i.test(s)){const row=sessions.get(args[0]);return row?{...row}:null;}
      if(/SELECT commit_sha, commit_message, deployed_at FROM project_deploy_status/i.test(s))return{commit_sha:'verified-sha',commit_message:'verified',deployed_at:'2026-09-29 12:00:00'};
      if(/SELECT content, byte_length, sha256, updated_at FROM project_checkpoints WHERE name=\?/i.test(s)){const row=checkpoints.get(args[0]);return row?{...row}:null;}
      if(/SELECT content, sha256, updated_at FROM project_checkpoints WHERE name=\?/i.test(s)){const row=checkpoints.get(args[0]);return row?{content:row.content,sha256:row.sha256,updated_at:row.updated_at}:null;}
      throw new Error(`Unexpected first SQL: ${s}`);
    },
    async all(){
      const s=String(sql);
      if(/SELECT name, byte_length, sha256, updated_at FROM project_checkpoints/i.test(s))return{results:[...checkpoints].map(([name,row])=>({name,byte_length:row.byte_length,sha256:row.sha256,updated_at:row.updated_at}))};
      if(/FROM project_checkpoint_history WHERE name=\?/i.test(s))return{results:history.filter(x=>x.name===args[0]).map(({content,...x})=>x)};
      throw new Error(`Unexpected all SQL: ${s}`);
    },
    async run(){return runSql(String(sql),args);}
  });
  function runSql(s,args){
    if(/^CREATE TABLE IF NOT EXISTS (project_agent_pairings|project_agent_sessions|project_checkpoints|project_checkpoint_history)/i.test(s))return changes();
    if(/^INSERT INTO project_agent_pairings/i.test(s)){
      const [pairing_id,secret_sha256,created_at,expires_at]=args;
      pairings.set(pairing_id,{pairing_id,secret_sha256,created_at,expires_at,approved_at:null,used_at:null});return changes(1);
    }
    if(/^UPDATE project_agent_pairings SET approved_at=\?/i.test(s)){
      const [approved_at,pairing_id,now]=args;const row=pairings.get(pairing_id);
      if(!row||row.approved_at||row.used_at||Number(row.expires_at)<=Number(now))return changes();row.approved_at=approved_at;return changes(1);
    }
    if(/^UPDATE project_agent_pairings SET used_at=\?/i.test(s)){
      const [used_at,pairing_id,now]=args;const row=pairings.get(pairing_id);
      if(!row||row.used_at||!row.approved_at||Number(row.expires_at)<=Number(now))return changes();row.used_at=used_at;return changes(1);
    }
    if(/^INSERT INTO project_agent_sessions/i.test(s)){
      const [session_id,issued_at,expires_at]=args;sessions.set(session_id,{session_id,issued_at,expires_at,revoked_at:null});return changes(1);
    }
    if(/^UPDATE project_agent_sessions SET revoked_at=\?/i.test(s)){
      const [revoked_at,session_id]=args;const row=sessions.get(session_id);if(!row)return changes();row.revoked_at=revoked_at;return changes(1);
    }
    if(/^UPDATE project_checkpoints SET sha256=sha256/i.test(s)){const row=checkpoints.get(args[0]);return changes(row?.sha256===args[1]?1:0);}
    if(/^INSERT INTO project_checkpoint_history\b[\s\S]*SELECT/i.test(s)){const [name,expected]=args;const row=checkpoints.get(name);if(!row||row.sha256!==expected)return changes();history.push({id:history.length+1,name,content:row.content,byte_length:row.byte_length,sha256:row.sha256,checkpoint_updated_at:row.updated_at,archived_at:'2026-09-29 12:01:00'});return changes(1);}
    if(/^UPDATE project_checkpoints SET content=\?/i.test(s)){const [content,byte_length,sha256,name,expected]=args;const row=checkpoints.get(name);if(!row||row.sha256!==expected)return changes();checkpoints.set(name,{content,byte_length,sha256,updated_at:'2026-09-29 12:01:00'});return changes(1);}
    throw new Error(`Unexpected run SQL: ${s}`);
  }
  return{
    prepare(sql){return statement(String(sql));},
    async batch(items){return items.map(x=>runSql(x._sql,x._args));},
    pairings,sessions,checkpoints,history,
  };
}

const DB=createFakeD1();
const env={DB,ADMIN_TOKEN:'test-admin-token',ADMIN_PIN:'123456'};

// Pair creation: secret is returned once but only its hash is persisted.
const before=Date.now();
const pairing=await registryModule.createProjectAgentPairing(env);
const after=Date.now();
assert.match(pairing.pairingId,/^[A-Za-z0-9_-]{16,}$/);
assert.match(pairing.completionSecret,/^[A-Za-z0-9_-]{24,}$/);
assert.ok(Number(pairing.expiresAt)>=before+4*60_000&&Number(pairing.expiresAt)<=after+6*60_000);
const persisted=DB.pairings.get(pairing.pairingId);
assert.ok(persisted);
assert.notEqual(persisted.secret_sha256,pairing.completionSecret);
assert.match(persisted.secret_sha256,/^[a-f0-9]{64}$/);

// Completion requires prior approval and the exact one-time secret.
await assert.rejects(()=>registryModule.completeProjectAgentPairing(env,pairing.pairingId,pairing.completionSecret),/approved/i);
const approved=await registryModule.approveProjectAgentPairing(env,pairing.pairingId);
assert.equal(approved.ok,true);
await assert.rejects(()=>registryModule.completeProjectAgentPairing(env,pairing.pairingId,'wrong-secret'),/secret/i);
const completed=await registryModule.completeProjectAgentPairing(env,pairing.pairingId,pairing.completionSecret);
assert.match(completed.token,/^[^.]+\.[^.]+$/);
assert.ok(completed.sessionId);
assert.equal((await registryModule.verifyProjectAgentSession(completed.token,env)).ok,true);
await assert.rejects(()=>registryModule.completeProjectAgentPairing(env,pairing.pairingId,pairing.completionSecret),/used|complete/i);

// Revocation overrides an otherwise valid signature.
assert.equal((await registryModule.revokeProjectAgentSession(env,completed.sessionId)).ok,true);
assert.equal((await registryModule.verifyProjectAgentSession(completed.token,env)).ok,false);

// HTTP route flow uses a scoped HttpOnly cookie and never broad admin auth.
const livePair=await registryModule.createProjectAgentPairing(env);
const adminHeaders={authorization:`Bearer ${env.ADMIN_TOKEN}`,'content-type':'application/json'};
let response=await worker.fetch(new Request('https://registry.example/api/project-agent/pair/approve',{method:'POST',headers:adminHeaders,body:JSON.stringify({pairingId:livePair.pairingId})}),env);
assert.equal(response.status,200);
response=await worker.fetch(new Request('https://registry.example/api/project-agent/pair/complete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pairingId:livePair.pairingId,completionSecret:livePair.completionSecret})}),env);
assert.equal(response.status,200);
const setCookie=response.headers.get('set-cookie')||'';
assert.match(setCookie,/webv2_project_agent=/i);
assert.match(setCookie,/HttpOnly/i);
assert.match(setCookie,/Secure/i);
assert.match(setCookie,/SameSite=Strict/i);
assert.match(setCookie,/Path=\/api\/project-agent/i);
const cookie=setCookie.split(';',1)[0];

response=await worker.fetch(new Request('https://registry.example/api/project-agent/session',{headers:{cookie}}),env);
assert.equal(response.status,200);
response=await worker.fetch(new Request('https://registry.example/api/project-agent/checkpoints',{headers:{cookie}}),env);
assert.equal(response.status,200);
response=await worker.fetch(new Request('https://registry.example/api/project-agent/checkpoints/WEBV2_CURRENT.md',{headers:{cookie}}),env);
assert.equal(response.status,200);
assert.match(await response.text(),/WEBV2 CURRENT/);

// Project-agent cookie must not authorize ordinary admin mutations.
response=await worker.fetch(new Request('https://registry.example/api/my-playlist/channel',{method:'PUT',headers:{cookie,'content-type':'application/json'},body:'{}'}),env);
assert.equal(response.status,401);
response=await worker.fetch(new Request('https://registry.example/api/favorites',{method:'PUT',headers:{cookie,'content-type':'application/json'},body:'{}'}),env);
assert.equal(response.status,401);
response=await worker.fetch(new Request('https://registry.example/api/health',{method:'PUT',headers:{cookie,'content-type':'application/json'},body:'{}'}),env);
assert.equal(response.status,401);
response=await worker.fetch(new Request('https://registry.example/api/playlists',{method:'POST',headers:{cookie,'content-type':'application/json'},body:'{}'}),env);
assert.equal(response.status,401);

// Anonymous project-agent state remains private.
response=await worker.fetch(new Request('https://registry.example/api/project-agent/checkpoints'),env);
assert.equal(response.status,401);

console.log('project agent auth regression: PASS');
