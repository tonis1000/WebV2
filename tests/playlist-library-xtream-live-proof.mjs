import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const MOCK_URL=process.env.XTREAM_MOCK_URL||'https://webtv-xtream-mock.atonis.workers.dev';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/playlist-library-xtream-live';
const FAKE_TOKEN='ci-playlist-library-proof';

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
const mapped=streams.map(stream=>({
  streamId:String(stream.stream_id),
  tvgId:String(stream.epg_channel_id||stream.name||stream.stream_id),
  name:String(stream.name||stream.stream_id),
  logo:String(stream.stream_icon||''),
  group:categoryNames.get(String(stream.category_id))||'Xtream',
  categoryId:String(stream.category_id||''),
  playbackUrl:`https://webtv-xtream.atonis.workers.dev/preview-stream/${encodeURIComponent(stream.stream_id)}.m3u8?t=ci-preview`,
}));

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.setExtraHTTPHeaders({'cache-control':'no-cache',pragma:'no-cache'});
await context.addInitScript(token=>{
  localStorage.setItem('webtv_v2_registry_token',token);
  window.__xtreamListenerAudit=[];
  window.__xtreamListenerInvoked=[];
  window.__xtreamDocumentClicks=[];
  document.addEventListener('click',event=>{
    const id=event.target?.id||event.target?.closest?.('[id]')?.id||'';
    if(id.startsWith('xtream-preview-save-'))window.__xtreamDocumentClicks.push({id,phase:event.eventPhase});
  },true);
  const original=EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener=function(type,listener,options){
    if(type==='click'&&this?.id?.startsWith?.('xtream-preview-save-')){
      const id=this.id;
      window.__xtreamListenerAudit.push({id,type});
      const wrapped=function(event){window.__xtreamListenerInvoked.push({id,phase:event.eventPhase});return listener.call(this,event);};
      return original.call(this,type,wrapped,options);
    }
    return original.call(this,type,listener,options);
  };
},FAKE_TOKEN);
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
const writes=[];
let myPlaylist=[];
let savedPlaylists=[];
let savedAccounts=[];
let nextSourceId=1;

page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
page.on('dialog',async dialog=>{
  if(/Saved Xtream playlist name/i.test(dialog.message()))await dialog.accept('CI Saved Xtream');
  else await dialog.dismiss();
});
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});

await page.route('https://webtv-registry.atonis.workers.dev/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  if(url.pathname==='/api/status')return json(route,{ok:true,service:'WebTV Registry',version:'ci',d1:true,primaryPlaylist:'d1',pinAuthDisabled:true});
  if(url.pathname==='/api/session'||url.pathname==='/api/session/validate')return json(route,{ok:true});
  if(url.pathname==='/api/my-playlist'&&method==='GET')return json(route,{channels:myPlaylist});
  if(url.pathname==='/api/my-playlist/channel'&&method==='PUT'){
    const body=req.postDataJSON();writes.push({target:'my-playlist',body});
    const sources=(body.sources||[]).map(source=>({url:source.url,origin:source.origin||'xtream',priority:source.priority||100,enabled:true}));
    const row={id:body.id,originalId:body.tvgId||body.id,tvgId:body.tvgId||body.id,name:body.name,logo:body.logo||'',groupName:body.groupName||'Other',sources};
    const i=myPlaylist.findIndex(item=>item.id===row.id);if(i>=0)myPlaylist[i]=row;else myPlaylist.push(row);
    return json(route,{ok:true,channel:row});
  }
  if(url.pathname==='/api/playlists'&&method==='GET')return json(route,{playlists:savedPlaylists});
  if(url.pathname==='/api/playlists'&&method==='POST'){
    const body=req.postDataJSON();writes.push({target:'saved-playlist',body});
    const row={id:body.id,name:body.name,kind:body.kind,sourceUrl:body.sourceUrl,rawM3u:body.rawM3u,channelCount:body.channelCount||0,groupCount:body.groupCount||0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    const i=savedPlaylists.findIndex(item=>item.id===row.id);if(i>=0)savedPlaylists[i]=row;else savedPlaylists.push(row);
    return json(route,{ok:true,playlist:row},201);
  }
  if(/^\/api\/playlists\/[^/]+$/.test(url.pathname)&&method==='DELETE')return json(route,{ok:true});
  if(url.pathname==='/api/my-playlist/order'&&method==='PATCH')return json(route,{ok:true});
  return json(route,{ok:true});
});

await page.route('https://webtv-xtream.atonis.workers.dev/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  if(url.pathname==='/api/status')return json(route,{ok:true,service:'WebTV Xtream',version:'ci'});
  if(url.pathname==='/api/accounts'&&method==='GET')return json(route,{accounts:savedAccounts});
  if(url.pathname==='/api/preview'&&method==='POST'){
    const body=req.postDataJSON();
    return json(route,{ok:true,previewToken:'ci-preview-token',expiresAt:new Date(Date.now()+600000).toISOString(),account:{name:body.name||'CI',server:body.server,tested:{status:'Active'}},channels:mapped});
  }
  if(url.pathname==='/api/channel-sources'&&method==='POST'){
    const body=req.postDataJSON(),streamId=String(body.streamId||'');
    const source={id:`xch_ci_${nextSourceId++}abcdef`,accountId:'xt_ci_1',streamId,name:body.name,playbackUrl:`https://webtv-xtream.atonis.workers.dev/channel-stream/xch_ci_saved/${encodeURIComponent(streamId)}.m3u8?s=ci`};
    writes.push({target:'xtream-channel-source',body,source});
    return json(route,{ok:true,source},201);
  }
  if(url.pathname==='/api/accounts/from-preview'&&method==='POST'){
    const body=req.postDataJSON();
    const account={id:'xt_ci_1',name:body.name||'CI Saved Xtream',server:MOCK_URL,tested:{status:'Active'}};
    savedAccounts=[account];writes.push({target:'xtream-account',body,account});
    return json(route,{ok:true,account},201);
  }
  if(url.pathname==='/api/accounts/xt_ci_1/channels'&&method==='GET'){
    const channels=mapped.slice(0,2).map((row,index)=>({...row,playbackUrl:`https://webtv-xtream.atonis.workers.dev/stream/xt_ci_1/${encodeURIComponent(row.streamId)}.m3u8?s=loaded${index}`}));
    return json(route,{account:savedAccounts[0]||{id:'xt_ci_1',name:'CI Saved Xtream',server:MOCK_URL},channels});
  }
  if(/^\/api\/accounts\/[^/]+$/.test(url.pathname)&&method==='DELETE')return json(route,{ok:true,deleted:true});
  if(/^\/api\/channel-sources\/[^/]+$/.test(url.pathname)&&method==='DELETE')return json(route,{ok:true,deleted:true});
  return json(route,{ok:true});
});

await page.route('https://webtv-source-verifier.atonis.workers.dev/**',route=>json(route,{results:[{status:'VERIFIED',verified:true,detail:'CI verified'}]}));

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production WebV2 load failed: ${response?.status()}`);
await page.waitForSelector('#playlist-manager-toggle',{state:'attached',timeout:20000});
await page.evaluate(()=>{document.documentElement.classList.remove('admin-locked');document.documentElement.classList.add('admin-unlocked');});
await page.locator('#playlist-manager-toggle').click();
await page.waitForSelector('#xtream-tool-card',{timeout:20000});

assert.equal(await page.locator('#xtream-save-playlist').count(),0,'legacy Save Xtream Playlist button must be absent');
assert.equal(await page.locator('#xtream-merge-overlay').count(),0,'legacy Xtream merge dialog must be absent');

await page.locator('#xtream-name').fill('CI Provider');
await page.locator('#xtream-server').fill(MOCK_URL);
await page.locator('#xtream-username').fill('test_50');
await page.locator('#xtream-password').fill('test_pass');
await page.locator('#xtream-connect-save').click();
await page.waitForFunction(()=>window.WebTVXtream?.getPreview?.()?.phase==='preview-ready'&&window.WebTVXtream?.getPreview?.()?.channelCount===50,null,{timeout:20000});
await page.locator('#xtream-preview-catalog .xtream-preview-row').first().click();
await page.locator('#xtream-preview-verify').click();
await page.waitForFunction(()=>window.WebTVXtream?.getPreview?.()?.candidate?.verificationStatus==='VERIFIED',null,{timeout:10000});

const saveButtonState=await page.locator('#xtream-preview-save-channel').evaluate(el=>{
  const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
  return{disabled:el.disabled,hidden:el.hidden,pointerEvents:style.pointerEvents,visibility:style.visibility,display:style.display,opacity:style.opacity,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
});
console.log('SAVE_BUTTON_STATE '+JSON.stringify(saveButtonState));
await page.locator('#xtream-preview-save-channel').click();
await page.waitForTimeout(500);
const saveDialogDebug=await page.evaluate(()=>({
  status:document.getElementById('xtream-status')?.textContent||'',
  dialogExists:Boolean(document.getElementById('xtream-save-destination-dialog')),
  dialogOpen:Boolean(document.getElementById('xtream-save-destination-dialog')?.open),
  managerHidden:Boolean(document.getElementById('playlist-manager')?.hidden),
  saveApi:Boolean(window.WebTVXtreamSaveDestination?.open),
  preview:window.WebTVXtream?.getPreview?.(),
  listenerAudit:window.__xtreamListenerAudit||[],
  listenerInvoked:window.__xtreamListenerInvoked||[],
  documentClicks:window.__xtreamDocumentClicks||[],
  saveButtonCount:document.querySelectorAll('#xtream-preview-save-channel').length,
  saveButtonConnected:document.getElementById('xtream-preview-save-channel')?.isConnected,
  pageErrors:window.__none||null,
}));
console.log('SAVE_DIALOG_DEBUG '+JSON.stringify(saveDialogDebug));
await page.waitForSelector('#xtream-save-destination-dialog[open]',{timeout:5000});
await page.locator('#xtream-save-destination-select').selectOption('my');
await page.locator('#xtream-save-destination-confirm').click();
await page.waitForFunction(()=>document.getElementById('xtream-status')?.textContent?.includes('My Playlist'),null,{timeout:10000});
assert.equal(writes.filter(row=>row.target==='my-playlist').length,1,'verified Save Channel → My Playlist must perform exactly one My Playlist write');
assert.equal(writes.find(row=>row.target==='my-playlist')?.body?.replaceSources,false,'verified My Playlist save must merge sources');

await page.locator('#xtream-preview-save-account').click();
await page.waitForFunction(()=>document.getElementById('xtream-status')?.textContent?.includes('saved as live Xtream playlist'),null,{timeout:10000});
await page.waitForFunction(()=>[...document.querySelectorAll('#saved-playlists .playlist-card')].some(card=>card.dataset.playlistKind==='xtream'),null,{timeout:10000});

const xtreamCard=page.locator('#saved-playlists .playlist-card[data-playlist-kind="xtream"]').first();
assert.equal(await xtreamCard.locator('.playlist-card-icon').textContent(),'👤','Saved Xtream card must use account icon');
assert.equal(await xtreamCard.getByRole('button',{name:'Load live'}).count(),1,'Saved Xtream card must expose Load live');
assert.equal(await xtreamCard.getByRole('button',{name:'Export'}).count(),0,'Saved Xtream card must not expose Export');
assert.equal(await xtreamCard.getByRole('button',{name:'Save Xtream Playlist'}).count(),0,'legacy save action must stay absent');

await xtreamCard.getByRole('button',{name:'Load live'}).click();
await page.waitForFunction(()=>document.getElementById('xtream-status')?.textContent?.includes('saved-account channels loaded temporarily'),null,{timeout:10000});
assert.equal(writes.filter(row=>row.target==='my-playlist').length,1,'Load live must not persist another My Playlist write');

const channelRows=page.locator('#channel-list .channel-item, #channel-list button, #channel-list [data-channel-id]');
const count=await channelRows.count();
assert.ok(count>=2,`Load live should expose at least two sidebar channel rows, got ${count}`);
await channelRows.nth(1).click();
await page.waitForTimeout(250);
const myAction=page.locator('#my-playlist-channel-action');
assert.equal(await myAction.isDisabled(),true,'generic My Playlist add must be disabled for loaded Xtream account channels');
assert.equal((await myAction.textContent())?.trim(),'Save via Xtream Preview','loaded Xtream account channel must point back to verified Preview save flow');
assert.equal(await page.locator('#xtream-merge-overlay').count(),0,'generic My Playlist action must not recreate legacy merge dialog');

assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeSha:'f01a422065ff18c0b29841440ba529bdf6df9151',
  authorizedMock:{profile:'test_50',channels:streams.length,categories:categories.length},
  legacySaveButtonAbsent:true,
  legacyMergeDialogAbsent:true,
  verifiedMyPlaylistWrites:writes.filter(row=>row.target==='my-playlist').length,
  fullAccountSaved:savedAccounts[0],
  xtreamLibraryCard:{icon:'👤',loadLive:true,export:false},
  loadLiveDidNotPersist:true,
  loadedXtreamGenericAddBlocked:true,
  pageErrors,
  consoleErrors,
};
await page.screenshot({path:path.join(ARTIFACT_DIR,'production-xtream-library.png'),fullPage:true});
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
