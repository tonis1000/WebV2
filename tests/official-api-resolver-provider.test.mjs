import assert from 'node:assert/strict';
import {
  OFFICIAL_API_RESOLVER_PROVIDER,
  discoverOfficialApi,
  chooseMediaUrl,
  inferredType,
  safeMediaSummary,
  safeVerifierUrl,
} from '../workers/source-discovery/official-api-resolver.js';

assert.equal(OFFICIAL_API_RESOLVER_PROVIDER,'official-api-resolver');
assert.equal(inferredType('https://example.test/live.mpd'),'dash');
assert.equal(inferredType('https://example.test/live.m3u8'),'hls');
assert.equal(chooseMediaUrl({primaryUrl:'https://a.test/a.mpd',url:'https://b.test/b.mpd'}),'https://a.test/a.mpd');
assert.deepEqual(safeMediaSummary('https://ert-ucdn.broadpeak-aas.com/bpk-tv/ERT1/default/index.mpd?secret=drop'),{host:'ert-ucdn.broadpeak-aas.com',pathname:'/bpk-tv/ERT1/default/index.mpd'});
assert.equal(safeVerifierUrl('https://verifier.example.test/').href,'https://verifier.example.test/verify');
assert.equal(safeVerifierUrl('https://verifier.example.test/verify').href,'https://verifier.example.test/verify');
assert.equal(safeVerifierUrl('https://verifier.example.test/verify/?x=1#frag').href,'https://verifier.example.test/verify');
assert.throws(()=>safeVerifierUrl('https://verifier.example.test/not-verify'),/\/verify/);

const sourceUrl='https://ert-ucdn.broadpeak-aas.com/bpk-tv/ERT1/default/index.mpd';
const apiFetch=async(input,options={})=>{
  const url=new URL(String(input));
  assert.equal(url.hostname,'live.ertflix.gr');
  assert.equal(url.pathname,'/api/stream');
  assert.equal(url.searchParams.get('channel'),'ert1');
  assert.equal(options.headers.Referer,'https://live.ertflix.gr/live/ert1');
  assert.equal(options.headers.Origin,'https://live.ertflix.gr');
  return new Response(JSON.stringify({url:sourceUrl,primaryUrl:sourceUrl,fallbackUrl:null,type:'tv',source:'official',updatedAt:'2026-09-27T00:00:00.000Z'}),{status:200,headers:{'content-type':'application/json'}});
};
const verifiedFetch=async(input,options={})=>{
  assert.equal(new URL(String(input)).pathname,'/verify');
  const body=JSON.parse(options.body);
  assert.equal(body.candidate.sourceType,'dash');
  assert.equal(body.candidate.sourceUrl,sourceUrl);
  assert.deepEqual(Object.keys(body.candidate.requiredHeaders).sort(),['Origin','Referer','User-Agent']);
  assert.equal(body.candidate.requiredHeaders.Origin,'https://live.ertflix.gr');
  return new Response(JSON.stringify({ok:true,version:'1.0',results:[{candidateId:'official-api',status:'VERIFIED',verified:true,lastHttpStatus:200,mediaType:'dash',drmDetected:false,detail:'Manifest/media probe succeeded',redirects:[],finalTarget:{host:'ert-ucdn.broadpeak-aas.com',pathname:'/bpk-tv/ERT1/default/index.mpd',queryCount:0,queryKeys:[]},finalResponseHeaders:{headerNames:['content-type'],hasSetCookie:false,hasWwwAuthenticate:false}}]}),{status:200,headers:{'content-type':'application/json'}});
};

const verified=await discoverOfficialApi({channel:{name:'ERT1',id:'ert1'},fetchImpl:apiFetch,verifierFetch:verifiedFetch,verifierUrl:'https://verifier.example.test/'});
assert.equal(verified.provider,OFFICIAL_API_RESOLVER_PROVIDER);
assert.equal(verified.recognized,true);
assert.equal(verified.candidates.length,1);
assert.equal(verified.candidates[0].sourceType,'dash');
assert.equal(verified.candidates[0].trustClass,'OFFICIAL');
assert.equal(verified.candidates[0].saveEligible,true);
assert.equal(verified.reports.api.mediaHost,'ert-ucdn.broadpeak-aas.com');
assert.equal(verified.reports.api.mediaPath,'/bpk-tv/ERT1/default/index.mpd');
assert.equal(verified.reports.verification.status,'VERIFIED');
assert.equal(verified.reports.verification.requestContext.originHost,'live.ertflix.gr');
assert.deepEqual(verified.reports.verification.redirects,[]);
assert.deepEqual(verified.reports.verification.finalTarget,{host:'ert-ucdn.broadpeak-aas.com',pathname:'/bpk-tv/ERT1/default/index.mpd',queryCount:0,queryKeys:[]});
assert.deepEqual(verified.reports.verification.finalResponseHeaders,{headerNames:['content-type'],hasSetCookie:false,hasWwwAuthenticate:false});
assert.equal(verified.reports.restriction,null);

const failedFetch=async()=>new Response(JSON.stringify({ok:true,version:'1.0',results:[{candidateId:'official-api',status:'FAILED',verified:false,lastHttpStatus:401,mediaType:'',drmDetected:false,detail:'Upstream HTTP 401',redirects:[{status:307,from:{host:'ert-ucdn.broadpeak-aas.com',pathname:'/bpk-tv/ERT1/default/index.mpd',queryCount:0,queryKeys:[]},to:{host:'cdn.example.test',pathname:'/signed/manifest.mpd',queryCount:2,queryKeys:['expires','token']},hostChanged:true,responseHeaders:{headerNames:['cache-control','location','set-cookie'],hasSetCookie:true,hasWwwAuthenticate:false}}],finalTarget:{host:'cdn.example.test',pathname:'/signed/manifest.mpd',queryCount:2,queryKeys:['expires','token']},finalResponseHeaders:{headerNames:['content-type','www-authenticate'],hasSetCookie:false,hasWwwAuthenticate:true}}]}),{status:200,headers:{'content-type':'application/json'}});
const failed=await discoverOfficialApi({channel:{name:'ERT1',id:'ert1'},fetchImpl:apiFetch,verifierFetch:failedFetch,verifierUrl:'https://verifier.example.test'});
assert.equal(failed.candidates.length,0);
assert.equal(failed.reports.verification.serviceStatus,200);
assert.equal(failed.reports.verification.verified,false);
assert.equal(failed.reports.verification.lastHttpStatus,401);
assert.equal(failed.reports.verification.redirects.length,1);
assert.equal(failed.reports.verification.redirects[0].status,307);
assert.equal(failed.reports.verification.redirects[0].hostChanged,true);
assert.deepEqual(failed.reports.verification.redirects[0].to.queryKeys,['expires','token']);
assert.deepEqual(failed.reports.verification.redirects[0].responseHeaders,{headerNames:['cache-control','location','set-cookie'],hasSetCookie:true,hasWwwAuthenticate:false});
assert.deepEqual(failed.reports.verification.finalTarget,{host:'cdn.example.test',pathname:'/signed/manifest.mpd',queryCount:2,queryKeys:['expires','token']});
assert.deepEqual(failed.reports.verification.finalResponseHeaders,{headerNames:['content-type','www-authenticate'],hasSetCookie:false,hasWwwAuthenticate:true});
assert.equal(failed.reports.restriction.type,'SERVER_REGION_RESTRICTED');
assert.equal(failed.reports.restriction.scope,'ERT_LIVE_GREECE');
assert.equal(failed.reports.restriction.channelKey,'ert1');
assert.equal(failed.reports.restriction.upstreamStatus,401);
const serialized=JSON.stringify(failed.reports.verification);
assert.equal(serialized.includes('super-secret'),false);
assert.equal(serialized.includes('Bearer realm'),false);
assert.match(failed.reports.reason,/region/i);

const badHostFetch=async()=>new Response(JSON.stringify({primaryUrl:'https://evil.example/live.mpd'}),{status:200,headers:{'content-type':'application/json'}});
const badHost=await discoverOfficialApi({channel:{name:'ERT1',id:'ert1'},fetchImpl:badHostFetch,verifierFetch:async()=>{throw new Error('must not verify');}});
assert.equal(badHost.candidates.length,0);
assert.match(badHost.reports.reason,/not allowlisted/i);

const unknown=await discoverOfficialApi({channel:{name:'MEGA',id:'mega'},fetchImpl:async()=>{throw new Error('must not fetch');}});
assert.equal(unknown.recognized,false);
assert.equal(unknown.candidates.length,0);

console.log('official API resolver provider tests PASS');
