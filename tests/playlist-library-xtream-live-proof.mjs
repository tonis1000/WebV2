import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL=process.env.WEBV2_URL||'https://tonis1000.github.io/WebV2/';
const MOCK_URL=process.env.XTREAM_MOCK_URL||'https://webtv-xtream-mock.atonis.workers.dev';
const ARTIFACT_DIR=process.env.ARTIFACT_DIR||'artifacts/xtream-library-consolidation-proof';
const TOKEN='ci-library-proof-token';

await fs.mkdir(ARTIFACT_DIR,{recursive:true});

async function providerJson(action=''){
  const url=new URL('/player_api.php',MOCK_URL);
  url.searchParams.set('username','test_50');
  url.searchParams.set('password','test_pass');
  if(action)url.searchParams.set('action',action);
  const response=await fetch(url,{headers:{'cache-control':'no-cache'}});
  assert.equal(response.ok,true,`mock provider ${action||'login'} HTTP ${response.status}`);
  return response.json();
}
const [login,categories,streams]=await Promise.all([
  providerJson(),
  providerJson('get_live_categories'),
  providerJson('get_live_streams'),
]);
assert.equal(String(login?.user_info?.auth),'1','authorized mock must authenticate');
assert.equal(streams.length,50,'test_50 must expose 50 channels');
const categoryNames=new Map(categories.map(row=>[String(row.category_id),String(row.category_name||'Xtream')]));
const previewChannels=streams.map(stream=>({
  streamId:String(stream.stream_id),
  tvgId:String(stream.epg_channel_id||stream.name||stream.stream_id),
  name:String(stream.name||stream.stream_id),
  logo:String(stream.stream_icon||''),
  group:categoryNames.get(String(stream.category_id))||'Xtream',
  categoryId:String(stream.category_id||''),
  playbackUrl:`https://webtv-xtream.atonis.workers.dev/preview-stream/${encodeURIComponent(stream.stream_id)}.m3u8?t=ci-library`,
}));

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.setExtraHTTPHeaders({'cache-control':'no-cache',pragma:'no-cache'});
await context.addInitScript(token=>localStorage.setItem('webtv_v2_registry_token',token),TOKEN);
const page=await context.newPage();

const pageErrors=[];
const consoleErrors=[];
const writes=[];
const myRows=[];
const savedAccounts=[];
const savedPlaylists=new Map();
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
page.on('dialog',async dialog=>{
  if(/Saved Xtream playlist name/i.test(dialog.message()))await dialog.accept('CI Full Account');
  else await dialog.dismiss();
});

const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
const nowIso=()=>new Date().toISOString();

await page.route('https://webtv-registry.atonis.workers.dev/**',async route=>{
  const request=route.request();
  const url=new URL(request.url());
  const method=request.method();
  if(url.pathname==='/api/status')return json(route,{ok:true,pinAuthDisabled:true});
  if(url.pathname==='/api/session'||url.pathname==='/api/session/validate')return json(route,{ok:true});
  if(url.pathname==='/api/my-playlist'&&method==='GET')return json(route,{channels:myRows});
  if(url.pathname==='/api/my-playlist/channel'&&method==='PUT'){
    const body=request.postDataJSON();
    writes.push({target:'my-playlist',body});
    const row={
      id:body.id,
      name:body.name,
      tvgId:body.tvgId,
      logo:body.logo||'',
      groupName:body.groupName||'Other',
      position:Number(body.position||0),
      sources:(body.sources||[]).map(source=>({...source,enabled:true})),
    };
    const index=myRows.findIndex(item=>item.id===row.id);
    if(index>=0)myRows[index]=row;else myRows.push(row);
    return json(route,{ok:true,channel:row});
  }
  if(url.pathname==='/api/playlists'&&method==='GET'){
    return json(route,{playlists:[...savedPlaylists.values()].map(row=>({
      id:row.id,name:row.name,kind:row.kind,sourceUrl:row.sourceUrl,
      channelCount:row.channelCount,groupCount:row.groupCount,
      createdAt:row.createdAt,updatedAt:row.updatedAt,
    }))});
  }
  if(url.pathname==='/api/playlists'&&method==='POST'){
    const body=request.postDataJSON();
    writes.push({target:'registry-playlists',body});
    const row={...body,createdAt:nowIso(),updatedAt:nowIso()};
    savedPlaylists.set(row.id,row);
    return json(route,{ok:true,playlist:row},201);
  }
  const detail=url.pathname.match(/^\/api\/playlists\/([^/]+)$/);
  if(detail&&method==='GET'){
    const row=savedPlaylists.get(decodeURIComponent(detail[1]));
    return row?json(route,{playlist:row}):json(route,{error:'not found'},404);
  }
  return json(route,{ok:true});
});

await page.route('https://webtv-xtream.atonis.workers.dev/**',async route=>{
  const request=route.request();
  const url=new URL(request.url());
  const method=request.method();
  if(url.pathname==='/api/status')return json(route,{ok:true,service:'WebTV Xtream'});
  if(url.pathname==='/api/accounts'&&method==='GET')return json(route,{accounts:savedAccounts});
  if(url.pathname==='/api/preview'&&method==='POST'){
    const body=request.postDataJSON();
    return json(route,{
      ok:true,
      previewToken:'ci-preview-library',
      expiresAt:new Date(Date.now()+10*60_000).toISOString(),
      account:{name:body.name||'CI Provider',server:body.server,tested:{status:'Active'}},
      channels:previewChannels,
    });
  }
  if(url.pathname==='/api/channel-sources'&&method==='POST'){
    const body=request.postDataJSON();
    const source={
      id:`xch_ci_${body.streamId}`,
      name:body.name||'CI channel',
      streamId:String(body.streamId),
      accountId:'xt_channel_owner',
      playbackUrl:`https://webtv-xtream.atonis.workers.dev/channel-stream/xch_ci_${encodeURIComponent(body.streamId)}/${encodeURIComponent(body.streamId)}.m3u8?s=ci`,
    };
    writes.push({target:'xtream-channel-source',body,source});
    return json(route,{ok:true,source},201);
  }
  if(url.pathname==='/api/accounts/from-preview'&&method==='POST'){
    const body=request.postDataJSON();
    const account={id:'xt_ci_1',name:body.name||'CI Full Account',server:MOCK_URL,tested:{status:'Active'}};
    savedAccounts.splice(0,savedAccounts.length,account);
    writes.push({target:'xtream-full-account',body,account});
    return json(route,{ok:true,account},201);
  }
  const channelList=url.pathname.match(/^\/api\/accounts\/([^/]+)\/channels$/);
  if(channelList&&method==='GET'){
    const id=decodeURIComponent(channelList[1]);
    const account=savedAccounts.find(row=>row.id===id);
    if(!account)return json(route,{error:'Saved Xtream account no longer exists'},404);
    const channels=streams.map(stream=>({
      streamId:String(stream.stream_id),
      tvgId:String(stream.epg_channel_id||stream.name||stream.stream_id),
      name:String(stream.name||stream.stream_id),
      logo:String(stream.stream_icon||''),
      group:categoryNames.get(String(stream.category_id))||'Xtream',
      categoryId:String(stream.category_id||''),
      playbackUrl:`https://webtv-xtream.atonis.workers.dev/stream/${encodeURIComponent(id)}/${encodeURIComponent(stream.stream_id)}.m3u8?s=ci-live`,
    }));
    return json(route,{account,channels});
  }
  return json(route,{ok:true});
});

await page.route('https://webtv-source-verifier.atonis.workers.dev/**',async route=>{
  writes.push({target:'verifier'});
  return json(route,{results:[{status:'VERIFIED',verified:true,detail:'CI verified preview'}]});
});

const response=await page.goto(WEBV2_URL,{waitUntil:'domcontentloaded',timeout:45000});
assert.ok(response?.ok(),`production WebV2 load failed: ${response?.status()}`);
assert.equal(await page.title(),'WebTV V2');
await page.waitForSelector('#playlist-manager-toggle',{state:'attached',timeout:20000});
await page.evaluate(()=>{
  document.documentElement.classList.remove('admin-locked');
  document.documentElement.classList.add('admin-unlocked');
});
await page.locator('#playlist-manager-toggle').click();
await page.waitForSelector('#xtream-tool-card',{timeout:20000});

assert.equal(await page.getByText('Save Xtream Playlist',{exact:true}).count(),0,'legacy Save Xtream Playlist button must be absent');
assert.equal(await page.locator('#xtream-merge-overlay').count(),0,'legacy Xtream merge dialog must be absent');

const playerBefore=await page.evaluate(()=>({
  video:document.getElementById('video')?.getAttribute('src')||'',
  iframe:document.getElementById('iframe')?.getAttribute('src')||'',
  channel:document.getElementById('channel-name')?.textContent||'',
}));

await page.locator('#xtream-name').fill('CI Provider');
await page.locator('#xtream-server').fill(MOCK_URL);
await page.locator('#xtream-username').fill('test_50');
await page.locator('#xtream-password').fill('test_pass');
await page.locator('#xtream-connect-save').click();
await page.waitForFunction(()=>window.WebTVXtream?.getPreview?.()?.channelCount===50,null,{timeout:30000});
assert.equal(await page.locator('#xtream-preview-catalog .xtream-preview-row').count(),50,'50-channel preview must render 50 rows');
await page.locator('#xtream-preview-catalog .xtream-preview-row').first().click();
await page.locator('#xtream-preview-verify').click();
await page.waitForFunction(()=>window.WebTVXtream?.getPreview?.()?.candidate?.verificationStatus==='VERIFIED',null,{timeout:10000});

await page.locator('#xtream-preview-save-channel').click();
await page.waitForSelector('#xtream-save-destination-dialog[open]',{timeout:5000});
await page.locator('#xtream-save-destination-select').selectOption('my');
await page.locator('input[name="xtream-save-source-scope"][value="selected"]').check();
await page.locator('#xtream-save-destination-confirm').click();
await page.waitForFunction(()=>document.getElementById('xtream-status')?.textContent?.includes('My Playlist'),null,{timeout:10000});
const myWrite=writes.find(item=>item.target==='my-playlist');
assert.ok(myWrite,'verified Save Channel → My Playlist must write through canonical My Playlist owner');
assert.ok((myWrite.body.sources||[]).some(source=>source.origin==='xtream'),'canonical My Playlist write must preserve Xtream source origin');

await page.locator('#xtream-preview-save-account').click();
await page.waitForFunction(()=>document.getElementById('xtream-status')?.textContent?.includes('saved as live Xtream playlist'),null,{timeout:10000});
await page.waitForFunction(()=>[...document.querySelectorAll('.playlist-card-title strong')].some(node=>node.textContent==='CI Full Account'),null,{timeout:10000});

const card=page.locator('.playlist-card').filter({hasText:'CI Full Account'}).first();
assert.equal(await card.locator('.playlist-card-icon').textContent(),'👤','Saved Xtream card must have account icon');
assert.equal(await card.getByRole('button',{name:'Load live',exact:true}).count(),1,'Saved Xtream card must expose Load live');
assert.equal(await card.getByRole('button',{name:'Export',exact:true}).count(),0,'Saved Xtream card must not expose Export');
assert.equal(await page.getByText('Save Xtream Playlist',{exact:true}).count(),0,'legacy save button must remain absent after full-account save');

await card.getByRole('button',{name:'Load live',exact:true}).click();
await page.waitForFunction(()=>document.getElementById('xtream-status')?.textContent?.includes('50 saved-account channels loaded temporarily'),null,{timeout:10000});
assert.equal(await page.evaluate(()=>window.WebTVPlaylistAPI?.getCount?.()),50,'Load live must populate the temporary sidebar from the saved account');

const playerAfterLoad=await page.evaluate(()=>({
  video:document.getElementById('video')?.getAttribute('src')||'',
  iframe:document.getElementById('iframe')?.getAttribute('src')||'',
  channel:document.getElementById('channel-name')?.textContent||'',
}));
assert.deepEqual(playerAfterLoad,playerBefore,'Load live itself must not change Player / Now Playing selection');

await page.evaluate(()=>{
  const channel=window.WebTVPlaylistAPI?.getChannels?.()?.[0];
  if(!channel)throw new Error('Loaded Xtream channel missing');
  window.WebTVPlaylistAPI.getSelectedChannel=()=>channel;
  document.getElementById('channel-list')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
});
await page.waitForFunction(()=>document.getElementById('my-playlist-channel-action')?.textContent==='Save via Xtream Preview',null,{timeout:5000});
assert.equal(await page.locator('#my-playlist-channel-action').isDisabled(),true,'generic My Playlist add must be disabled for loaded Xtream account channels');
assert.equal(await page.locator('#xtream-merge-overlay').count(),0,'legacy Xtream merge dialog must stay absent');

await page.screenshot({path:path.join(ARTIFACT_DIR,'playlist-library-xtream-consolidation.png'),fullPage:true});
assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join(' | ')}`);
assert.equal(consoleErrors.length,0,`console errors: ${consoleErrors.join(' | ')}`);

const report={
  runtimeUrl:WEBV2_URL,
  mockChannels:streams.length,
  verifiedMyPlaylistWrite:Boolean(myWrite),
  xtreamSourceOrigin:(myWrite.body.sources||[]).map(source=>source.origin),
  savedCard:{icon:'👤',loadLive:true,export:false},
  loadedAccountChannels:50,
  genericXtreamAddDisabled:true,
  legacySaveButtonAbsent:true,
  legacyMergeDialogAbsent:true,
  playerUnchangedByLoadLive:true,
  pageErrors,
  consoleErrors,
  writeTargets:writes.map(item=>item.target),
};
await fs.writeFile(path.join(ARTIFACT_DIR,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
