import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'3fd863325511a332268dc6238a08a236341f3cf0';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/final-dormant-frontend-retirement-live';
await fs.mkdir(ARTIFACT_DIR,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.setExtraHTTPHeaders({'cache-control':'no-cache',pragma:'no-cache'});
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
const durableWrites=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
await page.route('https://webtv-registry.atonis.workers.dev/**',async route=>{
  const req=route.request();
  if(req.method()!=='GET' && new URL(req.url()).pathname!=='/api/health'){
    durableWrites.push({method:req.method(),url:req.url()});
    return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
  }
  return route.continue();
});

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production page load failed: ${response?.status()}`);
await page.waitForFunction(()=>document.getElementById('unified-search-panel')&&window.WebTVPlaylistAPI?.ready===true,null,{timeout:25000});

const state=await page.evaluate(()=>({
  unifiedSearch:Boolean(document.getElementById('unified-search-panel')),
  unifiedQuery:Boolean(document.getElementById('unified-search-query')),
  manualSourceTest:Boolean(document.getElementById('source-hunt')),
  legacyDiscoveryBeta:[...document.querySelectorAll('button,h1,h2,h3,p,span')].some(el=>/Discovery Beta/i.test(el.textContent||'')),
  xtreamPreviewButton:Boolean(document.getElementById('xtream-preview')),
  playerApi:Boolean(window.WebTVPlaybackAPI),
  playlistApi:Boolean(window.WebTVPlaylistAPI),
  loadedScripts:[...document.scripts].map(s=>s.src).filter(Boolean)
}));

assert.equal(state.unifiedSearch,true,'Unified Search must remain live');
assert.equal(state.unifiedQuery,true,'Unified Search query must remain live');
assert.equal(state.manualSourceTest,true,'Manual Source Test must remain live');
assert.equal(state.legacyDiscoveryBeta,false,'Discovery Beta UI must remain retired');
assert.equal(state.playerApi,true,'Playback API must remain live');
assert.equal(state.playlistApi,true,'Playlist API must remain live');

for(const retired of [
  'cloud-auto-sync.js',
  'd1-sync-addon.js',
  'official-fallbacks.js',
  'discovery-ui.js',
  'new-xtream-preview.js'
]){
  assert.equal(state.loadedScripts.some(src=>src.endsWith('/'+retired)||src.includes('/'+retired+'?')),false,`${retired} must not load in production`);
}

assert.equal(durableWrites.length,0,`live proof must not persist user data: ${JSON.stringify(durableWrites)}`);
assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  state,
  durableWrites,
  pageErrors,
  consoleErrors,
  retiredFilesAbsent:true,
  retainedOwnersLive:true
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'production-final-dormant-retirement.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
