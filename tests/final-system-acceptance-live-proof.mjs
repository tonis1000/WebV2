import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'3fd863325511a332268dc6238a08a236341f3cf0';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/final-system-acceptance-live';
await fs.mkdir(ARTIFACT_DIR,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1200}});
await context.setExtraHTTPHeaders({'cache-control':'no-cache',pragma:'no-cache'});
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
const durableWrites=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});

await page.route('https://webtv-registry.atonis.workers.dev/**',async route=>{
  const req=route.request();
  const pathname=new URL(req.url()).pathname;
  if(req.method()!=='GET' && pathname!=='/api/health'){
    durableWrites.push({method:req.method(),path:pathname});
    return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
  }
  return route.continue();
});

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production page load failed: ${response?.status()}`);

await page.waitForFunction(()=>window.WebTVPlaylistAPI?.ready===true,null,{timeout:30000});
await page.waitForFunction(()=>document.getElementById('unified-search-panel')&&document.getElementById('unified-search-query'),null,{timeout:20000});
await page.waitForFunction(()=>window.WebTVFavoritesPresentationAPI?.getState&&window.WebTVMyPlaylistAPI,null,{timeout:20000});

await page.evaluate(()=>{
  const button=document.getElementById('playlist-manager-toggle');
  if(button) button.click();
});
await page.waitForFunction(()=>document.getElementById('playlist-manager')&&document.getElementById('saved-playlists'),null,{timeout:15000});
await page.waitForFunction(()=>document.getElementById('xtream-tool-card'),null,{timeout:15000});
await page.waitForFunction(()=>document.getElementById('playback-source-inspector'),null,{timeout:15000});
await page.waitForFunction(()=>{
  const rows=document.querySelectorAll('#channel-list .channel-item').length;
  const now=document.querySelectorAll('#channel-list .channel-item .channel-now-inline').length;
  return rows===0 || now===rows;
},null,{timeout:30000});

const state=await page.evaluate(()=>({
  player:{
    video:Boolean(document.getElementById('video')),
    iframe:Boolean(document.getElementById('iframe')),
    status:Boolean(document.getElementById('playback-status')),
    officialLive:Boolean(document.getElementById('official-live')),
    apiTestCandidate:typeof window.WebTVPlaybackAPI?.testCandidate
  },
  sidebar:{
    list:Boolean(document.getElementById('channel-list')),
    summary:String(document.getElementById('channel-summary')?.textContent||'').trim(),
    rows:document.querySelectorAll('#channel-list .channel-item').length,
    rowsWithNow:document.querySelectorAll('#channel-list .channel-item .channel-now-inline').length
  },
  epg:{
    title:Boolean(document.getElementById('program-title')),
    description:Boolean(document.getElementById('program-description')),
    next:Boolean(document.getElementById('next-programs'))
  },
  unifiedSearch:{
    panel:Boolean(document.getElementById('unified-search-panel')),
    query:Boolean(document.getElementById('unified-search-query')),
    nowPlaying:Boolean(document.getElementById('unified-search-now-playing'))
  },
  manualSourceTest:{
    section:Boolean(document.getElementById('source-hunt')),
    candidateUrl:Boolean(document.getElementById('candidate-url')),
    testButton:Boolean(document.getElementById('test-candidate')),
    intro:String(document.querySelector('#source-hunt .hunt-intro')?.textContent||'').trim()
  },
  playlistManager:{
    panel:Boolean(document.getElementById('playlist-manager')),
    savedList:Boolean(document.getElementById('saved-playlists')),
    savedCount:Boolean(document.getElementById('saved-playlist-count')),
    myLibrary:Boolean(document.getElementById('my-playlist-library')),
    apiKeys:Object.keys(window.WebTVMyPlaylistAPI||{}).sort(),
    retiredSaveDiscovered:typeof window.WebTVMyPlaylistAPI?.saveDiscoveredChannel,
    upsert:typeof window.WebTVMyPlaylistAPI?.upsertChannel,
    addSource:typeof window.WebTVMyPlaylistAPI?.addSourceToCurrent,
    replaceSources:typeof window.WebTVMyPlaylistAPI?.replaceSourcesForCurrent
  },
  favorites:{
    control:Boolean(document.getElementById('favorites-filter')),
    state:window.WebTVFavoritesPresentationAPI?.getState?.()||null
  },
  xtream:{
    tool:Boolean(document.getElementById('xtream-tool-card')),
    previewButton:Boolean(document.getElementById('xtream-connect-save')),
    accountsSelect:Boolean(document.getElementById('xtream-account-select')),
    loader:typeof window.WebTVXtream?.loadAccountById
  },
  diagnostics:{
    panel:Boolean(document.getElementById('diagnostics')),
    inspector:Boolean(document.getElementById('playback-source-inspector')),
    catalogBadge:Boolean(document.getElementById('current-catalog-badge')),
    snapshotApi:typeof window.WebTVDiagnosticsAPI?.getSnapshot,
    sourceHealthApi:typeof window.WebTVDiagnosticsAPI?.getSourceHealthRows
  },
  discovery:{
    legacyBeta:[...document.querySelectorAll('button,h1,h2,h3,p,span')].some(el=>/Discovery Beta/i.test(el.textContent||'')),
    legacyScripts:[...document.scripts].map(s=>s.src).filter(src=>/discovery-ui\.js|new-xtream-preview\.js|cloud-auto-sync\.js|d1-sync-addon\.js|official-fallbacks\.js/.test(src))
  },
  playlistApi:{
    getChannels:typeof window.WebTVPlaylistAPI?.getChannels,
    getSelectedChannel:typeof window.WebTVPlaylistAPI?.getSelectedChannel,
    catalogMode:typeof window.WebTVPlaylistAPI?.getCatalogMode,
    ready:window.WebTVPlaylistAPI?.ready===true
  }
}));

assert.deepEqual(state.player,{video:true,iframe:true,status:true,officialLive:true,apiTestCandidate:'function'});
assert.equal(state.sidebar.list,true,'Sidebar channel list must exist');
assert.ok(state.sidebar.summary.length>0,'Sidebar summary must render');
if(state.sidebar.rows>0){
  assert.equal(state.sidebar.rowsWithNow,state.sidebar.rows,'every rendered channel row must retain Sidebar Now presentation');
}
assert.deepEqual(state.epg,{title:true,description:true,next:true});
assert.equal(state.unifiedSearch.panel,true);
assert.equal(state.unifiedSearch.query,true);
assert.equal(state.unifiedSearch.nowPlaying,true);
assert.equal(state.manualSourceTest.section,true);
assert.equal(state.manualSourceTest.candidateUrl,true);
assert.equal(state.manualSourceTest.testButton,true);
assert.match(state.manualSourceTest.intro,/Unified Search is the only automatic discovery surface/);

assert.equal(state.playlistManager.panel,true);
assert.equal(state.playlistManager.savedList,true);
assert.equal(state.playlistManager.savedCount,true);
assert.equal(state.playlistManager.myLibrary,true);
assert.equal(state.playlistManager.retiredSaveDiscovered,'undefined');
assert.equal(state.playlistManager.upsert,'function');
assert.equal(state.playlistManager.addSource,'function');
assert.equal(state.playlistManager.replaceSources,'function');

assert.equal(state.favorites.control,true,'Favorites control must remain installed');
assert.ok(state.favorites.state && Array.isArray(state.favorites.state.favorites),'Favorites presentation state must remain structured');

assert.equal(state.xtream.tool,true);
assert.equal(state.xtream.previewButton,true);
assert.equal(state.xtream.accountsSelect,true);
assert.equal(state.xtream.loader,'function');

assert.equal(state.diagnostics.panel,true);
assert.equal(state.diagnostics.inspector,true);
assert.equal(state.diagnostics.catalogBadge,true);
assert.equal(state.diagnostics.snapshotApi,'function');
assert.equal(state.diagnostics.sourceHealthApi,'function');

assert.equal(state.discovery.legacyBeta,false,'Discovery Beta UI must remain retired');
assert.equal(state.discovery.legacyScripts.length,0,'retired dormant scripts must not load');

assert.equal(state.playlistApi.getChannels,'function');
assert.equal(state.playlistApi.getSelectedChannel,'function');
assert.equal(state.playlistApi.catalogMode,'function');
assert.equal(state.playlistApi.ready,true);

assert.equal(durableWrites.length,0,`final acceptance must not persist user data: ${JSON.stringify(durableWrites)}`);
assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  state,
  durableWrites,
  pageErrors,
  consoleErrors,
  accepted:true
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'final-production-acceptance.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
