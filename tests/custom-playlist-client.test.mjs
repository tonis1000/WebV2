import assert from 'node:assert/strict';

globalThis.window={WebTVRegistryAuth:{ensureSession:async()=>true}};
const store=new Map([['webtv_v2_registry_url','https://registry.test'],['webtv_v2_registry_token','session-token']]);
globalThis.localStorage={getItem:key=>store.get(key)||'',setItem:(key,val)=>store.set(key,String(val))};
const calls=[];
globalThis.fetch=async(url,options={})=>{
  calls.push({url:String(url),options});
  const path=new URL(String(url)).pathname;
  if(path==='/api/playlists'&&options.method==='POST')return new Response(JSON.stringify({playlist:{id:'pl1',name:'Greek',kind:'custom'}}),{status:200,headers:{'content-type':'application/json'}});
  if(path==='/api/playlists/pl1/channels'&&!options.method)return new Response(JSON.stringify({channels:[{channelId:'mega',name:'MEGA',sources:[{url:'https://a.test/mega.m3u8'}]}]}),{status:200,headers:{'content-type':'application/json'}});
  if(path==='/api/playlists/pl1/channels/mega'&&options.method==='PUT')return new Response(JSON.stringify({channel:{channelId:'mega',name:'MEGA'}}),{status:200,headers:{'content-type':'application/json'}});
  if(path==='/api/playlists/pl1/channels/mega'&&options.method==='DELETE')return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
  if(path==='/api/playlists')return new Response(JSON.stringify({playlists:[{id:'pl1',name:'Greek',kind:'custom'},{id:'old',name:'Old',kind:'url'}]}),{status:200,headers:{'content-type':'application/json'}});
  throw new Error(`unexpected ${options.method||'GET'} ${path}`);
};

const mod=await import('../src/custom-playlist-client.js');
let rows=await mod.listCustomPlaylists();
assert.deepEqual(rows,[{id:'pl1',name:'Greek',kind:'custom'}]);
const created=await mod.createCustomPlaylist({name:'Greek'});
assert.equal(created.id,'pl1');
assert.equal(calls.at(-1).options.headers.get('authorization'),'Bearer session-token');
assert.equal(JSON.parse(calls.at(-1).options.body).kind,'custom');
const aborter=new AbortController();
rows=await mod.getCustomPlaylistChannels('pl1',{signal:aborter.signal});
assert.equal(rows[0].channelId,'mega');
assert.equal(calls.at(-1).options.signal,aborter.signal);
const payload={id:'mega',name:'MEGA',tvgId:'mega',previewToken:'secret-preview',username:'u',password:'p'};
await mod.upsertCustomPlaylistChannel('pl1',payload,[{url:'https://a.test/mega.m3u8',origin:'xtream',previewToken:'bad'}],{replaceSources:true});
const write=JSON.parse(calls.at(-1).options.body);
assert.equal(write.channelId,'mega');
assert.equal(write.replaceSources,true);
for(const forbidden of ['previewToken','username','password'])assert.equal(forbidden in write,false,`${forbidden} must not enter custom payload`);
assert.equal('previewToken' in write.sources[0],false);
await mod.removeCustomPlaylistChannel('pl1','mega');
assert.equal(calls.at(-1).options.method,'DELETE');
assert.equal(mod.customPlaylistExportUrl('pl1'),'https://registry.test/api/playlists/pl1/export.m3u');
console.log('custom playlist client PASS');
