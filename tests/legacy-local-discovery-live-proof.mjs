import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'8ef91a32d898930dfd38d82220ebc370b0444ed2';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/legacy-local-discovery-live';

await fs.mkdir(ARTIFACT_DIR,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production WebV2 load failed: ${response?.status()}`);
await page.waitForSelector('#search',{timeout:15000});
await page.waitForSelector('#channel-list',{state:'attached',timeout:15000});

assert.equal(await page.locator('#discovery-beta-toggle').count(),0,'production entrypoint must not restore legacy Discovery Beta toggle');
assert.equal(await page.locator('#discovery-scan-local').count(),0,'production page must not expose retired Local Discovery control');

const search=page.locator('#search');
assert.ok(await search.isVisible(),'canonical channel/search input must remain visible');
assert.ok((await search.getAttribute('placeholder'))?.length>0,'search input must remain configured');

const liveUi=await fetch(new URL('src/discovery/discovery-ui.js',WEBV2_URL),{headers:{'cache-control':'no-cache'}}).then(r=>r.text());
for(const forbidden of ['local-data-reader.js','local-candidates.js','scanLocalSources','scanLocal:','discovery-scan-local','Find Local Sources']){
  assert.equal(liveUi.includes(forbidden),false,`live legacy shell must not contain ${forbidden}`);
}
for(const retained of ['discoverCuratedRemoteFeeds','discoverGithubPublicPlaylists','discoverRecentWebSearch','discoverStrmSpecific','discoverAuthorizedXtream','verifyCandidates','promoteCandidate']){
  assert.ok(liveUi.includes(retained),`live legacy shell must retain ${retained}`);
}

await page.waitForTimeout(1500);
assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  productionPageLoaded:true,
  canonicalSearchVisible:true,
  legacyDiscoveryToggleAbsent:true,
  localDiscoveryControlAbsent:true,
  retainedCapabilities:['curated','github','recent-web','strm','authorized-xtream','verify','promotion'],
  pageErrors,
  consoleErrors,
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'production-legacy-local-retirement.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

await browser.close();
