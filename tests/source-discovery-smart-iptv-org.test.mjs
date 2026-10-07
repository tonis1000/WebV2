import assert from 'node:assert/strict';
import smart from '../workers/webtv-source-discovery-smart.js';

const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async input=>{
    const url=String(input instanceof Request?input.url:input);
    if(url==='https://iptv-org.github.io/api/streams.json'){
      return new Response(JSON.stringify([
        {
          channel:'CNN.us',
          feed:'SD',
          title:'CNN primary',
          url:'https://cdn.example.test/cnn/primary.m3u8',
          referrer:'https://cnn.example/watch',
          user_agent:'StructuredUA/1.0',
          quality:'1080p',
          labels:['Geo-blocked']
        },
        {
          channel:'CNN.us',
          feed:'SD',
          title:'CNN alternate',
          url:'https://cdn.example.test/cnn/alternate.m3u8',
          referrer:null,
          user_agent:null,
          quality:'720p',
          labels:[]
        },
        {
          channel:'CNN.us',
          feed:'East',
          title:'CNN wrong feed',
          url:'https://cdn.example.test/cnn/east.m3u8',
          referrer:null,
          user_agent:null,
          quality:'720p',
          labels:[]
        }
      ]),{status:200,headers:{'content-type':'application/json','content-length':'700'}});
    }
    if(url.includes('/iptv/countries/us.m3u')){
      return new Response(
        '#EXTM3U\n'
        +'#EXTINF:-1 tvg-id="CNN.us@SD" tvg-name="CNN",CNN\n'
        +'https://cdn.example.test/cnn/primary.m3u8\n',
        {status:200,headers:{'content-type':'audio/x-mpegurl'}}
      );
    }
    if(url.includes('iptv.b2og.com/o_all.m3u')){
      return new Response('#EXTM3U\n',{status:200,headers:{'content-type':'audio/x-mpegurl'}});
    }
    return new Response('#EXTM3U\n',{status:200,headers:{'content-type':'text/plain'}});
  };

  const request=new Request('https://discovery.test/discover',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      provider:'curated-remote-feeds',
      freshness:'7d',
      channel:{name:'CNN',id:'cnn',originalId:'CNN',tvgId:'CNN.us@SD'}
    })
  });
  const response=await smart.fetch(request,{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.version,'1.14');
  assert.equal(body.planning.strategy,'iptv-org-country');
  assert.equal(body.planning.countryCode,'us');
  assert.equal(body.planning.structuredIptvOrg,true);
  assert.equal(body.structuredIptvOrg.attempted,true);
  assert.equal(body.structuredIptvOrg.status,200);
  assert.equal(body.structuredIptvOrg.count,2);
  assert.deepEqual(body.candidates.map(item=>item.sourceUrl),[
    'https://cdn.example.test/cnn/primary.m3u8',
    'https://cdn.example.test/cnn/alternate.m3u8'
  ]);
  assert.equal(body.candidates[0].inputFormatId,'iptv-org-streams-json','structured candidate should win duplicate URL provenance over country M3U');
  assert.equal(body.candidates[0].iptvOrgChannelId,'CNN.us');
  assert.equal(body.candidates[0].iptvOrgFeedId,'SD');
  assert.equal(body.candidates[0].quality,'1080p');
  assert.deepEqual(body.candidates[0].labels,['Geo-blocked']);
  assert.deepEqual(body.candidates[0].requiredHeaders,{
    'User-Agent':'StructuredUA/1.0',
    Referer:'https://cnn.example/watch'
  });
  assert.equal(body.candidates.some(item=>item.iptvOrgFeedId==='East'),false);

  const status=await (await smart.fetch(new Request('https://discovery.test/'),{})).json();
  assert.equal(status.version,'1.14');
  assert.ok(status.features.includes('iptv-org structured exact streams'));

  console.log('Source Discovery smart iptv-org structured integration PASS');
}finally{
  globalThis.fetch=originalFetch;
}
