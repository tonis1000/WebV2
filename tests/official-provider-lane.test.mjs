import assert from 'node:assert/strict';
import {
  discoverOfficialProvider,
  OFFICIAL_PROVIDER_LANE,
  OFFICIAL_TIMEOUT_MS,
  OFFICIAL_MAX_PAGES,
  OFFICIAL_MAX_CANDIDATES,
  channelKey,
  extractMediaUrls,
} from '../workers/source-discovery/official-provider-lane.js';

assert.equal(OFFICIAL_PROVIDER_LANE,'official-provider-lane');
assert.equal(OFFICIAL_TIMEOUT_MS,6000);
assert.equal(OFFICIAL_MAX_PAGES,2);
assert.equal(OFFICIAL_MAX_CANDIDATES,8);
assert.equal(channelKey({name:'ΕΡΤ1'}),'ert1');
assert.equal(channelKey({name:'ANT1 HD'}),'ant1');
assert.equal(channelKey({name:'UNKNOWN'}),'');

const html=`<html><body>
<script>const a="https://live.ertflix.gr/media/ert1/master.m3u8";</script>
<script>const b="https://evil.test/fake/ert1.m3u8";</script>
<script>const c="https://live.ertflix.gr/media/ert1/manifest.mpd?token=abc&amp;x=1";</script>
</body></html>`;
const extracted=extractMediaUrls(html,['live.ertflix.gr']);
assert.deepEqual(extracted,[
  'https://live.ertflix.gr/media/ert1/master.m3u8',
  'https://live.ertflix.gr/media/ert1/manifest.mpd?token=abc&x=1',
]);

const seen=[];
const fetchImpl=async(input,options={})=>{
  const url=String(input);seen.push({url,options});
  assert.equal(new URL(url).hostname,'live.ertflix.gr');
  return new Response(html,{status:200,headers:{'content-type':'text/html'}});
};

const result=await discoverOfficialProvider({channel:{name:'ERT1',id:'ert1'},freshness:'7d',fetchImpl});
assert.equal(result.provider,OFFICIAL_PROVIDER_LANE);
assert.equal(result.recognized,true);
assert.equal(result.freshnessApplied,false);
assert.equal(result.reports.owner,'ERT');
assert.equal(result.reports.pages.length,1);
assert.equal(result.reports.pages[0].status,200);
assert.equal(result.reports.pages[0].mediaMatches,2);
assert.equal(result.reports.subrequestsUsed,1);
assert.equal(result.candidates.length,3);
const page=result.candidates.find(item=>item.candidateKind==='official-page');
assert.ok(page);
assert.equal(page.trustClass,'OFFICIAL');
assert.equal(page.saveEligible,false);
assert.equal(page.sourceUrl,'https://live.ertflix.gr/');
const media=result.candidates.filter(item=>item.candidateKind==='media');
assert.equal(media.length,2);
assert.deepEqual(media.map(item=>item.sourceType).sort(),['dash','hls']);
assert.ok(media.every(item=>item.trustClass==='OFFICIAL'&&item.saveEligible===true&&item.matchConfidence==='HIGH'));
assert.equal(seen.length,1);

const unknown=await discoverOfficialProvider({channel:{name:'SOME UNKNOWN'},freshness:'24h',fetchImpl:async()=>{throw new Error('must not fetch');}});
assert.equal(unknown.recognized,false);
assert.equal(unknown.candidates.length,0);
assert.equal(unknown.reports.subrequestsUsed,0);

const mad=await discoverOfficialProvider({channel:{name:'MAD TV'},fetchImpl:async()=>new Response('<html></html>',{status:200})});
assert.equal(mad.recognized,true);
assert.ok(mad.candidates.some(item=>item.candidateKind==='official-embed'&&item.saveEligible===false&&item.trustClass==='OFFICIAL'));

console.log('official provider lane tests PASS');
