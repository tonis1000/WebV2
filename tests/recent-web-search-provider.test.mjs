import assert from 'node:assert/strict';
import { discoverRecentWebSearch, RECENT_WEB_SEARCH_PROVIDER, WEB_MAX_SEARCHES, WEB_MAX_PAGE_SCANS, WEB_MAX_SUBREQUESTS } from '../workers/source-discovery/recent-web-search.js';
import { parseM3u } from '../workers/webtv-source-discovery.js';

assert.equal(RECENT_WEB_SEARCH_PROVIDER,'recent-web-search');
assert.equal(WEB_MAX_SEARCHES,2);
assert.equal(WEB_MAX_PAGE_SCANS,4);
assert.equal(WEB_MAX_SUBREQUESTS,8);

const originalFetch=globalThis.fetch;
const seen=[];
try{
  globalThis.fetch=async(input,options={})=>{
    const url=new URL(String(input));seen.push(url.toString());
    if(url.hostname==='api.search.brave.com'){
      assert.equal(options.headers['X-Subscription-Token'],'fixture-key');
      assert.equal(options.headers.Accept,'application/json');
      assert.equal(Object.keys(options.headers).some(key=>key.toLowerCase()==='user-agent'),false,'Brave auth request must match the proven legacy header contract');
      assert.equal(url.searchParams.get('freshness'),'pd');
      return new Response(JSON.stringify({web:{results:[
        {title:'MEGA TV Greece IPTV source',description:'Recent MEGA live playlist page',url:'https://example.test/mega-live',page_age:'2026-09-26T08:00:00Z'},
        {title:'Unrelated sports page',description:'No relevant channel',url:'https://example.test/sports'},
        {title:'MEGA social result',description:'MEGA live',url:'https://youtube.com/watch?v=x'},
      ]}}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.hostname==='example.test'&&url.pathname==='/mega-live'){
      return new Response('<html><body>MEGA stream https://cdn.example.test/live/mega.m3u8?token=abc</body></html>',{status:200,headers:{'content-type':'text/html'}});
    }
    throw new Error(`Unexpected fetch ${url}`);
  };

  const result=await discoverRecentWebSearch({channel:{name:'MEGA',id:'mega',originalId:'MEGA'},freshness:'24h',env:{BRAVE_API_KEY:'fixture-key'},parseM3u});
  assert.equal(result.provider,RECENT_WEB_SEARCH_PROVIDER);
  assert.equal(result.freshnessRequested,'24h');
  assert.equal(result.freshnessApplied,true);
  assert.equal(result.reports.searches.length,2);
  assert.equal(result.reports.pages.length,1);
  assert.equal(result.reports.subrequestsUsed,3);
  assert.ok(result.reports.subrequestsUsed<=WEB_MAX_SUBREQUESTS);
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].sourceUrl,'https://cdn.example.test/live/mega.m3u8?token=abc');
  assert.equal(result.candidates[0].sourceType,'hls');
  assert.equal(result.candidates[0].discoveryProvider,RECENT_WEB_SEARCH_PROVIDER);
  assert.equal(result.candidates[0].matchConfidence,'MEDIUM');
  assert.equal(result.candidates[0].freshness,'result-date:2026-09-26T08:00:00.000Z');
  assert.equal(seen.filter(url=>url.includes('api.search.brave.com')).length,2);
  assert.equal(seen.some(url=>url.includes('youtube.com')),false,'blocked social result must not be fetched');

  globalThis.fetch=async(input)=>{
    const url=new URL(String(input));
    if(url.hostname==='api.search.brave.com')return new Response(JSON.stringify({error:{code:'VALIDATION',detail:'fixture validation detail',status:422}}),{status:422,headers:{'content-type':'application/json'}});
    throw new Error(`Unexpected fetch ${url}`);
  };
  const rejected=await discoverRecentWebSearch({channel:{name:'MEGA'},freshness:'7d',env:{BRAVE_API_KEY:'fixture-key'},parseM3u});
  assert.equal(rejected.reports.searches[0].status,422);
  assert.match(rejected.reports.searches[0].error,/VALIDATION/);
  assert.match(rejected.reports.searches[0].error,/fixture validation detail/);
  assert.match(rejected.reports.searches[0].error,/422/);

  await assert.rejects(()=>discoverRecentWebSearch({channel:{name:'MEGA'},freshness:'7d',env:{},parseM3u}),/BRAVE_API_KEY/);
  console.log('recent web search provider tests PASS');
}finally{globalThis.fetch=originalFetch;}
