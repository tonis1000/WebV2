import assert from 'node:assert/strict';
import discovery, { candidateMatches, parseM3u, MAX_CONCURRENCY } from '../workers/webtv-source-discovery.js';

assert.equal(MAX_CONCURRENCY,2);
assert.equal(candidateMatches('#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA HD",MEGA HD',{name:'MEGA',id:'mega'}),true);
assert.equal(candidateMatches('#EXTINF:-1 tvg-id="MEGA-NEWS" tvg-name="MEGA News",MEGA News',{name:'MEGA',id:'mega'}),false);

const statusResponse=await discovery.fetch(new Request('https://discovery.test/'),{});
assert.equal(statusResponse.status,200);
const status=await statusResponse.json();
assert.equal(status.version,'1.1');
assert.equal(status.providers['curated-remote-feeds'],true);
assert.equal(status.providers['github-public-playlists'],true);

const sample=`#EXTM3U
#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA HD",MEGA HD
https://good.test/mega.m3u8
#EXTINF:-1 tvg-id="MEGA-NEWS" tvg-name="MEGA News",MEGA News
https://wrong.test/mega-news.m3u8
#EXTINF:-1 tvg-id="SKAI" tvg-name="SKAI",SKAI
https://good.test/skai.m3u8
`;
const parsed=parseM3u(sample,{name:'MEGA',id:'mega'},{name:'fixture'});
assert.equal(parsed.length,1);
assert.equal(parsed[0].sourceUrl,'https://good.test/mega.m3u8');
assert.equal(parsed[0].matchConfidence,'HIGH');

const originalFetch=globalThis.fetch;
let inFlight=0,maxInFlight=0;
try{
  globalThis.fetch=async()=>{
    inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
    await new Promise(resolve=>setTimeout(resolve,15));
    inFlight--;
    return new Response(sample,{status:200,headers:{'content-type':'audio/x-mpegurl'}});
  };
  const request=new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'curated-remote-feeds',freshness:'24h',channel:{name:'MEGA',id:'mega',originalId:'MEGA'}})});
  const response=await discovery.fetch(request,{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.provider,'curated-remote-feeds');
  assert.equal(body.freshnessRequested,'24h');
  assert.equal(body.freshnessApplied,false);
  assert.equal(body.candidates.length,1,'dedupe should collapse same MEGA URL from all curated feeds');
  assert.equal(body.candidates[0].sourceUrl,'https://good.test/mega.m3u8');
  assert.ok(maxInFlight<=2,`expected max concurrency <=2, saw ${maxInFlight}`);

  const disabled=await discovery.fetch(new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'curated-remote-feeds',channel:{name:'MEGA'}})}),{DISABLE_CURATED_REMOTE_FEEDS:'1'});
  assert.equal(disabled.status,503);
  assert.equal((await disabled.json()).error,'Provider disabled');

  const wrongProvider=await discovery.fetch(new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'web-search',channel:{name:'MEGA'}})}),{});
  assert.equal(wrongProvider.status,400);

  console.log('source discovery Worker tests PASS');
}finally{globalThis.fetch=originalFetch;}
