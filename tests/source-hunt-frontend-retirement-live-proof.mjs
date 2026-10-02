import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'b46f11bce380d03b565f65c22e96729dae60beb6';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/source-hunt-frontend-retirement-live';

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

await page.waitForFunction(()=>document.getElementById('unified-search-panel')&&document.getElementById('unified-search-query'),null,{timeout:20000});
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.ready===true,null,{timeout:25000});

const state=await page.evaluate(()=>({
  unifiedPanel:Boolean(document.getElementById('unified-search-panel')),
  unifiedQuery:Boolean(document.getElementById('unified-search-query')),
  manualSection:Boolean(document.getElementById('source-hunt')),
  manualHeading:document.querySelector('#source-hunt h2')?.textContent?.trim()||'',
  manualIntro:document.querySelector('#source-hunt .hunt-intro')?.textContent?.trim()||'',
  legacyHuntLinks:Boolean(document.getElementById('hunt-links')),
  legacyDiscoveryBeta:[...document.querySelectorAll('button,h1,h2,h3,p,span')].some(el=>/Discovery Beta/i.test(el.textContent||'')),
  loadedScripts:[...document.scripts].map(s=>s.src).filter(Boolean)
}));

assert.equal(state.unifiedPanel,true,'Unified Search panel must remain installed');
assert.equal(state.unifiedQuery,true,'Unified Search query input must remain installed');
assert.equal(state.manualSection,true,'Manual Source Test section must remain present');
assert.match(state.manualHeading,/Manual Source Test/);
assert.match(state.manualIntro,/Unified Search is the only automatic discovery surface/);
assert.equal(state.legacyHuntLinks,false,'legacy Source Hunt search cards must remain absent');
assert.equal(state.legacyDiscoveryBeta,false,'legacy Discovery Beta UI must remain absent');

for(const retired of [
  'source-hunt-engine.js',
  'source-hunt-web.js',
  'source-hunt-save-destination.js',
  'source-hunt-discovery-integration.js',
  'source-hunt-enigma2.js',
  'source-hunt-playlist-provenance.js'
]){
  assert.equal(state.loadedScripts.some(src=>src.includes('/src/'+retired)),false,`${retired} must not load in production`);
}

assert.equal(durableWrites.length,0,`live verification must not persist user data: ${JSON.stringify(durableWrites)}`);
assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  state,
  durableWrites,
  pageErrors,
  consoleErrors,
  retiredFrontendChainAbsent:true,
  unifiedSearchRetained:true,
  manualSourceTestRetained:true
};

await page.screenshot({path:path.join(ARTIFACT_DIR,'production-source-hunt-retirement.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

await browser.close();
