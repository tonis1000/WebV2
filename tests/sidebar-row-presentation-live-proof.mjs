import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'f9f861641856bacdcc16b8be0b255dcfa318b692';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/sidebar-row-presentation-live';
const TOKEN='ci-sidebar-row-presentation-proof';
const MEDIA_URL='https://webv2-qa.invalid/qathree.webm';
const MEDIA_BASE64='GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAK+EU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEjTbuMU6uEHFO7a1OsggKo7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjEuNy4xMDNXQYxMYXZmNjEuNy4xMDNEiYhAj0AAAAAAABZUrmvIrgEAAAAAAAA/14EBc8WIS2lJ61a9wBicgQAitZyDdW5kiIEAhoVWX1ZQOYOBASPjg4QF9eEA4JCwgaC6gVqagQJVsIRVuYEBElTDZ0B/c3OfY8CAZ8iZRaOHRU5DT0RFUkSHjExhdmY2MS43LjEwM3Nz2mPAi2PFiEtpSetWvcAYZ8ilRaOHRU5DT0RFUkSHmExhdmM2MS4xOS4xMDEgbGlidnB4LXZwOWfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDEuMDAwMDAwMDAwAB9DtnVA+ueBAKOmgQAAgIJJg0IACfAFlgA4JBwYQgAAMGAAAGc///9ZrxE7uM+GT4CjlYEAZACGAECSnABJQAADIAAAWfmG4KOVgQDIAIYAQJKcAFEgAAMgAABZ+Ybgo5WBASwAhgBAkpwAS8AAAyAAAFn5huCjlYEBkACGAECSnABKwAADIAAAWfmG4KOVgQH0AIYAQJKcAEnAAAMgAABZ+Ybgo5WBA1gAhgBAkpwASKAAAyAAAFn5huCjlYECvACGAECSnABHgAADIAAAWfmG4KOVgQMgAIYAQJKcAEbgAAMgAABZ+Ybgo5WBA4QAhgBAkpwARkAAAyAAAFn5huAcU7trkbuPs4EAt4r3gQHxggGo8IED';

await fs.mkdir(ARTIFACT_DIR,{recursive:true});
const media=Buffer.from(MEDIA_BASE64,'base64');
const channels=[
  {id:'qa-one',name:'QA One',tvgId:'qa-one',logo:'',groupName:'QA',position:0,sources:[{url:'https://webv2-qa.invalid/qaone.webm',origin:'curated',priority:100}]},
  {id:'qa-two',name:'QA Two',tvgId:'qa-two',logo:'',groupName:'QA',position:1,sources:[{url:'https://webv2-qa.invalid/qatwo.webm',origin:'curated',priority:100}]},
  {id:'qa-three',name:'QA Three',tvgId:'qa-three',logo:'',groupName:'QA',position:2,sources:[{url:MEDIA_URL,origin:'curated',priority:100}]}
];
const favoriteIds=['qaone','qathree'];

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.addInitScript(({token})=>{
  localStorage.setItem('webtv_v2_registry_token',token);
  localStorage.setItem('webtv_v2_favorites_filter_v1','0');
  localStorage.removeItem('webtv_v2_favorites_v1');
}, {token:TOKEN});
await context.setExtraHTTPHeaders({'cache-control':'no-cache',pragma:'no-cache'});
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
const registryWrites=[];
let favoritesGets=0;
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
page.on('dialog',async dialog=>dialog.dismiss());

const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
await page.route('https://webtv-registry.atonis.workers.dev/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  if(method!=='GET')registryWrites.push({method,path:url.pathname});
  if(url.pathname==='/api/status')return json(route,{ok:true,service:'WebTV Registry',version:'1.5',d1:true,primaryPlaylist:'d1',pinAuth:false,pinAuthDisabled:true});
  if(url.pathname==='/api/session'||url.pathname==='/api/session/validate')return json(route,{ok:true});
  if(url.pathname==='/api/my-playlist'&&method==='GET')return json(route,{channels});
  if(url.pathname==='/api/favorites'&&method==='GET'){favoritesGets+=1;return json(route,{favorites:favoriteIds});}
  if(url.pathname==='/api/playlists'&&method==='GET')return json(route,{playlists:[]});
  if(url.pathname==='/api/health'&&method==='GET')return json(route,{health:{},modes:{}});
  return json(route,{ok:true});
});

await page.route('https://webv2-qa.invalid/**',route=>{
  const range=route.request().headers()['range']||'';
  const headers={'access-control-allow-origin':'*','cache-control':'no-store','accept-ranges':'bytes'};
  if(range){
    const match=/bytes=(\d+)-(\d*)/.exec(range);
    const start=match?Number(match[1]):0;
    const requestedEnd=match?.[2]?Number(match[2]):media.length-1;
    const end=Math.min(requestedEnd,media.length-1);
    const chunk=media.subarray(start,end+1);
    return route.fulfill({status:206,contentType:'video/webm',headers:{...headers,'content-range':`bytes ${start}-${end}/${media.length}`,'content-length':String(chunk.length)},body:chunk});
  }
  return route.fulfill({status:200,contentType:'video/webm',headers:{...headers,'content-length':String(media.length)},body:media});
});

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production load failed: ${response?.status()}`);
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.ready===true,null,{timeout:25000});
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.getCatalogMode?.()==='cloud'&&window.WebTVPlaylistAPI?.getCount?.()===3,null,{timeout:15000});
await page.waitForFunction(()=>document.querySelectorAll('#channel-list .channel-item').length===3,null,{timeout:10000});
await page.waitForFunction(()=>document.querySelectorAll('#channel-list .channel-item.favorite').length===2,null,{timeout:10000});
await page.waitForFunction(()=>document.querySelectorAll('#channel-list .channel-now-inline').length===3,null,{timeout:10000});

const snapshot=()=>page.evaluate(()=>({
  mode:window.WebTVPlaylistAPI.getCatalogMode(),
  summary:document.getElementById('channel-summary')?.textContent?.trim()||'',
  filterHidden:document.getElementById('favorites-filter')?.hidden??null,
  filterText:document.getElementById('favorites-filter')?.textContent?.trim()||'',
  rows:[...document.querySelectorAll('#channel-list .channel-item')].map(row=>({
    id:row.dataset.channelId,
    favorite:row.classList.contains('favorite'),
    active:row.classList.contains('active'),
    hidden:row.hidden,
    now:Boolean(row.querySelector('.channel-now-inline'))
  })),
  selected:window.WebTVPlaylistAPI.getSelectedChannel?.()?.id||null
}));

const initial=await snapshot();
assert.equal(initial.mode,'cloud');
assert.equal(initial.summary,'3 / 3 κανάλια');
assert.equal(initial.filterHidden,false);
assert.deepEqual(initial.rows.map(r=>r.id),['qaone','qathree','qatwo'],'favorite-first order must be owned by main renderer');
assert.deepEqual(initial.rows.map(r=>r.favorite),[true,true,false]);
assert.ok(initial.rows.every(r=>!r.hidden),'renderer must not rely on hidden rows');
assert.ok(initial.rows.every(r=>r.now),'Sidebar Now Playing must decorate every rendered row');

await page.locator('#channel-list .channel-item[data-channel-id="qathree"]').click();
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.getSelectedChannel?.()?.id==='qathree',null,{timeout:10000});
await page.waitForFunction(()=>document.querySelector('#channel-list .channel-item.active')?.dataset?.channelId==='qathree',null,{timeout:5000});

await page.evaluate(()=>{
  window.__qaFavoritePresentationEvents=0;
  window.addEventListener('webtv:favorites-presentation-changed',()=>{window.__qaFavoritePresentationEvents+=1;},{once:false});
  document.getElementById('favorites-filter')?.click();
});
await page.waitForTimeout(250);
const postFilterDiagnostic=await page.evaluate(()=>({
  apiState:window.WebTVFavoritesPresentationAPI?.getState?.()||null,
  eventCount:window.__qaFavoritePresentationEvents||0,
  filterText:document.getElementById('favorites-filter')?.textContent?.trim()||'',
  rowCount:document.querySelectorAll('#channel-list .channel-item').length,
  nowCount:document.querySelectorAll('#channel-list .channel-now-inline').length,
  summary:document.getElementById('channel-summary')?.textContent?.trim()||''
}));
assert.equal(postFilterDiagnostic.apiState?.favoritesOnly,true,`Favorites filter click must toggle canonical presentation state: ${JSON.stringify(postFilterDiagnostic)}`);
assert.ok(postFilterDiagnostic.eventCount>=1,`Favorites filter click must emit presentation event: ${JSON.stringify(postFilterDiagnostic)}`);
assert.equal(postFilterDiagnostic.rowCount,2,`main renderer must consume Favorites presentation event: ${JSON.stringify(postFilterDiagnostic)}`);
assert.equal(postFilterDiagnostic.nowCount,2,`Sidebar Now Playing must redecorate the rerendered Favorites rows: ${JSON.stringify(postFilterDiagnostic)}`);

const favoritesOnly=await snapshot();
assert.equal(favoritesOnly.summary,'2 / 3 κανάλια','summary must match rendered Favorites-only rows');
assert.equal(favoritesOnly.filterText,'★ Favorites only');
assert.deepEqual(favoritesOnly.rows.map(r=>r.id),['qaone','qathree']);
assert.ok(favoritesOnly.rows.every(r=>r.favorite&&!r.hidden&&r.now));
assert.equal(favoritesOnly.selected,'qathree','selection must survive main-owned Favorites rerender');
assert.equal(favoritesOnly.rows.find(r=>r.active)?.id,'qathree','active row must survive main-owned Favorites rerender');

const tempM3u=`#EXTM3U
#EXTINF:-1 tvg-id="temp-one" tvg-name="Temp One" group-title="TEMP",Temp One
https://webv2-qa.invalid/temp-one.webm
#EXTINF:-1 tvg-id="temp-two" tvg-name="Temp Two" group-title="TEMP",Temp Two
https://webv2-qa.invalid/temp-two.webm
`;
await page.evaluate(text=>window.WebTVPlaylistAPI.applyText(text,{mode:'replace',label:'Sidebar Row Ownership QA'}),tempM3u);
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.getCatalogMode?.()==='temporary'&&document.querySelectorAll('#channel-list .channel-item').length===2,null,{timeout:5000});
await page.waitForFunction(()=>document.querySelectorAll('#channel-list .channel-now-inline').length===2,null,{timeout:5000});

const temporary=await snapshot();
assert.equal(temporary.mode,'temporary');
assert.equal(temporary.filterHidden,true,'Favorites filter must be hidden outside My Playlist');
assert.equal(temporary.summary,'2 / 2 κανάλια','temporary catalog must ignore persisted Favorites-only state');
assert.ok(temporary.rows.every(r=>!r.favorite&&!r.hidden&&r.now),'temporary rows must render normally and retain Sidebar decoration');

await page.evaluate(()=>window.WebTVPlaybackAPI?.stop?.());
await page.waitForTimeout(250);

assert.equal(favoritesGets,1,'Favorites startup must issue exactly one cloud read');
assert.equal(registryWrites.length,0,`verification must persist nothing: ${JSON.stringify(registryWrites)}`);
assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  initial,
  favoritesOnly,
  temporary,
  favoritesGets,
  registryWrites,
  pageErrors,
  consoleErrors,
  mainOwnsOrderVisibilitySummary:true,
  sidebarDecorationSurvivesRerenders:true
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'production-sidebar-row-presentation.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
