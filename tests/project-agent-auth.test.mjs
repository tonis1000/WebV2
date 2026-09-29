import assert from 'node:assert/strict';

// TDD RED: this test must fail until the project-agent pairing primitive exists.
const registryModule = await import('../workers/webtv-registry.js?project-agent-auth-test=1');

assert.equal(typeof registryModule.createProjectAgentPairing, 'function', 'createProjectAgentPairing must be exported');

function createFakeD1(){
  const runs=[];
  const statement=(sql,args=[])=>({
    bind(...next){return statement(sql,next);},
    async run(){runs.push({sql:String(sql),args});return{success:true,meta:{changes:1}};}
  });
  return {prepare(sql){return statement(String(sql));},runs};
}

const DB=createFakeD1();
const env={DB,ADMIN_TOKEN:'test-admin-token'};
const before=Date.now();
const pairing=await registryModule.createProjectAgentPairing(env);
const after=Date.now();

assert.match(pairing.pairingId,/^[A-Za-z0-9_-]{16,}$/,'pairing id should be random and URL-safe');
assert.match(pairing.completionSecret,/^[A-Za-z0-9_-]{24,}$/,'completion secret should be random and URL-safe');
assert.ok(Number(pairing.expiresAt)>=before+4*60_000,'pairing should live about five minutes');
assert.ok(Number(pairing.expiresAt)<=after+6*60_000,'pairing should not live materially longer than five minutes');

const insert=DB.runs.find(x=>/INSERT INTO project_agent_pairings/i.test(x.sql));
assert.ok(insert,'pairing row must be persisted');
assert.equal(insert.args[0],pairing.pairingId);
assert.notEqual(insert.args[1],pairing.completionSecret,'D1 must not store the raw completion secret');
assert.match(String(insert.args[1]),/^[a-f0-9]{64}$/,'D1 should store a SHA-256 completion-secret hash');
assert.ok(!JSON.stringify(DB.runs).includes(pairing.completionSecret),'raw completion secret must not appear in persisted statements');

console.log('project agent auth regression: PASS');
