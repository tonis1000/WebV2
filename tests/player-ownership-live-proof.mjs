import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'258bc39cc4a4f26c94c7d4933772ca9a3e3ff1c7';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/player-ownership-live';

await fs.mkdir(ARTIFACT_DIR,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production load failed: ${response?.status()}`);

await page.waitForFunction(
  ()=>typeof window.WebTVPlaybackAPI?.testCandidate==='function'
    && typeof window.WebTVPlaybackAPI?.replaySelected==='function'
    && typeof window.WebTVPlaybackAPI?.stop==='function'
    && typeof window.WebTVDiagnosticsAPI?.getSnapshot==='function',
  null,
  {timeout:20000}
);

const apiState=await page.evaluate(()=>({
  playbackKeys:Object.keys(window.WebTVPlaybackAPI||{}).sort(),
  diagnostics:window.WebTVDiagnosticsAPI?.getSnapshot?.()||null,
  manualTestPresent:Boolean(document.getElementById('test-candidate')),
  unifiedSearchPresent:Boolean(document.getElementById('unified-search-query')),
  legacyOneClickControlPresent:Boolean(document.getElementById('hunt-oneclick'))
}));

assert.deepEqual(apiState.playbackKeys,['replaySelected','stop','testCandidate']);
assert.ok(apiState.diagnostics,'structured diagnostics API must remain active');
assert.equal(apiState.manualTestPresent,true,'Manual Source Test must remain available');
assert.equal(apiState.unifiedSearchPresent,true,'Unified Search must remain available');
assert.equal(apiState.legacyOneClickControlPresent,false,'retired One-click control must stay absent');

await page.evaluate(()=>window.WebTVPlaybackAPI.stop());
await page.waitForFunction(()=>window.WebTVDiagnosticsAPI?.getSnapshot?.().playbackState==='idle',null,{timeout:5000});
const afterStop=await page.evaluate(()=>({
  playbackState:window.WebTVDiagnosticsAPI.getSnapshot().playbackState,
  playbackLabel:window.WebTVDiagnosticsAPI.getSnapshot().playbackLabel,
  statusText:document.getElementById('playback-status')?.textContent||'',
  videoHidden:document.getElementById('video')?.hidden,
  iframeHidden:document.getElementById('iframe')?.hidden
}));
assert.equal(afterStop.playbackState,'idle');
assert.equal(afterStop.playbackLabel,'Idle');
assert.equal(afterStop.statusText,'Idle');
assert.equal(afterStop.videoHidden,true);
assert.equal(afterStop.iframeHidden,true);

assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  retiredOneClickHttp404:true,
  apiState,
  afterStop,
  pageErrors,
  consoleErrors
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'production-player-ownership.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
