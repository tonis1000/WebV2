import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const MOCK_URL=process.env.XTREAM_MOCK_URL||'https://webtv-xtream-mock.atonis.workers.dev';
const RUNTIME_SHA=process.env.RUNTIME_SHA||'7fd58ee145884d09e19d4ef1321c18f0fdabc028';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/playback-inspector-boundary-live';
const FAKE_TOKEN='ci-inspector-boundary-proof';
const SOURCE_A='https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const SOURCE_B=SOURCE_A+'?webv2qa=edit';
const SOURCE_C=SOURCE_A+'?webv2qa=add';
const XTREAM_SOURCE=SOURCE_A+'?webv2qa=loaded-xtream';

await fs.mkdir(ARTIFACT_DIR,{recursive:true});

async function providerJson(action=''){
  const url=new URL('/player_api.php',MOCK_URL);
  url.searchParams.set('username','test_50');
  url.searchParams.set('password','test_pass');
  if(action)url.searchParams.set('action',action);
  const response=await fetch(url,{headers:{'cache-control':'no-cache'}});
  assert.ok(response.ok,`mock provider ${action||'login'} HTTP ${response.status}`);
  return response.json();
}
const [login,categories,streams]=await Promise.all([
  providerJson(),
  providerJson('get_live_categories'),
  providerJson('get_live_streams'),
]);
assert.equal(String(login?.user_info?.auth),'1','authorized mock must authenticate');
assert.equal(streams.length,50,'authorized mock test_50 must expose 50 streams');
const categoryNames=new Map(categories.map(row=>[String(row.category_id),String(row.category_name||'Xtream')]));
const loadedXtream=streams.slice(0,2).map((stream,index)=>({
  streamId:String(stream.stream_id),
  tvgId:String(stream.epg_channel_id||stream.name||stream.stream_id),
  name:String(stream.name||stream.stream_id),
  logo:String(stream.stream_icon||''),
  group:categoryNames.get(String(stream.category_id))||'Xtream',
  categoryId:String(stream.category_id||''),
  playbackUrl:XTREAM_SOURCE+`&stream=${index+1}`,
}));

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.setExtraHTTPHeaders({'cache-control':'no-cache',pragma:'no-cache'});
await context.addInitScript(token=>{
  localStorage.setItem('webtv_v2_registry_token',token);
},FAKE_TOKEN);
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
const writes=[];
let myPlaylist=[];
const savedAccounts=[{id:'xt_ci_inspector',name:'CI Inspector Xtream',server:MOCK_URL,tested:{status:'Active'}}];

page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
page.on('dialog',async dialog=>dialog.accept());

const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
const toRegistryRow=body=>({
  id:body.id,
  tvgId:body.tvgId||body.id,
  name:body.name,
  logo:body.logo||'',
  groupName:body.groupName||'Other',
  position:Number(body.position)||0,
  sources:(body.sources||[]).map((source,index)=>({
    url:String(source.url||''),
    origin:String(source.origin||'curated'),
    priority:Number(source.priority)||100+index,
    enabled:true,
  })),
});

await page.route('https://webtv-registry.atonis.workers.dev/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  if(url.pathname==='/api/status')return json(route,{ok:true,service:'WebTV Registry',version:'1.5',d1:true,primaryPlaylist:'d1',pinAuth:false,pinAuthDisabled:true});
  if(url.pathname==='/api/session'||url.pathname==='/api/session/validate')return json(route,{ok:true});
  if(url.pathname==='/api/my-playlist'&&method==='GET')return json(route,{channels:myPlaylist});
  if(url.pathname==='/api/my-playlist/channel'&&method==='PUT'){
    const body=req.postDataJSON();
    writes.push({target:'my-playlist',body});
    const row=toRegistryRow(body);
    const index=myPlaylist.findIndex(item=>item.id===row.id);
    if(index>=0)myPlaylist[index]=row;else myPlaylist.push(row);
    return json(route,{ok:true,channel:row});
  }
  if(/^\/api\/my-playlist\/channel\//.test(url.pathname)&&method==='DELETE'){
    const id=decodeURIComponent(url.pathname.split('/').pop()||'');
    myPlaylist=myPlaylist.filter(item=>item.id!==id);
    writes.push({target:'my-playlist-delete',id});
    return json(route,{ok:true});
  }
  if(url.pathname==='/api/my-playlist/order'&&method==='PATCH')return json(route,{ok:true});
  if(url.pathname==='/api/playlists'&&method==='GET')return json(route,{playlists:[]});
  if(url.pathname==='/api/health'&&method==='GET')return json(route,{health:{},modes:{}});
  if(url.pathname==='/api/health/import'&&method==='POST')return json(route,{ok:true});
  if(url.pathname==='/api/health'&&['PUT','DELETE'].includes(method))return json(route,{ok:true});
  if(url.pathname==='/api/health/mode'&&method==='PUT')return json(route,{ok:true});
  return json(route,{ok:true});
});

await page.route('https://webtv-xtream.atonis.workers.dev/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  if(url.pathname==='/api/status')return json(route,{ok:true,service:'WebTV Xtream Bridge',version:'1.7',registryBinding:true,hlsProxy:true});
  if(url.pathname==='/api/accounts'&&method==='GET')return json(route,{accounts:savedAccounts});
  if(url.pathname==='/api/accounts/xt_ci_inspector/channels'&&method==='GET')return json(route,{account:savedAccounts[0],channels:loadedXtream});
  if(/^\/api\/accounts\/[^/]+$/.test(url.pathname)&&method==='DELETE')return json(route,{ok:true,deleted:true});
  if(/^\/api\/channel-sources\/[^/]+$/.test(url.pathname)&&method==='DELETE')return json(route,{ok:true,deleted:true});
  return json(route,{ok:true});
});

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production WebV2 load failed: ${response?.status()}`);
await page.waitForFunction(()=>window.WebTVPlaylistAPI?.ready===true,null,{timeout:20000});
await page.evaluate(()=>{document.documentElement.classList.remove('admin-locked');document.documentElement.classList.add('admin-unlocked');});

const tempM3u=`#EXTM3U
#EXTINF:-1 tvg-id="webv2.inspector.qa" tvg-name="WebV2 Inspector QA" group-title="QA",WebV2 Inspector QA
${SOURCE_A}
`;
await page.evaluate(({text})=>window.WebTVPlaylistAPI.applyText(text,{mode:'replace',label:'Inspector Boundary QA'}),{text:tempM3u});
const tempRow=page.locator('#channel-list [data-channel-id]').first();
await tempRow.click();
await page.waitForFunction(source=>document.getElementById('diag-source')?.textContent?.includes(source),SOURCE_A,{timeout:25000});

await page.locator('#diagnostics-toggle').click();
await page.waitForSelector('#playback-source-inspector',{timeout:10000});
const sourceArea=page.locator('#playback-source-full');
await page.waitForFunction(source=>document.getElementById('playback-source-full')?.value?.includes(source),SOURCE_A,{timeout:10000});

assert.equal(writes.filter(row=>row.target==='my-playlist').length,0,'temporary playback must not persist by itself');
await page.evaluate(()=>{
  const api=window.WebTVPlaybackAPI;
  if(!api?.testCandidate)throw new Error('WebTVPlaybackAPI.testCandidate unavailable');
  const original=api.testCandidate.bind(api);
  window.__inspectorTestAudit={calls:0,settled:false,ok:null,error:''};
  api.testCandidate=async(...args)=>{
    window.__inspectorTestAudit.calls+=1;
    try{
      const result=await original(...args);
      window.__inspectorTestAudit.ok=Boolean(result?.ok);
      return result;
    }catch(error){
      window.__inspectorTestAudit.ok=false;
      window.__inspectorTestAudit.error=error?.message||String(error);
      throw error;
    }finally{
      window.__inspectorTestAudit.settled=true;
    }
  };
});
await sourceArea.fill(SOURCE_A);
await page.locator('#playback-source-test').click();
await page.waitForFunction(()=>window.__inspectorTestAudit?.settled===true,null,{timeout:30000});
const testAudit=await page.evaluate(()=>window.__inspectorTestAudit);
assert.equal(testAudit.calls,1,'Test edited URL must delegate exactly once to WebTVPlaybackAPI.testCandidate');
assert.equal(writes.filter(row=>row.target==='my-playlist').length,0,'Test edited URL must remain temporary playback-only');

await sourceArea.fill(SOURCE_C);
await page.waitForFunction(()=>document.getElementById('playback-source-add')?.disabled===false,null,{timeout:5000});
await page.locator('#playback-source-add').click();
await page.waitForFunction(()=>document.getElementById('playback-inspector-status')?.textContent?.includes('Source added to My Playlist'),null,{timeout:10000});
let myWrites=writes.filter(row=>row.target==='my-playlist');
assert.equal(myWrites.length,1,'normal Inspector Add must perform one canonical My Playlist write');
assert.deepEqual(myWrites[0].body.sources.map(source=>source.url).sort(),[SOURCE_A,SOURCE_C].sort(),'normal Add must preserve existing source and add edited source');

await sourceArea.fill(SOURCE_B);
await page.locator('#playback-source-save-edit').click();
await page.waitForFunction(()=>document.getElementById('playback-inspector-status')?.textContent?.includes('source edit saved to My Playlist'),null,{timeout:10000});
myWrites=writes.filter(row=>row.target==='my-playlist');
assert.equal(myWrites.length,2,'normal Inspector Edit must perform one additional canonical My Playlist write');
assert.deepEqual(myWrites[1].body.sources.map(source=>source.url).sort(),[SOURCE_B,SOURCE_C].sort(),'normal Edit must replace the inspected source without losing the added source');

await page.evaluate(source=>{
  const area=document.getElementById('playback-source-full');
  if(!area)throw new Error('Playback Inspector source field unavailable');
  area.value=source;
  area.dispatchEvent(new Event('input',{bubbles:true}));
  window.dispatchEvent(new CustomEvent('webtv:inspector-source-selected',{detail:{source,route:'qa-selected'}}));
},SOURCE_C);
await page.waitForFunction(source=>document.getElementById('playback-source-full')?.value===source,SOURCE_C,{timeout:5000});
await page.waitForFunction(()=>document.getElementById('playback-source-delete')?.disabled===false,null,{timeout:5000});
await page.locator('#playback-source-delete').click();
await page.waitForFunction(()=>document.getElementById('playback-inspector-status')?.textContent?.includes('Source deleted from'),null,{timeout:10000});
myWrites=writes.filter(row=>row.target==='my-playlist');
assert.equal(myWrites.length,3,'normal Inspector Delete must perform one additional canonical My Playlist write');
assert.deepEqual(myWrites[2].body.sources.map(source=>source.url),[SOURCE_B],'normal Delete must remove only the selected exact source');

await page.locator('#playlist-manager-toggle').click();
await page.waitForSelector('#xtream-tool-card',{timeout:10000});
await page.waitForFunction(()=>document.querySelector('#xtream-account-select option[value="xt_ci_inspector"]'),null,{timeout:10000});
await page.locator('#xtream-account-select').selectOption('xt_ci_inspector');
await page.locator('#xtream-load').click();
await page.waitForFunction(()=>document.getElementById('xtream-status')?.textContent?.includes('saved-account channels loaded temporarily'),null,{timeout:10000});
await page.locator('#playlist-manager-close').click();

const loadedRows=page.locator('#channel-list [data-channel-id]');
assert.ok(await loadedRows.count()>=2,'loaded Xtream account should expose at least two channels');
await loadedRows.nth(1).click();
await page.waitForTimeout(400);
if(await page.locator('#diagnostics').evaluate(el=>el.hidden))await page.locator('#diagnostics-toggle').click();
const loadedSource=await page.evaluate(()=>window.WebTVPlaylistAPI?.getSelectedChannel?.()?.directUrls?.[0]||'');
assert.ok(loadedSource.includes('loaded-xtream'),'loaded Xtream channel must expose its provider-backed source');
await page.evaluate(source=>{
  const area=document.getElementById('playback-source-full');
  if(!area)throw new Error('Playback Inspector source field unavailable');
  area.value=source;
  area.dispatchEvent(new Event('input',{bubbles:true}));
  window.dispatchEvent(new CustomEvent('webtv:inspector-source-selected',{detail:{source,route:'qa-loaded-xtream'}}));
},loadedSource);
await page.waitForFunction(()=>document.getElementById('playback-source-full')?.value?.includes('loaded-xtream'),null,{timeout:5000});

const writesBeforeBlocked=writes.filter(row=>row.target==='my-playlist').length;
await page.waitForFunction(()=>document.getElementById('playback-source-add')?.disabled===false,null,{timeout:5000});
await page.locator('#playback-source-add').click();
await page.waitForFunction(()=>document.getElementById('playback-inspector-status')?.textContent?.includes('Use Xtream Test / Preview'),null,{timeout:10000});
assert.equal(writes.filter(row=>row.target==='my-playlist').length,writesBeforeBlocked,'loaded Xtream Inspector Add must be blocked before any My Playlist write');

const myAction=page.locator('#my-playlist-channel-action');
assert.equal(await myAction.isDisabled(),true,'generic top-level My Playlist add must remain disabled for loaded Xtream account channels');
assert.equal((await myAction.textContent())?.trim(),'Save via Xtream Preview','loaded Xtream channel must point back to verified Preview save flow');

assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:RUNTIME_SHA,
  authorizedMock:{profile:'test_50',channels:streams.length,categories:categories.length},
  temporaryTestDidNotPersist:true,
  normalInspector:{add:true,edit:true,delete:true,writes:myWrites.length},
  loadedXtreamInspectorBlocked:true,
  loadedXtreamWriteCountBefore:writesBeforeBlocked,
  loadedXtreamWriteCountAfter:writes.filter(row=>row.target==='my-playlist').length,
  topLevelXtreamAddBlocked:true,
  pageErrors,
  consoleErrors,
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'production-playback-inspector-boundary.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
