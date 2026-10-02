import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'0c6360f6d3cfdab0ca629a59c1500deee88f13fa';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/save-discovered-channel-retirement-live';
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
await page.waitForFunction(()=>window.WebTVMyPlaylistAPI && window.WebTVPlaylistAPI?.ready===true,null,{timeout:25000});

const state=await page.evaluate(()=>({
  keys:Object.keys(window.WebTVMyPlaylistAPI||{}).sort(),
  saveDiscoveredType:typeof window.WebTVMyPlaylistAPI?.saveDiscoveredChannel,
  upsertType:typeof window.WebTVMyPlaylistAPI?.upsertChannel,
  addSourceType:typeof window.WebTVMyPlaylistAPI?.addSourceToCurrent,
  replaceSourcesType:typeof window.WebTVMyPlaylistAPI?.replaceSourcesForCurrent,
  addCurrentType:typeof window.WebTVMyPlaylistAPI?.addCurrent,
  unifiedSearch:Boolean(document.getElementById('unified-search-panel')),
  manualSourceTest:Boolean(document.getElementById('source-hunt'))
}));

assert.equal(state.saveDiscoveredType,'undefined','retired saveDiscoveredChannel API must be absent live');
assert.equal(state.upsertType,'function','verified Xtream upsertChannel must remain live');
assert.equal(state.addSourceType,'function','Playback Inspector addSourceToCurrent must remain live');
assert.equal(state.replaceSourcesType,'function','Playback Inspector replaceSourcesForCurrent must remain live');
assert.equal(state.addCurrentType,'function','generic My Playlist addCurrent must remain live');
assert.equal(state.unifiedSearch,true,'Unified Search must remain live');
assert.equal(state.manualSourceTest,true,'Manual Source Test must remain live');
assert.equal(durableWrites.length,0,`live proof must not persist user data: ${JSON.stringify(durableWrites)}`);
assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  state,
  durableWrites,
  pageErrors,
  consoleErrors,
  saveDiscoveredChannelRetired:true
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'production-save-discovered-channel-retirement.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
