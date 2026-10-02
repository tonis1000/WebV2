import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'06e4d0cc0696b19c916f0f65007a3cf2572a0356';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/sidebar-selection-ownership-final-live';
const MEDIA_URL='https://webv2-qa.invalid/sidebar-selection.webm';
const MEDIA_URL_2='https://webv2-qa.invalid/sidebar-selection-v2.webm';
const MEDIA_BASE64='GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAK+EU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEjTbuMU6uEHFO7a1OsggKo7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjEuNy4xMDNXQYxMYXZmNjEuNy4xMDNEiYhAj0AAAAAAABZUrmvIrgEAAAAAAAA/14EBc8WIS2lJ61a9wBicgQAitZyDdW5kiIEAhoVWX1ZQOYOBASPjg4QF9eEA4JCwgaC6gVqagQJVsIRVuYEBElTDZ0B/c3OfY8CAZ8iZRaOHRU5DT0RFUkSHjExhdmY2MS43LjEwM3Nz2mPAi2PFiEtpSetWvcAYZ8ilRaOHRU5DT0RFUkSHmExhdmM2MS4xOS4xMDEgbGlidnB4LXZwOWfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDEuMDAwMDAwMDAwAB9DtnVA+ueBAKOmgQAAgIJJg0IACfAFlgA4JBwYQgAAMGAAAGc///9ZrxE7uM+GT4CjlYEAZACGAECSnABJQAADIAAAWfmG4KOVgQDIAIYAQJKcAFEgAAMgAABZ+Ybgo5WBASwAhgBAkpwAS8AAAyAAAFn5huCjlYEBkACGAECSnABKwAADIAAAWfmG4KOVgQH0AIYAQJKcAEnAAAMgAABZ+Ybgo5WBA1gAhgBAkpwASKAAAyAAAFn5huCjlYECvACGAECSnABHgAADIAAAWfmG4KOVgQMgAIYAQJKcAEbgAAMgAABZ+Ybgo5WBA4QAhgBAkpwARkAAAyAAAFn5huAcU7trkbuPs4EAt4r3gQHxggGo8IED';

await fs.mkdir(ARTIFACT_DIR,{recursive:true});
const media=Buffer.from(MEDIA_BASE64,'base64');
assert.ok(media.length>500,'deterministic QA media fixture must exist');

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.setExtraHTTPHeaders({'cache-control':'no-cache',pragma:'no-cache'});
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
const registryWrites=[];
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
page.on('dialog',async dialog=>dialog.dismiss());

await page.route('https://webv2-qa.invalid/**',route=>{
  const range=route.request().headers()['range']||'';
  const baseHeaders={'access-control-allow-origin':'*','cache-control':'no-store','accept-ranges':'bytes'};
  if(range){
    const match=/bytes=(\d+)-(\d*)/.exec(range);
    const start=match?Number(match[1]):0;
    const requestedEnd=match?.[2]?Number(match[2]):media.length-1;
    const end=Math.min(requestedEnd,media.length-1);
    const chunk=media.subarray(start,end+1);
    return route.fulfill({
      status:206,contentType:'video/webm',
      headers:{...baseHeaders,'content-range':`bytes ${start}-${end}/${media.length}`,'content-length':String(chunk.length)},
      body:chunk
    });
  }
  return route.fulfill({status:200,contentType:'video/webm',headers:{...baseHeaders,'content-length':String(media.length)},body:media});
});

page.on('request',request=>{
  const url=new URL(request.url());
  if(url.hostname==='webtv-registry.atonis.workers.dev'&&request.method()!=='GET'){
    registryWrites.push({method:request.method(),path:url.pathname});
  }
});

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production load failed: ${response?.status()}`);
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.ready===true,null,{timeout:25000});
await page.waitForFunction(()=>document.querySelectorAll('#channel-list .channel-item').length>0,null,{timeout:15000});
await page.waitForFunction(()=>document.getElementById('unified-search-now-playing'),null,{timeout:15000});
await page.waitForTimeout(1000);

const productionSidebarBefore=await page.evaluate(()=>({
  channelRows:document.querySelectorAll('#channel-list .channel-item').length,
  nowRows:document.querySelectorAll('#channel-list .channel-now-inline').length,
  visibleNow:[...document.querySelectorAll('#channel-list .channel-now-inline:not(.no-epg)')].length,
  selected:window.WebTVPlaylistAPI?.getSelectedChannel?.()||null
}));
assert.ok(productionSidebarBefore.channelRows>0,'production channel list must render');
assert.equal(productionSidebarBefore.nowRows,productionSidebarBefore.channelRows,'Sidebar Now Playing must decorate each production row');

await page.evaluate(()=>{
  window.__selectionEvents=[];
  window.addEventListener('webtv:channel-selected',event=>{
    const d=event.detail||{};
    window.__selectionEvents.push({
      reason:d.reason||'',
      catalogMode:d.catalogMode||'',
      id:d.channel?.id||null,
      name:d.channel?.name||null,
      directUrls:[...(d.channel?.directUrls||[])]
    });
  });
});

await page.evaluate(mediaUrl=>{
  const m3u=`#EXTM3U
#EXTINF:-1 tvg-id="webv2.sidebar.qa" tvg-name="WebV2 Sidebar QA" group-title="QA",WebV2 Sidebar QA
${mediaUrl}
`;
  window.WebTVPlaylistAPI.applyText(m3u,{mode:'replace',label:'Sidebar Selection Ownership QA'});
},MEDIA_URL);

await page.waitForFunction(()=>window.__selectionEvents?.some(e=>e.reason==='catalog-import'),null,{timeout:5000});

const row=page.locator('#channel-list .channel-item').first();
await row.click();

await page.waitForFunction(()=>window.__selectionEvents?.some(e=>e.reason==='user-select'&&e.id),null,{timeout:10000});
await page.waitForFunction(mediaUrl=>{
  const s=window.WebTVDiagnosticsAPI?.getSnapshot?.();
  return s?.playbackState==='live'&&s?.source===mediaUrl;
},MEDIA_URL,{timeout:20000});
await page.waitForFunction(()=>document.getElementById('unified-search-now-playing')?.textContent?.trim()==='WebV2 Sidebar QA',null,{timeout:5000});

const selectedBeforeTamper=await page.evaluate(()=> {
  const selected=window.WebTVPlaylistAPI.getSelectedChannel();
  const active=document.querySelector('#channel-list .channel-item.active');
  const favorite=document.getElementById('favorite-channel');
  const myAction=document.getElementById('my-playlist-channel-action');
  return {
    selectedId:selected?.id||null,
    selectedName:selected?.name||null,
    selectedUrls:[...(selected?.directUrls||[])],
    activeId:active?.dataset?.channelId||null,
    headerName:document.getElementById('channel-name')?.textContent||'',
    searchNow:document.getElementById('unified-search-now-playing')?.textContent?.trim()||'',
    searchQuery:document.getElementById('unified-search-query')?.value||'',
    favorite:{hidden:favorite?.hidden??null,text:favorite?.textContent||'',disabled:favorite?.disabled??null},
    myAction:{hidden:myAction?.hidden??null,text:myAction?.textContent||'',disabled:myAction?.disabled??null},
    nowRows:document.querySelectorAll('#channel-list .channel-now-inline').length,
    events:window.__selectionEvents
  };
});

assert.equal(selectedBeforeTamper.selectedId,'webv2.sidebar.qa','canonical selected id must preserve QA tvg-id');
assert.equal(selectedBeforeTamper.activeId,selectedBeforeTamper.selectedId,'active row must match canonical selected channel');
assert.equal(selectedBeforeTamper.searchNow,'WebV2 Sidebar QA','Unified Search Now Playing must follow canonical selection');
assert.equal(selectedBeforeTamper.searchQuery,'WebV2 Sidebar QA','Unified Search query must sync from canonical selection');
assert.ok(selectedBeforeTamper.events.some(e=>e.reason==='user-select'&&e.id===selectedBeforeTamper.selectedId),'user selection event must carry canonical id');
assert.equal(selectedBeforeTamper.favorite.hidden,true,'Favorites action must remain hidden for temporary catalog');
assert.equal(selectedBeforeTamper.myAction.hidden,false,'My Playlist action must update for selected temporary channel');

await page.evaluate(()=>{
  const header=document.getElementById('channel-name');
  if(header)header.textContent='DOM TAMPER MUST NOT BECOME SELECTION';
});
await page.waitForTimeout(600);

const selectedAfterTamper=await page.evaluate(()=> {
  const selected=window.WebTVPlaylistAPI.getSelectedChannel();
  const active=document.querySelector('#channel-list .channel-item.active');
  const favorite=document.getElementById('favorite-channel');
  const myAction=document.getElementById('my-playlist-channel-action');
  return {
    selectedId:selected?.id||null,
    selectedName:selected?.name||null,
    activeId:active?.dataset?.channelId||null,
    searchNow:document.getElementById('unified-search-now-playing')?.textContent?.trim()||'',
    searchQuery:document.getElementById('unified-search-query')?.value||'',
    favorite:{hidden:favorite?.hidden??null,text:favorite?.textContent||'',disabled:favorite?.disabled??null},
    myAction:{hidden:myAction?.hidden??null,text:myAction?.textContent||'',disabled:myAction?.disabled??null},
    events:window.__selectionEvents
  };
});

assert.equal(selectedAfterTamper.selectedId,selectedBeforeTamper.selectedId,'DOM header tamper must not alter canonical selection');
assert.equal(selectedAfterTamper.activeId,selectedBeforeTamper.activeId,'DOM header tamper must not alter active row');
assert.equal(selectedAfterTamper.searchNow,selectedBeforeTamper.searchNow,'DOM header tamper must not alter Unified Search Now Playing');
assert.equal(selectedAfterTamper.searchQuery,selectedBeforeTamper.searchQuery,'DOM header tamper must not alter Unified Search query');
assert.deepEqual(selectedAfterTamper.favorite,selectedBeforeTamper.favorite,'DOM header tamper must not alter Favorites state');
assert.deepEqual(selectedAfterTamper.myAction,selectedBeforeTamper.myAction,'DOM header tamper must not alter Playlist Manager state');

await page.evaluate(mediaUrl=>{
  const m3u=`#EXTM3U
#EXTINF:-1 tvg-id="webv2.sidebar.qa" tvg-name="WebV2 Sidebar QA v2" group-title="QA",WebV2 Sidebar QA v2
${mediaUrl}
`;
  window.WebTVPlaylistAPI.applyText(m3u,{mode:'replace',label:'Sidebar Selection Ownership QA v2'});
},MEDIA_URL_2);

await page.waitForFunction(()=>window.__selectionEvents?.some(e=>e.reason==='catalog-import'&&e.name==='WebV2 Sidebar QA v2'),null,{timeout:5000});
await page.waitForFunction(()=>document.getElementById('unified-search-now-playing')?.textContent?.trim()==='WebV2 Sidebar QA v2',null,{timeout:5000});

const afterSameIdReplacement=await page.evaluate(()=> {
  const selected=window.WebTVPlaylistAPI.getSelectedChannel();
  const active=document.querySelector('#channel-list .channel-item.active');
  return {
    selectedId:selected?.id||null,
    selectedName:selected?.name||null,
    selectedUrls:[...(selected?.directUrls||[])],
    activeId:active?.dataset?.channelId||null,
    activeName:active?.querySelector('strong')?.textContent?.trim()||'',
    searchNow:document.getElementById('unified-search-now-playing')?.textContent?.trim()||'',
    searchQuery:document.getElementById('unified-search-query')?.value||'',
    nowRows:document.querySelectorAll('#channel-list .channel-now-inline').length,
    events:window.__selectionEvents
  };
});

assert.equal(afterSameIdReplacement.selectedId,'webv2.sidebar.qa','same-id replacement must preserve canonical id');
assert.equal(afterSameIdReplacement.selectedName,'WebV2 Sidebar QA v2','same-id replacement must rebind selected channel object');
assert.deepEqual(afterSameIdReplacement.selectedUrls,[MEDIA_URL_2],'same-id replacement must expose replacement source snapshot');
assert.equal(afterSameIdReplacement.activeId,afterSameIdReplacement.selectedId,'same-id replacement active row must stay canonical');
assert.equal(afterSameIdReplacement.activeName,'WebV2 Sidebar QA v2','same-id replacement active row must render replacement object');
assert.equal(afterSameIdReplacement.searchNow,'WebV2 Sidebar QA v2','Unified Search Now Playing must follow replacement selection');
assert.equal(afterSameIdReplacement.searchQuery,'WebV2 Sidebar QA v2','Unified Search query must follow replacement selection');
assert.equal(afterSameIdReplacement.nowRows,1,'Sidebar Now Playing must continue decorating the replacement row');

await page.evaluate(()=>window.WebTVPlaybackAPI?.stop?.());
await page.waitForTimeout(300);

assert.equal(registryWrites.length,0,`verification must not persist user data: ${JSON.stringify(registryWrites)}`);
assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  mediaBytes:media.length,
  productionSidebarBefore,
  selectedBeforeTamper,
  selectedAfterTamper,
  afterSameIdReplacement,
  domTamperDidNotChangeSelectionConsumers:true,
  sameIdReplacementReboundCanonicalSelection:true,
  unifiedSearchUsesCanonicalSelection:true,
  registryWrites,
  pageErrors,
  consoleErrors
};

await page.screenshot({path:path.join(ARTIFACT_DIR,'production-sidebar-selection-ownership-final.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
