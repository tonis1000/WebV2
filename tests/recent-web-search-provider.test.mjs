import fs from 'node:fs';
import assert from 'node:assert/strict';
import { discoverRecentWebSearch, RECENT_WEB_SEARCH_PROVIDER, WEB_MAX_SEARCHES, WEB_MAX_PAGE_SCANS, WEB_MAX_GIST_SCANS, WEB_MAX_SUBREQUESTS } from '../workers/source-discovery/recent-web-search.js';
import { parseM3u } from '../workers/webtv-source-discovery.js';

assert.equal(RECENT_WEB_SEARCH_PROVIDER,'recent-web-search');
assert.equal(WEB_MAX_SEARCHES,3);
assert.equal(WEB_MAX_PAGE_SCANS,3);
assert.equal(WEB_MAX_GIST_SCANS,2);
assert.equal(WEB_MAX_SUBREQUESTS,8);
const discoveryDeploy=fs.readFileSync(new URL('../.github/workflows/deploy-source-discovery.yml',import.meta.url),'utf8');
assert.equal(/^\s*WEB=.*"provider":"recent-web-search"/m.test(discoveryDeploy),false,'deploy/live verification must not run the old paid Recent Web smoke');
assert.equal(discoveryDeploy.includes('"allowPaidFallback":true'),false,'deploy/live verification must never opt in to paid Brave');
assert.match(discoveryDeploy,/PAID_GUARD_CODE=.*"provider":"recent-web-search"/,'deploy may exercise only the no-opt-in Recent Web guard');
assert.match(discoveryDeploy,/guardCode===['"]409['"]/,'deploy must require the paid guard to stop before Brave');

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
      const q=url.searchParams.get('q')||'';
      assert.ok(/MEGA|Mega Channel|MEGA TV/i.test(q));
      if(/site:gist\.github\.com/i.test(q)){
        return new Response(JSON.stringify({web:{results:[
          {title:'MEGA Greece M3U gist',description:'MEGA playlist m3u8',url:'https://gist.github.com/fixture-author/abc123',page_age:'2026-10-04T10:00:00Z'},
        ]}}),{status:200,headers:{'content-type':'application/json'}});
      }
      return new Response(JSON.stringify({web:{results:[
        {title:'MEGA TV Greece IPTV source',description:'Recent MEGA live playlist page',url:'https://example.test/mega-live',page_age:'2026-09-26T08:00:00Z'},
        {title:'Unrelated sports page',description:'No relevant channel',url:'https://example.test/sports'},
        {title:'MEGA social result',description:'MEGA live',url:'https://youtube.com/watch?v=x'},
      ]}}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.hostname==='api.github.com'&&url.pathname==='/gists/abc123'){
      return new Response(JSON.stringify({
        id:'abc123',
        html_url:'https://gist.github.com/fixture-author/abc123',
        created_at:'2026-10-01T09:00:00Z',
        updated_at:'2026-10-04T12:34:56Z',
        owner:{login:'fixture-author'},
        files:{
          'greek.m3u':{filename:'greek.m3u',truncated:false,content:'#EXTM3U\n#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA HD",MEGA HD\nhttps://gist-cdn.example/live/mega.m3u8\n'},
          'credentials.m3u':{filename:'credentials.m3u',truncated:false,content:'#EXTM3U\nhttp://provider.example/get.php?username=user1&password=secret&type=m3u_plus\n'},
        },
      }),{status:200,headers:{'content-type':'application/json','x-ratelimit-remaining':'59'}});
    }
    if(url.hostname==='example.test'&&url.pathname==='/mega-live'){
      return new Response('<html><body>MEGA stream https://cdn.example.test/live/mega.m3u8?token=abc\\u0026amp;sid=123\\u003c/a\\u003e\\\\</body></html>',{status:200,headers:{'content-type':'text/html'}});
    }
    throw new Error(`Unexpected fetch ${url}`);
  };

  const result=await discoverRecentWebSearch({channel:{name:'MEGA',id:'mega',originalId:'MEGA'},freshness:'24h',env:{BRAVE_API_KEY:'fixture-key'},parseM3u});
  assert.equal(result.provider,RECENT_WEB_SEARCH_PROVIDER);
  assert.equal(result.freshnessRequested,'24h');
  assert.equal(result.freshnessApplied,true);
  assert.equal(result.reports.searches.length,3);
  assert.equal(result.reports.pages.length,1);
  assert.equal(result.reports.gists.length,1);
  assert.equal(result.reports.gists[0].gistId,'abc123');
  assert.equal(result.reports.gists[0].author,'fixture-author');
  assert.equal(result.reports.gists[0].updatedAt,'2026-10-04T12:34:56.000Z');
  assert.equal(result.reports.gists[0].filesScanned,1);
  assert.equal(result.reports.gists[0].credentialFilesRejected,1);
  assert.equal(result.reports.subrequestsUsed,5);
  assert.ok(result.reports.subrequestsUsed<=WEB_MAX_SUBREQUESTS);
  assert.equal(result.candidates.length,2);
  const webCandidate=result.candidates.find(item=>item.sourceUrl.includes('cdn.example.test'));
  const gistCandidate=result.candidates.find(item=>item.sourceUrl.includes('gist-cdn.example'));
  assert.ok(webCandidate);
  assert.equal(webCandidate.sourceUrl,'https://cdn.example.test/live/mega.m3u8?token=abc&sid=123');
  assert.equal(webCandidate.sourceType,'hls');
  assert.equal(webCandidate.discoveryProvider,RECENT_WEB_SEARCH_PROVIDER);
  assert.equal(webCandidate.matchConfidence,'MEDIUM');
  assert.equal(webCandidate.freshness,'result-date:2026-09-26T08:00:00.000Z');
  assert.ok(gistCandidate);
  assert.equal(gistCandidate.sourceOrigin,'gist:fixture-author/abc123/greek.m3u');
  assert.equal(gistCandidate.sourceOriginUrl,'https://gist.github.com/fixture-author/abc123');
  assert.equal(gistCandidate.sourceOriginLabel,'GitHub Gist fixture-author/abc123 · greek.m3u');
  assert.equal(gistCandidate.freshness,'gist-updated:2026-10-04T12:34:56.000Z');
  assert.equal(gistCandidate.discoveryProvider,RECENT_WEB_SEARCH_PROVIDER);
  assert.equal(result.candidates.some(item=>/get\.php\?username=/i.test(item.sourceUrl)),false,'credential dump must never become a candidate');
  assert.equal(seen.filter(url=>url.includes('api.search.brave.com')).length,3);
  const braveQueries=seen.filter(url=>url.includes('api.search.brave.com')).map(value=>new URL(value).searchParams.get('q')||'');
  assert.ok(braveQueries.some(q=>/m3u8\s+mpd/i.test(q)),'technical query should cover both HLS and DASH');
  assert.ok(braveQueries.some(q=>/ζωντανά|live greek tv/i.test(q)),'second query should include Greek/live discovery wording');
  assert.ok(braveQueries.some(q=>/site:gist\.github\.com/i.test(q)),'third query should target GitHub Gists');
  assert.equal(seen.some(url=>url.includes('youtube.com')),false,'blocked social result must not be fetched');
  assert.equal(seen.some(url=>url.includes('gist.github.com/fixture-author/abc123')&& !url.includes('api.github.com')),false,'gist HTML must not be scraped when canonical Gist API metadata is available');

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
  console.log('recent web search provider + GitHub Gist intelligence tests PASS');
}finally{globalThis.fetch=originalFetch;}
