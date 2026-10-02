import assert from 'node:assert/strict';
import discovery from '../workers/webtv-source-discovery.js';
import { GITHUB_PUBLIC_PLAYLISTS_PROVIDER, GITHUB_MAX_REPOS, GITHUB_MAX_SUBREQUESTS } from '../workers/source-discovery/github-public-playlists.js';

assert.equal(GITHUB_PUBLIC_PLAYLISTS_PROVIDER,'github-public-playlists');
assert.equal(GITHUB_MAX_REPOS,4);
assert.equal(GITHUB_MAX_SUBREQUESTS,16);

const rootSample=`#EXTM3U
#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA HD",MEGA HD
https://github-found.test/mega.m3u8
#EXTINF:-1 tvg-id="MEGA-NEWS" tvg-name="MEGA News",MEGA News
https://wrong.test/mega-news.m3u8
`;
const codeSample=`#EXTM3U
#EXTINF:-1 tvg-id="MEGA" tvg-name="Mega Channel",Mega Channel
https://github-code.test/mega.m3u8
#EXTINF:-1 tvg-id="OMEGA" tvg-name="Omega TV",Omega TV
https://wrong.test/omega.m3u8
`;
const originalFetch=globalThis.fetch;
const seenSearches=[];
const seenCodeSearches=[];
try{
  globalThis.fetch=async(input)=>{
    const url=new URL(String(input));
    if(url.hostname==='api.github.com'&&url.pathname==='/search/repositories'){
      const q=url.searchParams.get('q')||'';seenSearches.push(q);
      assert.match(q,/pushed:>=\d{4}-\d{2}-\d{2}/);
      return new Response(JSON.stringify({items:[{full_name:'fixture/recent-greek-iptv',default_branch:'main',pushed_at:new Date().toISOString(),fork:false,archived:false}]}),{status:200,headers:{'content-type':'application/json','x-ratelimit-remaining':'20'}});
    }
    if(url.hostname==='api.github.com'&&url.pathname==='/search/code'){
      const q=url.searchParams.get('q')||'';seenCodeSearches.push(q);
      assert.match(q,/(?:Greece|Greek)/i);
      assert.match(q,/extension:m3u8?/i);
      return new Response(JSON.stringify({items:[{name:'greece.m3u',path:'stable/greece.m3u',url:'https://api.github.com/repos/fixture/code-hit/contents/stable/greece.m3u?ref=abc123',html_url:'https://github.com/fixture/code-hit/blob/abc123/stable/greece.m3u',repository:{full_name:'fixture/code-hit'}}]}),{status:200,headers:{'content-type':'application/json','x-ratelimit-remaining':'19'}});
    }
    if(url.hostname==='api.github.com'&&url.pathname==='/repos/fixture/code-hit'){
      return new Response(JSON.stringify({full_name:'fixture/code-hit',default_branch:'main',pushed_at:new Date().toISOString(),fork:false,archived:false}),{status:200,headers:{'content-type':'application/json','x-ratelimit-remaining':'18'}});
    }
    if(url.hostname==='api.github.com'&&url.pathname==='/repos/fixture/code-hit/contents/stable/greece.m3u'){
      return new Response(JSON.stringify({type:'file',name:'greece.m3u',path:'stable/greece.m3u',encoding:'base64',content:Buffer.from(codeSample,'utf8').toString('base64')}),{status:200,headers:{'content-type':'application/json','x-ratelimit-remaining':'17'}});
    }
    if(url.hostname==='api.github.com'&&url.pathname==='/repos/fixture/recent-greek-iptv/contents'){
      return new Response(JSON.stringify([{type:'file',name:'playlist.m3u',size:500,download_url:'https://raw.githubusercontent.com/fixture/recent-greek-iptv/main/playlist.m3u'},{type:'file',name:'README.md',size:100,download_url:'https://raw.githubusercontent.com/fixture/recent-greek-iptv/main/README.md'}]),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.hostname==='raw.githubusercontent.com'&&url.pathname.endsWith('/playlist.m3u'))return new Response(rootSample,{status:200,headers:{'content-type':'audio/x-mpegurl'}});
    throw new Error(`Unexpected fetch ${url}`);
  };

  const request=new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,freshness:'24h',channel:{name:'MEGA',id:'mega',originalId:'MEGA'}})});
  const response=await discovery.fetch(request,{});assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.version,'1.7');
  assert.equal(body.provider,GITHUB_PUBLIC_PLAYLISTS_PROVIDER);
  assert.equal(body.freshnessRequested,'24h');assert.equal(body.freshnessApplied,true);
  assert.equal(body.candidates.length,2);
  assert.deepEqual(body.candidates.map(item=>item.sourceUrl).sort(),['https://github-code.test/mega.m3u8','https://github-found.test/mega.m3u8']);
  assert.ok(body.candidates.every(item=>item.discoveryProvider===GITHUB_PUBLIC_PLAYLISTS_PROVIDER));
  assert.ok(body.candidates.some(item=>/github-code:fixture\/code-hit\/stable\/greece\.m3u/.test(item.sourceOrigin)));
  assert.ok(body.candidates.some(item=>/fixture\/recent-greek-iptv/.test(item.sourceOrigin)));
  assert.equal(body.reports.searches.length,2);
  assert.equal(body.reports.codeSearches.length,2);
  assert.equal(body.reports.codeFiles.length,1);
  assert.equal(body.reports.repositories.length,1);
  assert.equal(seenSearches.length,2);
  assert.equal(seenCodeSearches.length,2);
  assert.ok(seenCodeSearches.some(q=>/"MEGA"/i.test(q)));
  assert.ok(seenCodeSearches.some(q=>/MEGA TV/i.test(q)));

  const disabled=await discovery.fetch(new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,channel:{name:'MEGA'}})}),{DISABLE_GITHUB_PUBLIC_PLAYLISTS:'1'});
  assert.equal(disabled.status,503);assert.equal((await disabled.json()).provider,GITHUB_PUBLIC_PLAYLISTS_PROVIDER);
  console.log('GitHub public playlist provider tests PASS');
}finally{globalThis.fetch=originalFetch;}
