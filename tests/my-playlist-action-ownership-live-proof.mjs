import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'3adc057cd2f0186a1fab506c7c8e4d36ceea9973';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/my-playlist-action-ownership-live';
const TOKEN='ci-my-playlist-ownership-proof';

await fs.mkdir(ARTIFACT_DIR,{recursive:true});

const myChannels=[
  {
    id:'qa-one',name:'QA One',tvgId:'qa-one',logo:'',groupName:'QA',position:0,
    sources:[{url:'https://example.test/qa-one.mp4',origin:'curated',priority:100}]
  },
  {
    id:'qa-two',name:'QA Two',tvgId:'qa-two',logo:'',groupName:'QA',position:1,
    sources:[{url:'https://example.test/qa-two.mp4',origin:'curated',priority:100}]
  }
];
let favoriteIds=['qa-one'];
const writes=[];

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.addInitScript(token=>localStorage.setItem('webtv_v2_registry_token',token),TOKEN);
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
  if(url.pathname==='/api/session'||url.pathname==='/api/session/validate')return json(route,{ok:true});
  if(url.pathname==='/api/my-playlist'&&method==='GET')return json(route,{channels:myChannels});
  if(url.pathname==='/api/favorites'&&method==='GET')return json(route,{favorites:favoriteIds});
  if(url.pathname==='/api/favorites'&&method==='PUT'){
    const body=JSON.parse(req.postData()||'{}');
    favoriteIds=Array.isArray(body.favorites)?body.favorites.map(String):[];
    writes.push({kind:'favorites',method,path:url.pathname,body});
    return json(route,{ok:true,favorites:favoriteIds});
  }
  if(url.pathname==='/api/my-playlist/channel'&&method==='PUT'){
    const body=JSON.parse(req.postData()||'{}');
    writes.push({kind:'my-playlist-channel',method,path:url.pathname,body});
    return json(route,{ok:true,channel:body});
  }
  if(url.pathname==='/api/my-playlist/order'&&method==='PATCH'){
    writes.push({kind:'my-playlist-order',method,path:url.pathname,body:JSON.parse(req.postData()||'{}')});
    return json(route,{ok:true});
  }
  if(url.pathname.startsWith('/api/my-playlist/channel/')&&method==='DELETE'){
    writes.push({kind:'my-playlist-delete',method,path:url.pathname});
    return json(route,{ok:true});
  }
  if(url.pathname==='/api/playlists'&&method==='GET')return json(route,{playlists:[]});
  if(url.pathname==='/api/health'&&method==='GET')return json(route,{health:{},modes:{}});
  if(url.pathname==='/api/health/import'&&method==='POST')return json(route,{ok:true});
  if(url.pathname==='/api/health/mode'&&method==='PUT')return json(route,{ok:true});
  if(url.pathname==='/api/health'&&['PUT','DELETE'].includes(method))return json(route,{ok:true});
  return json(route,{ok:true});
});

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production load failed: ${response?.status()}`);
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.ready===true&&typeof window.WebTVMyPlaylistAPI?.saveDiscoveredChannel==='function',null,{timeout:20000});
await page.evaluate(()=>{document.documentElement.classList.remove('admin-locked');document.documentElement.classList.add('admin-unlocked');});

await page.waitForFunction(()=>window.WebTVPlaylistAPI?.getCatalogMode?.()==='cloud'&&window.WebTVPlaylistAPI?.getCount?.()===2,null,{timeout:15000});
await page.waitForSelector('#favorites-filter',{state:'attached',timeout:10000});
await page.waitForSelector('#favorite-channel',{state:'attached',timeout:10000});
await page.waitForFunction(()=>document.querySelector('#channel-list .channel-item[data-channel-id="qa-one"]')?.classList.contains('favorite')===true,null,{timeout:10000});

const cloudState=await page.evaluate(()=>({
  mode:window.WebTVPlaylistAPI.getCatalogMode(),
  count:window.WebTVPlaylistAPI.getCount(),
  filterHidden:document.getElementById('favorites-filter')?.hidden,
  selectedActionHidden:document.getElementById('favorite-channel')?.hidden,
  rows:[...document.querySelectorAll('#channel-list .channel-item')].map(row=>({
    id:row.dataset.channelId,
    hidden:row.hidden,
    favorite:row.classList.contains('favorite')
  }))
}));
assert.equal(cloudState.mode,'cloud');
assert.equal(cloudState.filterHidden,false,'Favorites filter must be available in My Playlist');
assert.ok(cloudState.rows.some(row=>row.id==='qa-one'&&row.favorite),'stored favorite must decorate My Playlist row');

await page.locator('#channel-list .channel-item[data-channel-id="qa-one"]').click();
await page.waitForFunction(()=>document.getElementById('favorite-channel')?.hidden===false,null,{timeout:5000});
const writesBeforeFavorite=writes.filter(w=>w.kind==='favorites').length;
await page.locator('#favorite-channel').click();
await page.waitForFunction(()=>document.getElementById('favorite-channel')?.textContent?.includes('☆')||document.getElementById('favorite-channel')?.textContent?.includes('★'),null,{timeout:5000});
assert.equal(writes.filter(w=>w.kind==='favorites').length,writesBeforeFavorite+1,'Favorite mutation must write only while My Playlist is active');

const tempM3u=`#EXTM3U
#EXTINF:-1 tvg-id="temp-one" tvg-name="Temp One" group-title="TEMP",Temp One
https://example.test/temp-one.mp4
#EXTINF:-1 tvg-id="temp-two" tvg-name="Temp Two" group-title="TEMP",Temp Two
https://example.test/temp-two.mp4
`;
await page.evaluate(text=>window.WebTVPlaylistAPI.applyText(text,{mode:'replace',label:'Favorite scope QA'}),tempM3u);
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.getCatalogMode?.()==='temporary',null,{timeout:5000});
await page.waitForTimeout(250);

const tempState=await page.evaluate(()=>({
  mode:window.WebTVPlaylistAPI.getCatalogMode(),
  filterHidden:document.getElementById('favorites-filter')?.hidden,
  selectedActionHidden:document.getElementById('favorite-channel')?.hidden,
  rows:[...document.querySelectorAll('#channel-list .channel-item')].map(row=>({
    id:row.dataset.channelId,
    hidden:row.hidden,
    favorite:row.classList.contains('favorite'),
    title:row.title
  }))
}));
assert.equal(tempState.mode,'temporary');
assert.equal(tempState.filterHidden,true,'Favorites filter must be hidden outside My Playlist');
assert.ok(tempState.rows.every(row=>!row.hidden),'favorite-only mode must not hide temporary catalog rows');
assert.ok(tempState.rows.every(row=>!row.favorite&&!row.title),'temporary catalog rows must not inherit favorite decoration');

await page.locator('#channel-list .channel-item').first().click();
await page.waitForTimeout(100);
assert.equal(await page.locator('#favorite-channel').evaluate(el=>el.hidden),true,'Favorite action must stay hidden for temporary selected channels');

const writesBeforeHiddenClick=writes.filter(w=>w.kind==='favorites').length;
await page.evaluate(()=>document.getElementById('favorite-channel')?.click());
await page.waitForTimeout(100);
assert.equal(writes.filter(w=>w.kind==='favorites').length,writesBeforeHiddenClick,'hidden Favorite action must no-op outside My Playlist');

await page.evaluate(()=>window.WebTVPlaylistAPI.reloadCloudMyPlaylist({reason:'ownership-live-proof',preserveSelection:false}));
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.getCatalogMode?.()==='cloud'&&window.WebTVPlaylistAPI?.getCount?.()===2,null,{timeout:10000});

const writesBeforeDiscovered=writes.filter(w=>w.kind==='my-playlist-channel').length;
const discovered={
  id:'hunt-discovered',
  originalId:'hunt-discovered',
  tvgId:'hunt-discovered',
  name:'Hunt Discovered',
  group:'Discovered',
  logo:'',
  directUrls:[]
};
await page.evaluate(async channel=>{
  await window.WebTVMyPlaylistAPI.saveDiscoveredChannel(
    channel,
    [{url:'https://example.test/hunt-discovered.mp4',origin:'source-hunt',priority:100}],
    {reason:'source-hunt-save'}
  );
},discovered);
const myWrites=writes.filter(w=>w.kind==='my-playlist-channel');
assert.equal(myWrites.length,writesBeforeDiscovered+1,'canonical discovered-channel save must perform exactly one My Playlist write');
const discoveredWrite=myWrites.at(-1).body;
assert.equal(discoveredWrite.position,999999,'Source Hunt append positioning must be preserved');
assert.equal(discoveredWrite.replaceSources,true);
assert.equal(discoveredWrite.sources?.[0]?.url,'https://example.test/hunt-discovered.mp4');
assert.equal(discoveredWrite.sources?.[0]?.origin,'source-hunt');
assert.equal(discoveredWrite.sources?.[0]?.priority,100);

const guardUrl='https://example.test/loaded-xtream-live.m3u8';
await page.evaluate(url=>{
  window.WebTVXtream={
    ...(window.WebTVXtream||{}),
    getLoaded:()=>({channels:[{playbackUrl:url}]})
  };
},guardUrl);
const writesBeforeGuard=writes.filter(w=>w.kind==='my-playlist-channel').length;
const guardResult=await page.evaluate(async url=>{
  try{
    await window.WebTVMyPlaylistAPI.saveDiscoveredChannel(
      {id:'loaded-xtream',originalId:'loaded-xtream',name:'Loaded Xtream',group:'XTREAM',directUrls:[]},
      [{url,origin:'source-hunt',priority:100}],
      {reason:'source-hunt-save'}
    );
    return {ok:true,error:''};
  }catch(error){
    return {ok:false,error:error?.message||String(error)};
  }
},guardUrl);
assert.equal(guardResult.ok,false,'Source Hunt canonical writer must reject a loaded Xtream source');
assert.match(guardResult.error,/Xtream Test \/ Preview.*Save Channel/i);
assert.equal(writes.filter(w=>w.kind==='my-playlist-channel').length,writesBeforeGuard,'blocked loaded-Xtream Source Hunt save must persist nothing');

assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  cloudState,
  tempState,
  favoriteWrites:writes.filter(w=>w.kind==='favorites'),
  myPlaylistWrites:writes.filter(w=>w.kind==='my-playlist-channel'),
  discoveredWrite,
  loadedXtreamBlocked:!guardResult.ok,
  loadedXtreamError:guardResult.error,
  pageErrors,
  consoleErrors
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'production-my-playlist-action-ownership.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

await browser.close();
