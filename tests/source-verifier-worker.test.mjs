import assert from 'node:assert/strict';
import verifier from '../workers/webtv-source-verifier.js';

const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async(url)=>{
    const value=String(url);
    if(value.includes('good.test'))return new Response('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg.ts\n',{status:200,headers:{'content-type':'application/vnd.apple.mpegurl'}});
    if(value.includes('dead.test'))return new Response('gone',{status:404,headers:{'content-type':'text/plain'}});
    if(value.includes('drm.test'))return new Response('<?xml version="1.0"?><MPD><Period><ContentProtection schemeIdUri="urn:uuid:test"/></Period></MPD>',{status:200,headers:{'content-type':'application/dash+xml'}});
    return new Response('nope',{status:500});
  };

  const request=new Request('https://verifier.test/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({candidates:[
    {candidateId:'good',sourceType:'hls',sourceUrl:'https://good.test/live.m3u8'},
    {candidateId:'dead',sourceType:'hls',sourceUrl:'https://dead.test/live.m3u8'},
    {candidateId:'drm',sourceType:'dash',sourceUrl:'https://drm.test/live.mpd'},
    {candidateId:'private',sourceType:'hls',sourceUrl:'http://127.0.0.1/live.m3u8'},
  ]})});
  const response=await verifier.fetch(request,{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.results.length,4);
  assert.equal(body.results[0].status,'VERIFIED');
  assert.equal(body.results[0].verified,true);
  assert.equal(body.results[0].mediaType,'hls');
  assert.equal(body.results[1].status,'HTTP 404');
  assert.equal(body.results[1].verified,false);
  assert.equal(body.results[2].status,'DRM');
  assert.equal(body.results[2].drmDetected,true);
  assert.equal(body.results[3].status,'FAILED');
  assert.match(body.results[3].detail,/Private(?: IP|\/local) targets are not allowed/);

  const tooMany=await verifier.fetch(new Request('https://verifier.test/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({candidates:Array.from({length:5},(_,i)=>({candidateId:String(i),sourceType:'hls',sourceUrl:`https://good.test/${i}.m3u8`}))})}),{});
  assert.equal(tooMany.status,413);

  console.log('source verifier Worker tests PASS');
}finally{
  globalThis.fetch=originalFetch;
}
