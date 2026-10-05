import assert from 'node:assert/strict';
import huntWorker, { buildQueries, freshEnoughForKind, rank, safeXtreamProviderLeadUrl, xtreamProviderEvidence } from '../workers/source-huntatonisworkersdev.js';

const megaQueries=buildQueries('MEGA');
assert.equal(megaQueries.length,3,'explicit paid Source Hunt fallback keeps the bounded three-query budget');
const xtream=megaQueries.find(item=>item.kind==='xtream');
assert.ok(xtream,'Source Hunt must include one Xtream provider/trial query');
assert.equal(xtream.freshness,'py','provider/trial discovery uses an annual window while direct stream searches stay monthly');
assert.match(xtream.q,/Xtream Codes/i);
assert.match(xtream.q,/trial/i);
assert.match(xtream.q,/Greek IPTV/i);
assert.equal(/MEGA|Mega Channel/i.test(xtream.q),false,'provider discovery must not require a provider page to mention the current channel');

const evidence=xtreamProviderEvidence('Greek IPTV with MEGA, ANT1 and SKAI. M3U or Xtream Codes login. Free trial available.','MEGA');
assert.equal(evidence.qualifies,true);
assert.equal(evidence.xtream,true);
assert.equal(evidence.greek,true);
assert.equal(evidence.trial,true);
const playerArticle=xtreamProviderEvidence('IPTV player supports English, Greek and Spanish. Xtream Codes supported. Free trial of the app.','MEGA');
assert.equal(playerArticle.qualifies,false,'language support alone must not look like Greek-channel provider evidence');

const provider=safeXtreamProviderLeadUrl('https://provider.example/greek-iptv/free-trial');
assert.equal(provider,'https://provider.example/greek-iptv/free-trial');
assert.equal(safeXtreamProviderLeadUrl('https://provider.example/get.php?username=demo&password=secret&type=m3u'),'','credential-bearing Xtream URLs must never become provider leads');
assert.equal(safeXtreamProviderLeadUrl('https://demo:secret@provider.example/player_api.php'),'','embedded credentials must never become provider leads');

const fourMonthsAgo=new Date(Date.now()-120*86400000).toISOString();
assert.equal(freshEnoughForKind({page_age:fourMonthsAgo},'xtream',30),true,'Xtream inspection must share the annual provider freshness policy');
assert.equal(freshEnoughForKind({page_age:fourMonthsAgo},'web',30),false,'ordinary web inspection must stay monthly');
const providerRank=rank({_kind:'xtream',title:'Greek IPTV Xtream Codes free trial',description:'Greek channels including MEGA and ANT1',url:'https://provider.example/greek-iptv',page_age:fourMonthsAgo},'MEGA');
assert.ok(providerRank>0,'Xtream provider results up to one year old must remain rankable');
const webRank=rank({_kind:'web',title:'MEGA IPTV playlist',description:'MEGA stream',url:'https://example.test/mega',page_age:fourMonthsAgo},'MEGA');
assert.equal(webRank,-100,'ordinary web stream results stay on the 30-day freshness rule');

console.log('Source Hunt Xtream provider/trial lead contract PASS');

const originalFetch=globalThis.fetch;
let braveCalls=0;
try{
  globalThis.fetch=async(input)=>{
    const url=new URL(String(input));
    if(url.hostname==='api.search.brave.com'){braveCalls+=1;return new Response(JSON.stringify({web:{results:[]}}),{status:200,headers:{'content-type':'application/json'}});}
    if(url.hostname==='www.reddit.com')return new Response(JSON.stringify({data:{children:[]}}),{status:200,headers:{'content-type':'application/json'}});
    return new Response('',{status:404,headers:{'content-type':'text/plain'}});
  };
  const freeResponse=await huntWorker.fetch(new Request('https://hunt.test/hunt?channel=MEGA&days=30&debug=1'),{BRAVE_API_KEY:'fixture-key'});
  assert.equal(freeResponse.status,200);
  const freePayload=await freeResponse.json();
  assert.equal(freePayload.paidSearchEnabled,false,'normal Source Hunt must report paid search disabled');
  assert.equal(braveCalls,0,'normal Source Hunt must not call Brave even when a key is configured');

  const paidResponse=await huntWorker.fetch(new Request('https://hunt.test/hunt?channel=MEGA&days=30&debug=1&paid=1'),{BRAVE_API_KEY:'fixture-key'});
  assert.equal(paidResponse.status,200);
  const paidPayload=await paidResponse.json();
  assert.equal(paidPayload.paidSearchEnabled,true,'paid Source Hunt must require explicit paid=1');
  assert.equal(braveCalls,3,'explicit paid Source Hunt fallback may use only the bounded three Brave queries');
}finally{globalThis.fetch=originalFetch;}
