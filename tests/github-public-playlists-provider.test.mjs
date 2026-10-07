import assert from 'node:assert/strict';
import discovery from '../workers/webtv-source-discovery.js';
import { GITHUB_PUBLIC_PLAYLISTS_PROVIDER, GITHUB_MAX_SEARCHES, GITHUB_MAX_REPOS, GITHUB_MAX_SUBREQUESTS } from '../workers/source-discovery/github-public-playlists.js';

assert.equal(GITHUB_PUBLIC_PLAYLISTS_PROVIDER,'github-public-playlists');
assert.equal(GITHUB_MAX_SEARCHES,3);
assert.equal(GITHUB_MAX_REPOS,5);
assert.equal(GITHUB_MAX_SUBREQUESTS,10);

const rootSample=`#EXTM3U
#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA HD",MEGA HD
https://github-found.test/mega.m3u8
#EXTINF:-1 tvg-id="MEGA-NEWS" tvg-name="MEGA News",MEGA News
https://wrong.test/mega-news.m3u8
`;
const subfolderSample=`#EXTM3U
#EXTINF:-1 tvg-id="MEGA" tvg-name="Mega Channel",Mega Channel
https://github-subfolder.test/mega.m3u8
#EXTINF:-1 tvg-id="OMEGA" tvg-name="Omega TV",Omega TV
https://wrong.test/omega.m3u8
`;
const originalFetch=globalThis.fetch;
const seenSearches=[];
const seenTrees=[];
try{
  globalThis.fetch=async(input)=>{
    const url=new URL(String(input));
    if(url.hostname==='api.github.com'&&url.pathname==='/search/repositories'){
      const q=url.searchParams.get('q')||'';seenSearches.push(q);
      assert.match(q,/pushed:>=\d{4}-\d{2}-\d{2}/);
      if(/greece m3u/i.test(q)){
        return new Response(JSON.stringify({items:[{full_name:'fixture/recent-greek-iptv',default_branch:'main',pushed_at:new Date().toISOString(),fork:false,archived:false}]}),{status:200,headers:{'content-type':'application/json','x-ratelimit-remaining':'20'}});
      }
      if(/MEGA TV/i.test(q)){
        return new Response(JSON.stringify({items:[{full_name:'fixture/subfolder-greek-tv',default_branch:'main',pushed_at:new Date().toISOString(),fork:false,archived:false}]}),{status:200,headers:{'content-type':'application/json','x-ratelimit-remaining':'19'}});
      }
      return new Response(JSON.stringify({items:[]}),{status:200,headers:{'content-type':'application/json','x-ratelimit-remaining':'18'}});
    }
    if(url.hostname==='api.github.com'&&url.pathname==='/repos/fixture/recent-greek-iptv/git/trees/main'){
      seenTrees.push(url.pathname);
      return new Response(JSON.stringify({truncated:false,tree:[
        {type:'blob',path:'playlist.m3u',size:500},
        {type:'blob',path:'README.md',size:100},
      ]}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.hostname==='api.github.com'&&url.pathname==='/repos/fixture/subfolder-greek-tv/git/trees/main'){
      seenTrees.push(url.pathname);
      return new Response(JSON.stringify({truncated:false,tree:[
        {type:'blob',path:'docs/README.md',size:100},
        {type:'blob',path:'stable/greece.m3u',size:650},
      ]}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.hostname==='raw.githubusercontent.com'&&url.pathname==='/fixture/recent-greek-iptv/main/playlist.m3u'){
      return new Response(rootSample,{status:200,headers:{'content-type':'audio/x-mpegurl'}});
    }
    if(url.hostname==='raw.githubusercontent.com'&&url.pathname==='/fixture/subfolder-greek-tv/main/stable/greece.m3u'){
      return new Response(subfolderSample,{status:200,headers:{'content-type':'audio/x-mpegurl'}});
    }
    throw new Error(`Unexpected fetch ${url}`);
  };

  const request=new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,freshness:'24h',channel:{name:'MEGA',id:'mega',originalId:'MEGA'}})});
  const response=await discovery.fetch(request,{});assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.version,'1.14');
  assert.equal(body.provider,GITHUB_PUBLIC_PLAYLISTS_PROVIDER);
  assert.equal(body.freshnessRequested,'24h');assert.equal(body.freshnessApplied,true);
  assert.equal(body.candidates.length,2);
  assert.deepEqual(body.candidates.map(item=>item.sourceUrl).sort(),['https://github-found.test/mega.m3u8','https://github-subfolder.test/mega.m3u8']);
  assert.ok(body.candidates.every(item=>item.discoveryProvider===GITHUB_PUBLIC_PLAYLISTS_PROVIDER));
  assert.ok(body.candidates.some(item=>/fixture\/subfolder-greek-tv\/stable\/greece\.m3u/.test(item.sourceOrigin)));
  assert.ok(body.candidates.some(item=>/fixture\/recent-greek-iptv\/playlist\.m3u/.test(item.sourceOrigin)));
  assert.equal(body.reports.searches.length,3);
  assert.equal(body.reports.repositories.length,2);
  assert.equal(seenSearches.length,3);
  assert.equal(seenTrees.length,2);
  assert.ok(seenSearches.some(q=>/"MEGA TV" greek tv playlist in:readme/i.test(q)));
  assert.ok(body.reports.repositories.every(item=>item.recursive===true));

  const disabled=await discovery.fetch(new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,channel:{name:'MEGA'}})}),{DISABLE_GITHUB_PUBLIC_PLAYLISTS:'1'});
  assert.equal(disabled.status,503);assert.equal((await disabled.json()).provider,GITHUB_PUBLIC_PLAYLISTS_PROVIDER);
  console.log('GitHub public playlist provider tests PASS');
}finally{globalThis.fetch=originalFetch;}
