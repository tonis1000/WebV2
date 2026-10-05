import assert from 'node:assert/strict';
import smart from '../workers/webtv-source-discovery-smart.js';

const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async input=>{
    const url=String(input instanceof Request?input.url:input);
    if(url.includes('ciefpsettings_iptv_mix.tv')){
      return new Response(
        '#NAME Ciefp Mix\n'
        +'#SERVICE 4097:0:1:0:0:0:0:0:0:0:http%3a//127.0.0.1%3a8088/https%3a//www.twitch.tv/zapadoslovenska:Západoslovenská TV (Twich)\n'
        +'#DESCRIPTION Západoslovenská TV (Twich)\n',
        {status:200,headers:{'content-type':'text/plain'}}
      );
    }
    return new Response('#EXTM3U\n',{status:200,headers:{'content-type':'text/plain'}});
  };

  const request=new Request('https://discovery.test/discover',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      provider:'curated-remote-feeds',
      freshness:'7d',
      channel:{
        name:'Západoslovenská TV (Twich)',
        id:'zapadoslovenska-tv-twich',
        originalId:'Západoslovenská TV (Twich)'
      }
    })
  });
  const response=await smart.fetch(request,{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.provider,'curated-remote-feeds');
  assert.equal(body.candidates.length,0,'smart wrapper must reject receiver-local curated candidates');
  assert.ok(body.strmResolution,'curated response must pass through smart candidate policy');
  assert.ok(body.strmResolution.reports.some(r=>/Non-public curated target rejected/.test(r.error||'')));
  console.log('Source Discovery smart private-target integration PASS');
}finally{
  globalThis.fetch=originalFetch;
}
