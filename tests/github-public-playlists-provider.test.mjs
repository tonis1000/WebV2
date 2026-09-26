import assert from 'node:assert/strict';
import discovery from '../workers/webtv-source-discovery.js';
import { GITHUB_PUBLIC_PLAYLISTS_PROVIDER, GITHUB_MAX_REPOS, GITHUB_MAX_SUBREQUESTS } from '../workers/source-discovery/github-public-playlists.js';

assert.equal(GITHUB_PUBLIC_PLAYLISTS_PROVIDER,'github-public-playlists');
assert.equal(GITHUB_MAX_REPOS,4);
assert.equal(GITHUB_MAX_SUBREQUESTS,10);

const sample=`#EXTM3U
#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA HD",MEGA HD
https://github-found.test/mega.m3u8
#EXTINF:-1 tvg-id="MEGA-NEWS" tvg-name="MEGA News",MEGA News
https://wrong.test/mega-news.m3u8
`;
const originalFetch=globalThis.fetch;
const seenSearches=[];
try{
  globalThis.fetch=async(input)=>{
    const url=new URL(String(input));
    if(url.hostname==='api.github.com'&&url.pathname==='/search/repositories'){
      const q=url.searchParams.get('q')||'';seenSearches.push(q);
      assert.match(q,/pushed:>=\d{4}-\d{2}-\d{2}/);
      return new Response(JSON.stringify({items:[{full_name:'fixture/recent-greek-iptv',default_branch:'main',pushed_at:new Date().toISOString(),fork:false,archived:false}]}),{status:200,headers:{'content-type':'application/json','x-ratelimit-remaining':'9'}});
    }
    if(url.hostname==='api.github.com'&&url.pathname==='/repos/fixture/recent-greek-iptv/contents'){
      return new Response(JSON.stringify([{type:'file',name:'playlist.m3u',size:500,download_url:'https://raw.githubusercontent.com/fixture/recent-greek-iptv/main/playlist.m3u'},{type:'file',name:'README.md',size:100,download_url:'https://raw.githubusercontent.com/fixture/recent-greek-iptv/main/README.md'}]),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.hostname==='raw.githubusercontent.com'&&url.pathname.endsWith('/playlist.m3u'))return new Response(sample,{status:200,headers:{'content-type':'audio/x-mpegurl'}});
    throw new Error(`Unexpected fetch ${url}`);
  };

  const request=new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,freshness:'24h',channel:{name:'MEGA',id:'mega',originalId:'MEGA'}})});
  const response=await discovery.fetch(request,{});assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.version,'1.4');
  assert.equal(body.provider,GITHUB_PUBLIC_PLAYLISTS_PROVIDER);
  assert.equal(body.freshnessRequested,'24h');assert.equal(body.freshnessApplied,true);assert.equal(body.candidates.length,1);assert.equal(body.candidates[0].sourceUrl,'https://github-found.test/mega.m3u8');assert.equal(body.candidates[0].discoveryProvider,GITHUB_PUBLIC_PLAYLISTS_PROVIDER);assert.match(body.candidates[0].sourceOrigin,/fixture\/recent-greek-iptv/);assert.match(body.candidates[0].freshness,/^repo-pushed:/);assert.equal(body.reports.searches.length,2);assert.equal(body.reports.repositories.length,1);assert.equal(body.reports.subrequestsUsed,4);assert.equal(seenSearches.length,2);

  const disabled=await discovery.fetch(new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,channel:{name:'MEGA'}})}),{DISABLE_GITHUB_PUBLIC_PLAYLISTS:'1'});
  assert.equal(disabled.status,503);assert.equal((await disabled.json()).provider,GITHUB_PUBLIC_PLAYLISTS_PROVIDER);
  console.log('GitHub public playlist provider tests PASS');
}finally{globalThis.fetch=originalFetch;}
