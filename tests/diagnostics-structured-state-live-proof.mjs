import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'040e6be426a7367f8e0ccc6446f5908f82d8ff15';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/diagnostics-structured-state-live';
const HLS='https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const FAKE_TOKEN='ci-diagnostics-state-proof';

await fs.mkdir(ARTIFACT_DIR,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.setExtraHTTPHeaders({'cache-control':'no-cache',pragma:'no-cache'});
await context.addInitScript(token=>localStorage.setItem('webtv_v2_registry_token',token),FAKE_TOKEN);
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
const registryWrites=[];
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
page.on('dialog',async dialog=>dialog.accept());

const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
await page.route('https://webtv-registry.atonis.workers.dev/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  if(method!=='GET')registryWrites.push({method,path:url.pathname});
  if(url.pathname==='/api/status')return json(route,{ok:true,service:'WebTV Registry',version:'1.5',d1:true,primaryPlaylist:'d1',pinAuth:false,pinAuthDisabled:true});
  if(url.pathname==='/api/session')return json(route,{ok:true});
  if(url.pathname==='/api/session/validate')return json(route,{ok:true});
  if(url.pathname==='/api/my-playlist'&&method==='GET')return json(route,{channels:[]});
  if(url.pathname==='/api/playlists'&&method==='GET')return json(route,{playlists:[]});
  if(url.pathname==='/api/health'&&method==='GET')return json(route,{health:{},modes:{}});
  if(url.pathname==='/api/health/import'&&method==='POST')return json(route,{ok:true});
  if(url.pathname==='/api/health/mode'&&method==='PUT')return json(route,{ok:true});
  if(url.pathname==='/api/health'&&['PUT','DELETE'].includes(method))return json(route,{ok:true});
  return json(route,{ok:true});
});

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production load failed: ${response?.status()}`);
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.ready===true&&typeof window.WebTVDiagnosticsAPI?.getSnapshot==='function',null,{timeout:20000});
await page.evaluate(()=>{document.documentElement.classList.remove('admin-locked');document.documentElement.classList.add('admin-unlocked');});

await page.evaluate(hls=>{
  window.__diagEvents=[];
  window.addEventListener('webtv:diagnostics-updated',event=>window.__diagEvents.push({...event.detail}));
  const m3u=`#EXTM3U
#EXTINF:-1 tvg-id="webv2.diag.qa" tvg-name="WebV2 Diagnostics QA" group-title="QA",WebV2 Diagnostics QA
${hls}
`;
  window.WebTVPlaylistAPI.applyText(m3u,{mode:'replace',label:'Diagnostics Structured State QA'});
},HLS);

const row=page.locator('#channel-list [data-channel-id]').first();
await row.click();

async function waitForLive(label){
  const attempts=[];
  for(let attempt=1;attempt<=3;attempt+=1){
    if(attempt>1){
      await page.evaluate(async()=>{
        try{await window.WebTVPlaybackAPI?.replaySelected?.();}catch{}
      });
    }
    try{
      await page.waitForFunction(hls=>{
        const s=window.WebTVDiagnosticsAPI?.getSnapshot?.();
        return s?.playbackState==='live'&&s?.source===hls&&Number(s?.startupMs)>0;
      },HLS,{timeout:15000});
      attempts.push({attempt,ok:true,snapshot:await page.evaluate(()=>window.WebTVDiagnosticsAPI.getSnapshot())});
      return attempts;
    }catch(error){
      attempts.push({
        attempt,
        ok:false,
        error:error.message,
        snapshot:await page.evaluate(()=>window.WebTVDiagnosticsAPI?.getSnapshot?.()||{}),
        events:await page.evaluate(()=>window.__diagEvents.slice(-8)),
      });
    }
  }
  await fs.writeFile(path.join(ARTIFACT_DIR,`${label}-failed-attempts.json`),JSON.stringify(attempts,null,2));
  throw new Error(`${label} did not reach live structured state after 3 attempts: ${JSON.stringify(attempts)}`);
}
const initialAttempts=await waitForLive('initial-playback');

const selectedSnapshot=await page.evaluate(()=>window.WebTVDiagnosticsAPI.getSnapshot());
assert.equal(selectedSnapshot.source,HLS);
assert.equal(selectedSnapshot.playbackState,'live');
assert.ok(selectedSnapshot.player&&selectedSnapshot.player!=='failed');
assert.ok(selectedSnapshot.startupMs>0);

const eventSequenceBeforeCandidate=await page.evaluate(()=>window.__diagEvents.map(e=>({source:e.source,player:e.player,startupMs:e.startupMs,playbackState:e.playbackState,route:e.route})));
assert.ok(eventSequenceBeforeCandidate.some(e=>e.playbackState==='loading'),'channel playback must publish loading state');
assert.ok(eventSequenceBeforeCandidate.some(e=>e.source===HLS&&e.startupMs>0),'channel playback must publish populated diagnostics');
assert.ok(eventSequenceBeforeCandidate.some(e=>e.source===HLS&&e.playbackState==='live'&&e.startupMs>0),'channel playback must publish final live structured snapshot');

if(await page.locator('#diagnostics').evaluate(el=>el.hidden))await page.locator('#diagnostics-toggle').click();
await page.waitForSelector('#playback-source-full');
await page.waitForFunction(hls=>document.getElementById('playback-source-full')?.value===hls,HLS,{timeout:10000});

const inspectorBefore=await page.locator('#playback-source-full').inputValue();
assert.equal(inspectorBefore,HLS,'Playback Inspector must sync from structured diagnostics snapshot');

await page.waitForFunction(()=>document.querySelectorAll('#source-health .source-health-row').length>=2,null,{timeout:10000});
const sourceHealthBefore=await page.locator('#source-health .source-health-row code').evaluateAll(nodes=>nodes.map(n=>n.textContent));
assert.ok(sourceHealthBefore.includes(HLS),'Source Health must render selected source after structured diagnostics update');

await page.evaluate(()=>{
  document.getElementById('diag-source').textContent='https://fake.invalid/dom-state-should-not-propagate.m3u8';
  document.getElementById('diag-route').textContent='fake-dom-route';
});
await page.waitForTimeout(500);
assert.equal(await page.locator('#playback-source-full').inputValue(),HLS,'tampering diagnostic presentation DOM must not change Inspector state');

const writesBeforeCandidate=registryWrites.length;
await page.locator('#candidate-url').fill(HLS);
let candidateAttempts=[];
for(let attempt=1;attempt<=3;attempt+=1){
  await page.locator('#test-candidate').click();
  try{
    await page.waitForFunction(hls=>{
      const s=window.WebTVDiagnosticsAPI?.getSnapshot?.();
      const save=document.getElementById('save-candidate');
      return s?.playbackState==='live'&&s?.source===hls&&Number(s?.startupMs)>0&&save&&!save.hidden&&!save.disabled;
    },HLS,{timeout:15000});
    candidateAttempts.push({attempt,ok:true,snapshot:await page.evaluate(()=>window.WebTVDiagnosticsAPI.getSnapshot())});
    break;
  }catch(error){
    candidateAttempts.push({
      attempt,
      ok:false,
      error:error.message,
      snapshot:await page.evaluate(()=>window.WebTVDiagnosticsAPI?.getSnapshot?.()||{}),
      events:await page.evaluate(()=>window.__diagEvents.slice(-8)),
    });
  }
}
if(!candidateAttempts.some(a=>a.ok)){
  await fs.writeFile(path.join(ARTIFACT_DIR,'candidate-failed-attempts.json'),JSON.stringify(candidateAttempts,null,2));
  throw new Error(`candidate did not verify after 3 attempts: ${JSON.stringify(candidateAttempts)}`);
}

const candidateSnapshot=await page.evaluate(()=>window.WebTVDiagnosticsAPI.getSnapshot());
assert.equal(candidateSnapshot.source,HLS);
assert.equal(candidateSnapshot.playbackState,'live');
assert.ok(candidateSnapshot.startupMs>0);
assert.ok(String(candidateSnapshot.route).startsWith('candidate-'),'candidate verification must use candidate route identity');
assert.equal(registryWrites.length,writesBeforeCandidate,'Manual Test must persist nothing before explicit Save Source');

const candidateStatus=await page.locator('#save-candidate').evaluate(el=>({
  hidden:el.hidden,
  disabled:el.disabled,
  text:el.textContent,
}));
assert.equal(candidateStatus.hidden,false);
assert.equal(candidateStatus.disabled,false);

const inspectorAfter=await page.locator('#playback-source-full').inputValue();
assert.equal(inspectorAfter,HLS,'Inspector must remain synchronized from structured candidate diagnostics');

const finalEvents=await page.evaluate(()=>window.__diagEvents.map(e=>({source:e.source,player:e.player,startupMs:e.startupMs,playbackState:e.playbackState,route:e.route,error:e.error})));
assert.ok(finalEvents.some(e=>e.route?.startsWith('candidate-')&&e.source===HLS&&e.startupMs>0),'candidate must publish populated structured diagnostics event');
assert.ok(finalEvents.some(e=>e.route?.startsWith('candidate-')&&e.source===HLS&&e.playbackState==='live'),'candidate must publish final live structured event');

assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  initialAttempts,
  candidateAttempts,
  selectedSnapshot,
  candidateSnapshot,
  candidateStatus,
  inspectorBefore,
  inspectorAfter,
  sourceHealthRows:sourceHealthBefore,
  domTamperDidNotPropagate:true,
  registryWritesBeforeCandidate:writesBeforeCandidate,
  registryWritesAfterCandidate:registryWrites.length,
  finalEventCount:finalEvents.length,
  finalEvents:finalEvents.slice(-12),
  pageErrors,
  consoleErrors,
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'production-diagnostics-structured-state.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
