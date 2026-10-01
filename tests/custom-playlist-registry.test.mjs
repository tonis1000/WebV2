import assert from 'node:assert/strict';
import { handleCustomPlaylistRoute } from '../workers/custom-playlist-routes.js';

function createFakeD1(){
  const playlists=new Map(),channels=new Map(),sources=new Map();
  const key=(p,c)=>`${p}::${c}`,skey=(p,c,u)=>`${p}::${c}::${u}`;
  const db={playlists,channels,sources,prepare(sql){const text=String(sql).replace(/\s+/g,' ').trim();return{bind(...args){return stmt(text,args);},...stmt(text,[])};},async batch(items){for(const item of items)await item.run();return items.map(()=>({success:true,meta:{changes:1}}));}};
  function stmt(text,args){return{
    async run(){
      if(/^CREATE TABLE/i.test(text))return{success:true,meta:{changes:0}};
      if(/^INSERT INTO playlists/i.test(text)){const[id,name,kind,sourceUrl,rawM3u,channelCount,groupCount]=args;playlists.set(id,{id,name,kind,sourceUrl,rawM3u,channelCount,groupCount,createdAt:'now',updatedAt:'now'});return{success:true,meta:{changes:1}};}
      if(/^INSERT INTO playlist_channels/i.test(text)){const[playlistId,channelId,name,tvgId,logo,groupName,position,providerEpgId,providerCategory,providerOrigin]=args;channels.set(key(playlistId,channelId),{playlistId,channelId,name,tvgId,logo,groupName,position,providerEpgId,providerCategory,providerOrigin});return{success:true,meta:{changes:1}};}
      if(/^DELETE FROM playlist_channel_sources WHERE playlist_id=\? AND channel_id=\?/i.test(text)){const[p,c]=args;for(const k of [...sources.keys()])if(k.startsWith(`${p}::${c}::`))sources.delete(k);return{success:true,meta:{changes:1}};}
      if(/^INSERT INTO playlist_channel_sources/i.test(text)){const[playlistId,channelId,url,origin,priority,providerAccountId,providerEpgId,providerCategory]=args;sources.set(skey(playlistId,channelId,url),{playlistId,channelId,url,origin,priority,providerAccountId,providerEpgId,providerCategory});return{success:true,meta:{changes:1}};}
      if(/^DELETE FROM playlist_channels WHERE playlist_id=\? AND channel_id=\?/i.test(text)){channels.delete(key(args[0],args[1]));return{success:true,meta:{changes:1}};}
      if(/^UPDATE playlists SET channel_count=/i.test(text)){const playlistId=args.at(-1);const row=playlists.get(playlistId);if(row){const members=[...channels.values()].filter(channel=>channel.playlistId===playlistId);row.channelCount=members.length;row.groupCount=new Set(members.map(channel=>channel.groupName||'Other')).size;row.updatedAt='now';}return{success:true,meta:{changes:1}};}
      if(/^DELETE FROM playlist_channel_sources WHERE playlist_id=\?/i.test(text)){for(const k of [...sources.keys()])if(k.startsWith(`${args[0]}::`))sources.delete(k);return{success:true,meta:{changes:1}};}
      if(/^DELETE FROM playlist_channels WHERE playlist_id=\?/i.test(text)){for(const k of [...channels.keys()])if(k.startsWith(`${args[0]}::`))channels.delete(k);return{success:true,meta:{changes:1}};}
      if(/^DELETE FROM playlists WHERE id=\?/i.test(text)){playlists.delete(args[0]);return{success:true,meta:{changes:1}};}
      throw new Error(`Unexpected run SQL: ${text}`);
    },
    async first(){if(/FROM playlists WHERE id=\?/i.test(text))return playlists.get(args[0])||null;throw new Error(`Unexpected first SQL: ${text}`);},
    async all(){if(/FROM playlist_channels WHERE playlist_id=\?/i.test(text))return{results:[...channels.values()].filter(r=>r.playlistId===args[0]).sort((a,b)=>a.position-b.position)};if(/FROM playlist_channel_sources WHERE playlist_id=\?/i.test(text))return{results:[...sources.values()].filter(r=>r.playlistId===args[0]).sort((a,b)=>a.priority-b.priority)};throw new Error(`Unexpected all SQL: ${text}`);}
  }};return db;
}

const DB=createFakeD1(),env={DB,ADMIN_TOKEN:'admin',PIN_AUTH_DISABLED:'1'};
const registryWorker={fetch:async req=>{const ok=(req.headers.get('authorization')||'')==='Bearer admin';return new Response(JSON.stringify({ok}),{status:ok?200:401,headers:{'content-type':'application/json'}});}};
const headers={'content-type':'application/json','authorization':'Bearer admin'};
const call=(method,path,body)=>handleCustomPlaylistRoute(new Request(`https://registry.example${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env,registryWorker);

assert.equal(await call('POST','/api/playlists',{name:'old',kind:'saved'}),null,'non-custom POST must stay with existing owner');
let r=await call('POST','/api/playlists',{id:'greek',name:'Greek',kind:'custom'});assert.equal(r.status,200);assert.equal((await r.json()).playlist.kind,'custom');assert.equal(DB.playlists.get('greek').rawM3u,'');
r=await call('POST','/api/playlists',{id:'backup',name:'Backup',kind:'custom'});assert.equal(r.status,200);
const channel={name:'MEGA',tvgId:'mega',groupName:'Γενικά',position:1,providerEpgId:'mega.gr',sources:[{url:'https://a.example/mega.m3u8',origin:'xtream'}]};
r=await call('PUT','/api/playlists/greek/channels/mega',channel);assert.equal(r.status,200);assert.equal(DB.playlists.get('greek').channelCount,1,'custom parent channel count must track D1 child truth');assert.equal(DB.playlists.get('greek').groupCount,1,'custom parent group count must track D1 child truth');
r=await call('PUT','/api/playlists/greek/channels/mega',channel);assert.equal(r.status,200);assert.equal([...DB.sources.values()].filter(x=>x.playlistId==='greek').length,1);
r=await call('PUT','/api/playlists/greek/channels/mega',{...channel,sources:[{url:'https://b.example/mega.m3u8',origin:'m3u'}]});assert.equal(r.status,200);assert.equal([...DB.sources.values()].filter(x=>x.playlistId==='greek').length,2);
r=await call('PUT','/api/playlists/backup/channels/mega',{...channel,sources:[{url:'https://c.example/mega.m3u8',origin:'xtream'}]});assert.equal(r.status,200);assert.deepEqual([...DB.sources.values()].filter(x=>x.playlistId==='backup').map(x=>x.url),['https://c.example/mega.m3u8']);
r=await call('PUT','/api/playlists/greek/channels/mega',{...channel,replaceSources:true,sources:[{url:'https://d.example/mega.m3u8',origin:'manual'}]});assert.equal(r.status,200);assert.deepEqual([...DB.sources.values()].filter(x=>x.playlistId==='greek').map(x=>x.url),['https://d.example/mega.m3u8']);
r=await call('GET','/api/playlists/greek/channels');assert.equal(r.status,200);const body=await r.json();assert.equal(body.channels.length,1);assert.equal(body.channels[0].sources.length,1);
r=await call('GET','/api/playlists/greek/export.m3u');assert.equal(r.status,200);const m3u=await r.text();assert.match(m3u,/#EXTINF/);assert.match(m3u,/https:\/\/d\.example\/mega\.m3u8/);assert.equal(DB.playlists.get('greek').rawM3u,'');
r=await call('DELETE','/api/playlists/greek/channels/mega');assert.equal(r.status,200);assert.equal([...DB.channels.values()].filter(x=>x.playlistId==='greek').length,0);assert.equal([...DB.sources.values()].filter(x=>x.playlistId==='greek').length,0);assert.equal(DB.playlists.get('greek').channelCount,0,'custom parent count must return to zero after membership delete');assert.equal(DB.playlists.get('greek').groupCount,0);
r=await call('DELETE','/api/playlists/backup');assert.equal(r.status,200);assert.equal(DB.playlists.has('backup'),false);assert.equal([...DB.channels.values()].filter(x=>x.playlistId==='backup').length,0);assert.equal([...DB.sources.values()].filter(x=>x.playlistId==='backup').length,0);

console.log('custom playlist registry routes PASS');
