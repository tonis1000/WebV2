import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'040e6be426a7367f8e0ccc6446f5908f82d8ff15';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/diagnostics-structured-state-live';
const MEDIA_URL='https://webv2-qa.invalid/diagnostics-state.webm';
const MEDIA_FILE='/tmp/webv2-diagnostics-qa.webm';
const FAKE_TOKEN='ci-diagnostics-state-proof';

await fs.mkdir(ARTIFACT_DIR,{recursive:true});
const media=await fs.readFile(MEDIA_FILE);
assert.ok(media.length>1000,'deterministic QA media must exist');

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

await page.route('https://webv2-qa.invalid/**',route=>{
  const range=route.request().headers()['range']||'';
  const baseHeaders={
    'access-control-allow-origin':'*',
    'cache-control':'no-store',
    'accept-ranges':'bytes',
  };
  if(range){
    const match=/bytes=(\d+)-(\d*)/.exec(range);
    const start=match?Number(match[1]):0;
    const requestedEnd=match?.[2]?Number(match[2]):media.length-1;
    const end=Math.min(requestedEnd,media.length-1);
    const chunk=media.subarray(start,end+1);
    return route.fulfill({
      status:206,
      contentType:'video/webm',
      headers:{
        ...baseHeaders,
        'content-range':`bytes ${start}-${end}/${media.length}`,
        'content-length':String(chunk.length),
      },
      body:chunk,
    });
  }
  return route.fulfill({
    status:200,
    contentType:'video/webm',
    headers:{...baseHeaders,'content-length':String(media.length)},
    body:media,
  });
});

const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
await page.route('https://webtv-registry.atonis.workers.dev/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  if(method!=='GET')registryWrites.push({method,path:url.pathname});
  if(url.pathname==='/api/status')return json(route,{ok:true,service:'WebTV Registry',version:'1.5',d1:true,primaryPlaylist:'d1',pinAuth:false,pinAuthDisabled:true});
  if(url.pathname==='/api/session'||url.pathname==='/api/session/validate')return json(route,{ok:true});
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

await page.evaluate(mediaUrl=>{
  window.__diagEvents=[];
  window.addEventListener('webtv:diagnostics-updated',event=>window.__diagEvents.push({...event.detail}));
  const m3u=`#EXTM3U
#EXTINF:-1 tvg-id="webv2.diag.qa" tvg-name="WebV2 Diagnostics QA" group-title="QA",WebV2 Diagnostics QA
${mediaUrl}
`;
  window.WebTVPlaylistAPI.applyText(m3u,{mode:'replace',label:'Diagnostics Structured State QA'});
},MEDIA_URL);

await page.locator('#channel-list [data-channel-id]').first().click();
await page.waitForFunction(mediaUrl=>{
  const s=window.WebTVDiagnosticsAPI?.getSnapshot?.();
  return s?.playbackState==='live'&&s?.source===mediaUrl&&Number(s?.startupMs)>0;
},MEDIA_URL,{timeout:20000});

const selectedSnapshot=await page.evaluate(()=>window.WebTVDiagnosticsAPI.getSnapshot());
assert.equal(selectedSnapshot.source,MEDIA_URL);
assert.equal(selectedSnapshot.playbackState,'live');
assert.ok(selectedSnapshot.player&&selectedSnapshot.player!=='failed');
assert.ok(selectedSnapshot.startupMs>0);
assert.equal(selectedSnapshot.route,'direct');

const initialEvents=await page.evaluate(()=>window.__diagEvents.map(e=>({
  source:e.source,player:e.player,startupMs:e.startupMs,playbackState:e.playbackState,route:e.route,error:e.error
})));
assert.ok(initialEvents.some(e=>e.playbackState==='loading'),'playback must publish loading state');
assert.ok(initialEvents.some(e=>e.source===MEDIA_URL&&e.startupMs>0),'playback must publish populated diagnostics');
assert.ok(initialEvents.some(e=>e.source===MEDIA_URL&&e.playbackState==='live'&&e.startupMs>0),'playback must publish final live snapshot');

if(await page.locator('#diagnostics').evaluate(el=>el.hidden))await page.locator('#diagnostics-toggle').click();
await page.waitForSelector('#playback-source-full');
await page.waitForFunction(mediaUrl=>document.getElementById('playback-source-full')?.value===mediaUrl,MEDIA_URL,{timeout:10000});
assert.equal(await page.locator('#playback-source-full').inputValue(),MEDIA_URL,'Inspector must sync from structured diagnostics');

await page.waitForFunction(()=>document.querySelectorAll('#source-health .source-health-row').length>=1,null,{timeout:10000});
const sourceHealthBefore=await page.locator('#source-health .source-health-row code').evaluateAll(nodes=>nodes.map(n=>n.textContent));
assert.ok(sourceHealthBefore.includes(MEDIA_URL),'Source Health must refresh for selected source');

await page.evaluate(()=>{
  document.getElementById('diag-source').textContent='https://fake.invalid/dom-state-should-not-propagate.webm';
  document.getElementById('diag-route').textContent='fake-dom-route';
});
await page.waitForTimeout(500);
assert.equal(await page.locator('#playback-source-full').inputValue(),MEDIA_URL,'tampering diagnostic presentation DOM must not change Inspector state');

const durableWrites=()=>registryWrites.filter(write=>
  write.path.startsWith('/api/my-playlist')||
  write.path.startsWith('/api/playlists')
);
const durableWritesBeforeCandidate=durableWrites().length;
const candidateInput=page.locator('#candidate-url');
if(!await candidateInput.isVisible()){
  await page.evaluate(()=>{
    const panel=document.getElementById('source-hunt');
    if(!panel)throw new Error('Manual Test panel unavailable');
    panel.hidden=false;
  });
}
await candidateInput.waitFor({state:'visible',timeout:10000});
await candidateInput.fill(MEDIA_URL);
await page.evaluate(()=>{
  const button=document.getElementById('test-candidate');
  if(!button)throw new Error('Manual Test button unavailable');
  button.click();
});
await page.waitForFunction(mediaUrl=>{
  const s=window.WebTVDiagnosticsAPI?.getSnapshot?.();
  const save=document.getElementById('save-candidate');
  return s?.playbackState==='live'&&s?.source===mediaUrl&&Number(s?.startupMs)>0&&save&&!save.hidden&&!save.disabled;
},MEDIA_URL,{timeout:20000});

const candidateSnapshot=await page.evaluate(()=>window.WebTVDiagnosticsAPI.getSnapshot());
assert.equal(candidateSnapshot.source,MEDIA_URL);
assert.equal(candidateSnapshot.playbackState,'live');
assert.ok(candidateSnapshot.startupMs>0);
assert.equal(candidateSnapshot.route,'candidate-direct');
assert.equal(durableWrites().length,durableWritesBeforeCandidate,'Manual Test must not persist My Playlist / Saved Playlist state before explicit Save Source');

const candidateStatus=await page.locator('#save-candidate').evaluate(el=>({hidden:el.hidden,disabled:el.disabled,text:el.textContent}));
assert.equal(candidateStatus.hidden,false);
assert.equal(candidateStatus.disabled,false);
assert.equal(await page.locator('#playback-source-full').inputValue(),MEDIA_URL,'Inspector must sync from structured candidate diagnostics');

const finalEvents=await page.evaluate(()=>window.__diagEvents.map(e=>({
  source:e.source,player:e.player,startupMs:e.startupMs,playbackState:e.playbackState,route:e.route,error:e.error
})));
assert.ok(finalEvents.some(e=>e.route==='candidate-direct'&&e.source===MEDIA_URL&&e.startupMs>0),'candidate must publish populated diagnostics');
assert.ok(finalEvents.some(e=>e.route==='candidate-direct'&&e.source===MEDIA_URL&&e.playbackState==='live'),'candidate must publish final live event');

assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  media:{url:MEDIA_URL,bytes:media.length},
  selectedSnapshot,
  candidateSnapshot,
  candidateStatus,
  sourceHealthRows:sourceHealthBefore,
  domTamperDidNotPropagate:true,
  registryWrites,
  durableWritesBeforeCandidate,
  durableWritesAfterCandidate:durableWrites().length,
  eventCount:finalEvents.length,
  events:finalEvents,
  pageErrors,
  consoleErrors,
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'production-diagnostics-structured-state.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
