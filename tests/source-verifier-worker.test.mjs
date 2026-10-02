import assert from 'node:assert/strict';
import fs from 'node:fs';
import verifier from '../workers/webtv-source-verifier.js';

const workerSource=fs.readFileSync(new URL('../workers/webtv-source-verifier.js',import.meta.url),'utf8');
assert.match(workerSource,/source-format-registry\.js/);
assert.match(workerSource,/detectSourceFormat/);
assert.match(workerSource,/classifySourceBody/);
assert.doesNotMatch(workerSource,/function inferredType\(/);
assert.doesNotMatch(workerSource,/function classifyBody\(/);

const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async(url,options={})=>{
    const value=String(url);
    assert.equal(options.redirect,'manual');
    if(value.includes('roku.test')){
      const headers=new Headers(options.headers||{});
      assert.equal(value,'http://roku.test/live.m3u8');
      assert.equal(headers.get('user-agent'),'Roku/DVP-14.6');
      assert.equal(headers.get('x-roku-reserved-dev-id'),'device-123');
      return new Response('#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg.ts\n',{status:200,headers:{'content-type':'application/vnd.apple.mpegurl'}});
    }
    if(value.includes('good.test'))return new Response('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg.ts\n',{status:200,headers:{'content-type':'application/vnd.apple.mpegurl'}});
    if(value.includes('dead.test'))return new Response('gone',{status:404,headers:{'content-type':'text/plain'}});
    if(value.includes('drm.test'))return new Response('<?xml version="1.0"?><MPD><Period><ContentProtection schemeIdUri="urn:uuid:test"/></Period></MPD>',{status:200,headers:{'content-type':'application/dash+xml'}});
    if(value.includes('html.test'))return new Response('<html>not media</html>',{status:200,headers:{'content-type':'text/html'}});
    if(value.includes('redirect.test/start.mpd'))return new Response(null,{status:307,headers:{location:'https://cdn.test/final.mpd?token=super-secret&expires=999999','set-cookie':'session=do-not-leak; Secure; HttpOnly','cache-control':'no-store','x-edge-test':'redirect'}});
    if(value.includes('cdn.test/final.mpd'))return new Response('denied',{status:401,headers:{'content-type':'text/plain','www-authenticate':'Bearer realm="do-not-leak"','x-edge-test':'final'}});
    return new Response('nope',{status:500});
  };

  const unresolvedRequest=new Request('https://verifier.test/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({candidates:[
    {candidateId:'strm',sourceType:'strm',sourceUrl:'https://x.test/file.strm'},
    {candidateId:'m3u',sourceType:'m3u',sourceUrl:'https://x.test/list.m3u'},
  ]})});
  const unresolvedResponse=await verifier.fetch(unresolvedRequest,{});
  const unresolvedBody=await unresolvedResponse.json();
  assert.equal(unresolvedBody.results[0].status,'UNRESOLVED');
  assert.equal(unresolvedBody.results[1].status,'UNRESOLVED');

  const rokuResponse=await verifier.fetch(new Request('https://verifier.test/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({candidate:{candidateId:'roku',sourceType:'hls',sourceUrl:'http://roku.test/live.m3u8|User-Agent=Roku%2FDVP-14.6&x-roku-reserved-dev-id=device-123'}})}),{});
  const rokuBody=await rokuResponse.json();
  assert.equal(rokuBody.results[0].status,'VERIFIED');

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

  const htmlResponse=await verifier.fetch(new Request('https://verifier.test/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({candidate:{candidateId:'html',sourceUrl:'https://html.test/live'}})}),{});
  const htmlBody=await htmlResponse.json();
  assert.equal(htmlBody.results[0].status,'FAILED');
  assert.equal(htmlBody.results[0].verified,false);

  const redirectResponse=await verifier.fetch(new Request('https://verifier.test/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({candidate:{candidateId:'redirect',sourceType:'dash',sourceUrl:'https://redirect.test/start.mpd?initial=hidden',requiredHeaders:{'User-Agent':'Browser UA','Referer':'https://official.test/live','Origin':'https://official.test'}}})}),{});
  const redirectBody=await redirectResponse.json();
  const redirected=redirectBody.results[0];
  assert.equal(redirected.status,'FAILED');
  assert.equal(redirected.lastHttpStatus,401);
  assert.equal(redirected.redirects.length,1);
  assert.deepEqual(redirected.redirects[0],{
    status:307,
    from:{host:'redirect.test',pathname:'/start.mpd',queryCount:1,queryKeys:['initial']},
    to:{host:'cdn.test',pathname:'/final.mpd',queryCount:2,queryKeys:['expires','token']},
    hostChanged:true,
    responseHeaders:{headerNames:['cache-control','location','set-cookie','x-edge-test'],hasSetCookie:true,hasWwwAuthenticate:false},
  });
  assert.deepEqual(redirected.finalTarget,{host:'cdn.test',pathname:'/final.mpd',queryCount:2,queryKeys:['expires','token']});
  assert.deepEqual(redirected.finalResponseHeaders,{headerNames:['content-type','www-authenticate','x-edge-test'],hasSetCookie:false,hasWwwAuthenticate:true});
  const serialized=JSON.stringify(redirected);
  assert.equal(serialized.includes('super-secret'),false);
  assert.equal(serialized.includes('999999'),false);
  assert.equal(serialized.includes('initial=hidden'),false);
  assert.equal(serialized.includes('session=do-not-leak'),false);
  assert.equal(serialized.includes('Bearer realm'),false);

  const tooMany=await verifier.fetch(new Request('https://verifier.test/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({candidates:Array.from({length:5},(_,i)=>({candidateId:String(i),sourceType:'hls',sourceUrl:`https://good.test/${i}.m3u8`}))})}),{});
  assert.equal(tooMany.status,413);

  console.log('source verifier Worker tests PASS');
}finally{
  globalThis.fetch=originalFetch;
}
