import assert from 'node:assert/strict';
import {
  BROWSER_RESOLVED_OFFICIAL_PROVIDER,
  BROWSER_RESOLVER_TIMEOUT_MS,
  discoverBrowserResolvedOfficial,
  sanitizeHeaders,
  safeResolverUrl,
  responseSucceeded,
} from '../workers/source-discovery/browser-resolved-official.js';

assert.equal(BROWSER_RESOLVED_OFFICIAL_PROVIDER,'browser-resolved-official');
assert.equal(BROWSER_RESOLVER_TIMEOUT_MS,12000);
assert.equal(safeResolverUrl('https://resolver.example.test/').href,'https://resolver.example.test/resolve');
assert.equal(responseSucceeded({responseStatus:200}),true);
assert.equal(responseSucceeded({responseStatus:307}),false);
assert.equal(responseSucceeded({responseStatus:401}),false);
assert.equal(responseSucceeded({responseStatus:307,finalStatus:200,finalUrl:'https://live.ertflix.gr/final.mpd'}),true);
assert.deepEqual(sanitizeHeaders({
  'User-Agent':'UA',
  Referer:'https://live.ertflix.gr/live',
  Origin:'https://live.ertflix.gr',
  Cookie:'secret=1',
  Authorization:'Bearer secret',
}),{
  'User-Agent':'UA',
  Referer:'https://live.ertflix.gr/live',
  Origin:'https://live.ertflix.gr',
});

const unavailable=await discoverBrowserResolvedOfficial({channel:{name:'ERT1'},env:{}});
assert.equal(unavailable.available,false);
assert.equal(unavailable.candidates.length,0);

const calls=[];
const fetchImpl=async(input,options={})=>{
  calls.push({url:String(input),options});
  assert.equal(String(input),'https://resolver.example.test/resolve');
  const body=JSON.parse(options.body);
  assert.equal(body.url,'https://live.ertflix.gr/live');
  assert.deepEqual(body.capture.extensions,['m3u8','mpd','mp4','webm']);
  assert.equal(options.headers.authorization,'Bearer test-token');
  return new Response(JSON.stringify({observations:[
    {url:'https://live.ertflix.gr/media/ert1/master.m3u8?token=abc',responseStatus:200,responseContentType:'application/vnd.apple.mpegurl',headers:{'User-Agent':'Browser UA',Referer:'https://live.ertflix.gr/live',Cookie:'drop-me'}},
    {url:'https://live.ertflix.gr/media/ert1/manifest.mpd',responseStatus:200,responseContentType:'application/dash+xml',headers:{Origin:'https://live.ertflix.gr'}},
    {url:'https://live.ertflix.gr/media/ert1/rejected.mpd',responseStatus:401,responseContentType:'application/octet-stream',headers:{Referer:'https://live.ertflix.gr/live'}},
    {url:'https://evil.example/fake.m3u8',responseStatus:200,headers:{Referer:'https://live.ertflix.gr/live'}},
    {url:'https://live.ertflix.gr/image.jpg',responseStatus:200,headers:{}},
  ]}),{status:200,headers:{'content-type':'application/json'}});
};

const result=await discoverBrowserResolvedOfficial({
  channel:{name:'ERT1',id:'ert1'},
  freshness:'7d',
  env:{BROWSER_RESOLVER_URL:'https://resolver.example.test/',BROWSER_RESOLVER_TOKEN:'test-token'},
  fetchImpl,
});

assert.equal(result.provider,BROWSER_RESOLVED_OFFICIAL_PROVIDER);
assert.equal(result.recognized,true);
assert.equal(result.available,true);
assert.equal(result.reports.owner,'ERT');
assert.equal(result.reports.pages.length,1);
assert.equal(result.reports.pages[0].url,'https://live.ertflix.gr/live');
assert.equal(result.reports.pages[0].observations,5);
assert.equal(result.reports.pages[0].matches,2);
assert.equal(result.candidates.length,2);
assert.deepEqual(result.candidates.map(item=>item.sourceType).sort(),['dash','hls']);
assert.ok(result.candidates.every(item=>item.trustClass==='OFFICIAL'&&item.saveEligible===true&&item.matchConfidence==='HIGH'));
assert.deepEqual(result.candidates[0].requiredHeaders,{'User-Agent':'Browser UA',Referer:'https://live.ertflix.gr/live'});
assert.equal('Cookie' in result.candidates[0].requiredHeaders,false);
assert.equal(calls.length,1);

const missingToken=await discoverBrowserResolvedOfficial({
  channel:{name:'ERT1'},
  env:{BROWSER_RESOLVER_URL:'https://resolver.example.test/'},
  fetchImpl:async()=>{throw new Error('must not fetch');},
});
assert.equal(missingToken.available,false);
assert.equal(missingToken.candidates.length,0);

const unknown=await discoverBrowserResolvedOfficial({
  channel:{name:'UNKNOWN'},
  env:{BROWSER_RESOLVER_URL:'https://resolver.example.test/',BROWSER_RESOLVER_TOKEN:'test-token'},
  fetchImpl:async()=>{throw new Error('must not fetch');},
});
assert.equal(unknown.recognized,false);
assert.equal(unknown.available,true);
assert.equal(unknown.candidates.length,0);

console.log('browser-resolved official provider tests PASS');
