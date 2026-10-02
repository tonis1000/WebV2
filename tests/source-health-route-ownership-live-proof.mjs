import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'367421d007c79cd6e7d54e61278c56dc62a910d6';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/source-health-route-ownership-live';
const FAKE_TOKEN='ci-source-health-ownership-proof';
const HLS='https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

await fs.mkdir(ARTIFACT_DIR,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.setExtraHTTPHeaders({'cache-control':'no-cache',pragma:'no-cache'});
await context.addInitScript(token=>{
  localStorage.setItem('webtv_v2_registry_token',token);
},FAKE_TOKEN);
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
page.on('dialog',async dialog=>dialog.accept());

const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
await page.route('https://webtv-registry.atonis.workers.dev/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
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
assert.ok(response?.ok(),`production WebV2 load failed: ${response?.status()}`);
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.ready===true&&typeof window.WebTVDiagnosticsAPI?.getSourceHealthRows==='function',null,{timeout:20000});
await page.evaluate(()=>{document.documentElement.classList.remove('admin-locked');document.documentElement.classList.add('admin-unlocked');});

const syntheticRows=await page.evaluate(async()=>{
  const api=window.WebTVDiagnosticsAPI;
  const channel={
    id:'source-health-live-contract',
    name:'Source Health Live Contract',
    directUrls:[
      'https://example.test/live.m3u8',
      'https://example.test/headers.m3u8|User-Agent=WebTV-QA',
      'http://example.test/http-only.m3u8',
      'https://example.test/manifest.mpd',
      'https://example.test/video.mp4',
      'https://example.test/not-media.json',
    ],
  };
  return api.getSourceHealthRows(channel);
});

const kindsFor=source=>syntheticRows.filter(row=>row.source===source).map(row=>row.kind).sort();
assert.deepEqual(kindsFor('https://example.test/live.m3u8'),['direct','worker'],'live SourceRegistry must expose HTTPS HLS direct + worker');
assert.deepEqual(kindsFor('https://example.test/headers.m3u8'),['direct','worker+headers'],'live SourceRegistry must preserve worker+headers');
assert.deepEqual(kindsFor('http://example.test/http-only.m3u8'),['worker'],'live SourceRegistry must expose HTTP HLS worker-only');
assert.deepEqual(kindsFor('https://example.test/manifest.mpd'),['direct'],'live SourceRegistry must expose DASH direct');
assert.deepEqual(kindsFor('https://example.test/video.mp4'),['direct'],'live SourceRegistry must expose video direct');
assert.equal(syntheticRows.some(row=>row.source==='https://example.test/not-media.json'),false,'live SourceRegistry must exclude non-media HTTPS from playback diagnostics');

const tempM3u=`#EXTM3U
#EXTINF:-1 tvg-id="webv2.sourcehealth.qa" tvg-name="WebV2 Source Health QA" group-title="QA",WebV2 Source Health QA
${HLS}
`;
await page.evaluate(({text})=>window.WebTVPlaylistAPI.applyText(text,{mode:'replace',label:'Source Health Ownership QA'}),{text:tempM3u});
const row=page.locator('#channel-list [data-channel-id]').first();
await row.click();
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.getSelectedChannel?.()?.name==='WebV2 Source Health QA',null,{timeout:10000});

if(await page.locator('#diagnostics').evaluate(el=>el.hidden))await page.locator('#diagnostics-toggle').click();
await page.waitForFunction(()=>document.getElementById('source-health')&&document.querySelectorAll('#source-health .source-health-row').length>=2,null,{timeout:15000});

const selected=await page.evaluate(()=>window.WebTVPlaylistAPI.getSelectedChannel());
const canonical=await page.evaluate(channel=>window.WebTVDiagnosticsAPI.getSourceHealthRows(channel),selected);
const routedCanonical=canonical.filter(item=>!item.reference&&!item.unsupported);
assert.deepEqual(routedCanonical.map(item=>item.kind).sort(),['direct','worker'],'selected HLS canonical diagnostics must expose direct + worker');

const uiRows=await page.locator('#source-health .source-health-row').evaluateAll(nodes=>nodes.map(node=>({
  title:node.querySelector('strong')?.textContent||'',
  source:node.querySelector('code')?.textContent||'',
})));
for(const canonicalRow of routedCanonical){
  assert.ok(
    uiRows.some(row=>row.source===canonicalRow.source&&row.title.startsWith(canonicalRow.kind.toUpperCase())),
    `Source Health UI must present canonical row ${canonicalRow.kind} ${canonicalRow.source}`
  );
}

const plan=await page.evaluate(()=>window.WebTVDiagnosticsAPI.lastRoutePlan||[]);
const selectedPlanKinds=plan.filter(item=>item.source===HLS).map(item=>item.route).sort();
assert.deepEqual(selectedPlanKinds,['direct','worker'],'actual playback plan must use the same direct/worker route identities for the curated HLS source');

assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  syntheticRouteContract:{
    httpsHls:kindsFor('https://example.test/live.m3u8'),
    headerHls:kindsFor('https://example.test/headers.m3u8'),
    httpHls:kindsFor('http://example.test/http-only.m3u8'),
    dash:kindsFor('https://example.test/manifest.mpd'),
    video:kindsFor('https://example.test/video.mp4'),
    nonMediaExcluded:!syntheticRows.some(row=>row.source==='https://example.test/not-media.json'),
  },
  selectedCanonicalKinds:routedCanonical.map(item=>item.kind).sort(),
  playbackPlanKinds:selectedPlanKinds,
  uiRows,
  pageErrors,
  consoleErrors,
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'production-source-health-route-ownership.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
