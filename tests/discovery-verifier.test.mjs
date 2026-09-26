import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyCandidates, verifyWithConcurrency, VERIFIER_MAX_BATCH, VERIFIER_MAX_CONCURRENCY } from '../src/discovery/verifier-client.js';

assert.equal(VERIFIER_MAX_BATCH,4);
assert.equal(VERIFIER_MAX_CONCURRENCY,2);

const goodFetch=async(url,options)=>{
  assert.equal(url,'https://verifier.test/verify');
  assert.equal(options.method,'POST');
  const body=JSON.parse(options.body);
  assert.equal(body.candidates.length,1);
  assert.equal(body.candidates[0].candidateId,'cand-good');
  assert.deepEqual(Object.keys(body.candidates[0]).sort(),['candidateId','requiredHeaders','sourceType','sourceUrl']);
  return new Response(JSON.stringify({results:[{candidateId:'cand-good',status:'VERIFIED',verified:true,startupMs:12,lastHttpStatus:200,mediaType:'hls',drmDetected:false,detail:'ok'}]}),{status:200,headers:{'content-type':'application/json'}});
};
const [good]=await verifyCandidates([{candidateId:'cand-good',sourceType:'hls',sourceUrl:'https://stream.test/live.m3u8',requiredHeaders:{Referer:'https://stream.test/'},xtreamContext:{password:'secret'}}],{endpoint:'https://verifier.test',fetchImpl:goodFetch});
assert.equal(good.status,'VERIFIED');
assert.equal(good.verified,true);

const aborter=new AbortController();
const seen=[];
const slowFetch=async(_url,options)=>new Promise((resolve,reject)=>{
  seen.push(1);
  options.signal.addEventListener('abort',()=>reject(options.signal.reason||new DOMException('aborted','AbortError')),{once:true});
  setTimeout(()=>resolve(new Response(JSON.stringify({results:[{status:'VERIFIED'}]}),{status:200})),200);
});
const cancelled=verifyWithConcurrency([
  {candidateId:'a',sourceUrl:'https://a.test/a.m3u8',sourceType:'hls'},
  {candidateId:'b',sourceUrl:'https://b.test/b.m3u8',sourceType:'hls'},
  {candidateId:'c',sourceUrl:'https://c.test/c.m3u8',sourceType:'hls'},
],{endpoint:'https://verifier.test',fetchImpl:slowFetch,signal:aborter.signal});
setTimeout(()=>aborter.abort(new DOMException('cancelled','AbortError')),20);
await assert.rejects(cancelled,error=>error?.name==='AbortError');
assert.ok(seen.length<=2,'bounded concurrency must prevent more than two in-flight verifications');

const workerSource=fs.readFileSync(new URL('../workers/webtv-source-verifier.js',import.meta.url),'utf8');
assert.match(workerSource,/UPSTREAM_TIMEOUT_MS=6000/);
assert.match(workerSource,/MAX_BATCH=4/);
assert.match(workerSource,/MAX_CONCURRENCY=2/);
assert.match(workerSource,/Private\/local targets are not allowed/);
assert.match(workerSource,/\['user-agent','User-Agent'\]/);
assert.equal(workerSource.includes('Cookie'),false);
assert.equal(workerSource.includes('Authorization'),false);

const deployWorkflow=fs.readFileSync(new URL('../.github/workflows/deploy-source-verifier.yml',import.meta.url),'utf8');
assert.match(deployWorkflow,/raw\.githubusercontent\.com\/tonis1000\/WebV2\/\$GITHUB_SHA\/tests\/fixtures\/source-verifier-working\.m3u8/);
assert.match(deployWorkflow,/source-verifier-dead-does-not-exist\.m3u8/);
assert.equal(deployWorkflow.includes('$WORKER_URL/fixture/working.m3u8'),false,'live deployment gate must not make the Worker verify its own workers.dev fixture');
assert.equal(deployWorkflow.includes('$WORKER_URL/fixture/dead'),false,'live deployment gate must use an external dead target');

console.log('discovery verifier tests PASS');
