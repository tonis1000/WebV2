import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'8815ac39b25cc82755dba8a7a37b2b1c8e7783a5';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/epg-refresh-ownership-live';

await fs.mkdir(ARTIFACT_DIR,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
const epgRequests=[];
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
page.on('request',request=>{
  const url=request.url();
  if(url.includes('epg-proxy-gr.atonis.workers.dev/epg.xml'))epgRequests.push(url);
});

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production load failed: ${response?.status()}`);

await page.waitForFunction(
  ()=>globalThis.__webtv_epg_service_singleton__?.lastRefreshAt>0
    && globalThis.__webtv_epg_service_singleton__?.programs?.size>0,
  null,
  {timeout:30000}
);

await page.waitForTimeout(1200);

const before=await page.evaluate(()=>({
  lastRefreshAt:globalThis.__webtv_epg_service_singleton__.lastRefreshAt,
  programs:globalThis.__webtv_epg_service_singleton__.programs.size,
  channelRows:document.querySelectorAll('#channel-list .channel-item').length,
  sidebarNowRows:document.querySelectorAll('#channel-list .channel-now-inline').length,
  sidebarVisibleNow:[...document.querySelectorAll('#channel-list .channel-now-inline:not(.no-epg)')].length,
  programTitle:document.getElementById('program-title')?.textContent||''
}));

assert.ok(before.lastRefreshAt>0,'shared EPG singleton must be refreshed');
assert.ok(before.programs>0,'shared EPG singleton must contain programme data');
assert.ok(before.channelRows>0,'production channel list must render');
assert.ok(epgRequests.length>=1,'main-owned startup must request the production EPG feed');

const requestCountBeforePresentationEvents=epgRequests.length;

await page.evaluate(()=>{
  window.dispatchEvent(new CustomEvent('webtv:ready'));
  window.dispatchEvent(new CustomEvent('webtv:epg-updated',{detail:{proof:true}}));
  const list=document.getElementById('channel-list');
  if(list){
    const marker=document.createElement('span');
    marker.hidden=true;
    list.appendChild(marker);
    marker.remove();
  }
});

await page.waitForTimeout(1500);

const after=await page.evaluate(()=>({
  lastRefreshAt:globalThis.__webtv_epg_service_singleton__.lastRefreshAt,
  programs:globalThis.__webtv_epg_service_singleton__.programs.size,
  channelRows:document.querySelectorAll('#channel-list .channel-item').length,
  sidebarNowRows:document.querySelectorAll('#channel-list .channel-now-inline').length,
  sidebarVisibleNow:[...document.querySelectorAll('#channel-list .channel-now-inline:not(.no-epg)')].length
}));

assert.equal(
  epgRequests.length,
  requestCountBeforePresentationEvents,
  'Sidebar presentation events must not trigger another EPG network refresh'
);
assert.equal(after.lastRefreshAt,before.lastRefreshAt,'presentation-only events must not advance EPG refresh time');
assert.equal(after.programs,before.programs,'presentation-only events must not replace the EPG programme store');
assert.ok(after.sidebarNowRows>0,'Sidebar Now Playing presentation must remain active');

assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  epgRequestsAtStartup:requestCountBeforePresentationEvents,
  epgRequestsAfterSidebarPresentationEvents:epgRequests.length,
  before,
  after,
  pageErrors,
  consoleErrors
};

await page.screenshot({path:path.join(ARTIFACT_DIR,'production-epg-refresh-ownership.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
