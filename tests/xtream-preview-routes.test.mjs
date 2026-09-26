import assert from 'node:assert/strict';

if(!globalThis.btoa)globalThis.btoa=value=>Buffer.from(value,'binary').toString('base64');
if(!globalThis.atob)globalThis.atob=value=>Buffer.from(value,'base64').toString('binary');

const { handleXtreamPreviewRoute } = await import('../workers/xtream-preview-routes.js');

const channelRows=new Map();
const accountRows=new Map();
const DB={
  prepare(sql){
    const text=String(sql);
    const make=args=>({
      async run(){
        if(/INSERT INTO xtream_channel_sources/i.test(text)){
          const[id,name,server,usernameEnc,passwordEnc,streamId]=args;
          channelRows.set(id,{id,name,server,usernameEnc,passwordEnc,streamId});
        }
        if(/INSERT INTO xtream_accounts/i.test(text)){
          const[id,name,server,usernameEnc,passwordEnc]=args;
          accountRows.set(id,{id,name,server,usernameEnc,passwordEnc});
        }
        return{success:true};
      },
      async first(){
        if(/FROM xtream_channel_sources WHERE id=\?/i.test(text))return channelRows.get(args[0])||null;
        return null;
      },
    });
    return{
      bind(...args){return make(args);},
      async run(){return{success:true};},
      async first(){return null;},
    };
  },
};

const env={
  DB,
  XTREAM_ENCRYPTION_KEY:'phase52-test-encryption-key-that-is-long-enough',
  REGISTRY:{fetch:async()=>new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}})},
};

const realFetch=globalThis.fetch;
globalThis.fetch=async input=>{
  const url=new URL(String(input));
  if(url.hostname==='provider.example'){
    if(url.pathname==='/player_api.php'){
      const action=url.searchParams.get('action')||'';
      if(action==='get_live_categories')return new Response(JSON.stringify([{category_id:'1',category_name:'Greece'}]),{status:200,headers:{'content-type':'application/json'}});
      if(action==='get_live_streams')return new Response(JSON.stringify([{stream_id:501,epg_channel_id:'MEGA',name:'MEGA HD',stream_icon:'',category_id:'1'}]),{status:200,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify({user_info:{auth:1,status:'Active',allowed_output_formats:['m3u8']}}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.pathname.includes('/live/secret-user/secret-pass/501.m3u8'))return new Response('#EXTM3U\nhttps://media.example/segment.ts\n',{status:200,headers:{'content-type':'application/vnd.apple.mpegurl'}});
  }
  throw new Error(`Unexpected fetch ${url}`);
};

const trustedHeaders={'content-type':'application/json','x-webtv-session':'fixture-session'};
try{
  const options=await handleXtreamPreviewRoute(new Request('https://webtv-xtream.example/api/preview',{method:'OPTIONS'}),env);
  assert.equal(options.status,204);

  const denied=await handleXtreamPreviewRoute(new Request('https://webtv-xtream.example/api/preview',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),env);
  assert.equal(denied.status,401);

  const previewResponse=await handleXtreamPreviewRoute(new Request('https://webtv-xtream.example/api/preview',{method:'POST',headers:trustedHeaders,body:JSON.stringify({name:'Provider New',server:'https://provider.example',username:'secret-user',password:'secret-pass'})}),env);
  assert.equal(previewResponse.status,200);
  const preview=await previewResponse.json();
  assert.ok(preview.previewToken);
  assert.equal(preview.channels.length,1);
  assert.match(preview.channels[0].playbackUrl,/\/preview-stream\/501\.m3u8\?t=/);
  const previewJson=JSON.stringify(preview);
  assert.equal(previewJson.includes('secret-user'),false);
  assert.equal(previewJson.includes('secret-pass'),false);

  const previewStream=await handleXtreamPreviewRoute(new Request(preview.channels[0].playbackUrl),env);
  assert.equal(previewStream.status,200);
  const previewManifest=await previewStream.text();
  assert.match(previewManifest,/\/hls-proxy\?u=/);
  assert.equal(previewManifest.includes('secret-user'),false);
  assert.equal(previewManifest.includes('secret-pass'),false);

  const channelResponse=await handleXtreamPreviewRoute(new Request('https://webtv-xtream.example/api/channel-sources',{method:'POST',headers:trustedHeaders,body:JSON.stringify({previewToken:preview.previewToken,streamId:'501',name:'MEGA'})}),env);
  assert.equal(channelResponse.status,200);
  const channelBody=await channelResponse.json();
  assert.match(channelBody.source.playbackUrl,/\/channel-stream\/xch_/);
  assert.equal(channelBody.source.playbackUrl.includes(preview.previewToken),false);
  assert.equal(channelRows.size,1);
  const storedChannel=[...channelRows.values()][0];
  assert.notEqual(storedChannel.usernameEnc,'secret-user');
  assert.notEqual(storedChannel.passwordEnc,'secret-pass');
  assert.equal(JSON.stringify(storedChannel).includes('secret-user'),false);
  assert.equal(JSON.stringify(storedChannel).includes('secret-pass'),false);

  const permanentStream=await handleXtreamPreviewRoute(new Request(channelBody.source.playbackUrl),env);
  assert.equal(permanentStream.status,200);
  const permanentManifest=await permanentStream.text();
  assert.match(permanentManifest,/\/hls-proxy\?u=/);
  assert.equal(permanentManifest.includes('secret-user'),false);
  assert.equal(permanentManifest.includes('secret-pass'),false);

  const accountResponse=await handleXtreamPreviewRoute(new Request('https://webtv-xtream.example/api/accounts/from-preview',{method:'POST',headers:trustedHeaders,body:JSON.stringify({previewToken:preview.previewToken,name:'Provider New'})}),env);
  assert.equal(accountResponse.status,200);
  const accountBody=await accountResponse.json();
  assert.match(accountBody.account.id,/^xt_/);
  assert.equal(accountRows.size,1);
  const storedAccount=[...accountRows.values()][0];
  assert.notEqual(storedAccount.usernameEnc,'secret-user');
  assert.notEqual(storedAccount.passwordEnc,'secret-pass');
  assert.equal(JSON.stringify(accountBody).includes('secret-user'),false);
  assert.equal(JSON.stringify(accountBody).includes('secret-pass'),false);

  console.log('Xtream preview routes encryption tests PASS');
} finally {
  globalThis.fetch=realFetch;
}
