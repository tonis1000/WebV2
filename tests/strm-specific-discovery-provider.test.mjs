import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  discoverStrmSpecific,
  STRM_SPECIFIC_DISCOVERY_PROVIDER,
  STRM_MAX_REFERENCES,
  STRM_MAX_DEPTH,
  STRM_MAX_SUBREQUESTS,
} from '../workers/source-discovery/strm-specific-discovery.js';
import { parseM3u } from '../workers/webtv-source-discovery.js';

assert.equal(STRM_SPECIFIC_DISCOVERY_PROVIDER,'strm-specific-discovery');
assert.equal(STRM_MAX_REFERENCES,6);
assert.equal(STRM_MAX_DEPTH,3);
assert.equal(STRM_MAX_SUBREQUESTS,12);

const router=fs.readFileSync(new URL('../workers/webtv-source-discovery.js',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../src/discovery/external-discovery-client.js',import.meta.url),'utf8');
const deploy=fs.readFileSync(new URL('../.github/workflows/deploy-source-discovery.yml',import.meta.url),'utf8');
assert.match(router,/strm-specific-discovery\.js/,'Source Discovery router must import the STRM provider module');
assert.match(router,/DISABLE_STRM_SPECIFIC_DISCOVERY/,'STRM provider must retain an independent Worker kill switch');
assert.match(client,/strm-specific-discovery/,'Browser client must expose the STRM provider explicitly');
assert.match(deploy,/strm-specific-discovery/,'Source Discovery live gate must exercise the STRM provider');
assert.match(deploy,/"name":"ERT1"/,'STRM live gate must use the real public ERT1 resolution path');

const feedText=`#EXTM3U
#EXTINF:-1 tvg-id="ERT1" tvg-name="ERT1 HD",ERT1 HD
https://repo.test/ert1.strm
#EXTINF:-1 tvg-id="ERT1" tvg-name="ERT1 HD",ERT1 HD BUP
https://repo.test/ert1.strm
#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA HD",MEGA HD
https://media.test/mega.m3u8
`;
const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async input=>{
    const url=new URL(String(input));
    if(url.hostname==='feed.test')return new Response(feedText,{status:200});
    if(url.pathname==='/ert1.strm')return new Response('https://repo.test/nested.strm',{status:200});
    if(url.pathname==='/nested.strm')return new Response('#KODIPROP:inputstream.adaptive.license_type=com.widevine.alpha\nhttps://media.test/ert1.mpd|User-Agent=FixtureUA&Referer=https%3A%2F%2Fexample.test%2F',{status:200});
    throw new Error(`Unexpected fetch ${url}`);
  };
  const result=await discoverStrmSpecific({channel:{name:'ERT1',id:'ert1',originalId:'ERT1'},freshness:'7d',parseM3u,feeds:[{name:'fixture-a',url:'https://feed.test/a.m3u'},{name:'fixture-b',url:'https://feed.test/b.m3u'}]});
  assert.equal(result.provider,STRM_SPECIFIC_DISCOVERY_PROVIDER);
  assert.equal(result.freshnessApplied,false);
  assert.equal(result.candidates.length,1,'duplicate STRM references should collapse');
  assert.equal(result.candidates[0].sourceType,'dash');
  assert.equal(result.candidates[0].sourceUrl,'https://media.test/ert1.mpd');
  assert.equal(result.candidates[0].discoveryProvider,STRM_SPECIFIC_DISCOVERY_PROVIDER);
  assert.equal(result.candidates[0].matchConfidence,'HIGH');
  assert.equal(result.candidates[0].drmDetected,true);
  assert.equal(result.candidates[0].requiredHeaders['User-Agent'],'FixtureUA');
  assert.equal(result.candidates[0].requiredHeaders.Referer,'https://example.test/');
  assert.equal(result.reports.resolutions.length,1);
  assert.equal(result.reports.resolutions[0].resolved,true);
  assert.equal(result.reports.resolutions[0].depth,2);
  assert.equal(result.reports.resolutions[0].chainLength,2);
  assert.ok(result.reports.subrequestsUsed<=STRM_MAX_SUBREQUESTS);

  globalThis.fetch=async input=>{
    const url=new URL(String(input));
    if(url.hostname==='feed.test')return new Response('#EXTM3U\n#EXTINF:-1 tvg-name="ERT1",ERT1\nhttps://repo.test/private.strm\n',{status:200});
    if(url.pathname==='/private.strm')return new Response('http://127.0.0.1/live.m3u8',{status:200});
    throw new Error(`Unexpected fetch ${url}`);
  };
  const blocked=await discoverStrmSpecific({channel:{name:'ERT1'},parseM3u,feeds:[{name:'fixture-private',url:'https://feed.test/private.m3u'}]});
  assert.equal(blocked.candidates.length,0);
  assert.match(blocked.reports.resolutions[0].error,/Private/);

  console.log('STRM-specific discovery provider tests PASS');
} finally {
  globalThis.fetch=originalFetch;
}
