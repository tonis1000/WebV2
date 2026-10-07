import assert from 'node:assert/strict';
import smart from '../workers/webtv-source-discovery-smart.js';

const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async input=>{
    const url=String(input instanceof Request?input.url:input);
    if(url==='https://dearbulut.github.io/iptv/api/v1/by-country/gr.json'){
      return new Response(JSON.stringify([{
        id:'ANT1.gr',
        name:'ANT1',
        alt_names:['Αντέννα'],
        country:'GR',
        score:35,
        online:false,
        best_quality:'1080p',
        streams:[{
          channel:'ANT1.gr',
          feed:'SD',
          title:'ANT1',
          url:'https://mcdn.antennaplus.gr/live/media0/Ant1/HLS/Ant1.m3u8',
          referrer:'http://watch.antennaplus.gr',
          user_agent:'Chrome',
          quality:'1080p',
          rank:44.81,
          sources:['iptv-org'],
          health:{status:'blocked',score:35,uptime:0,checked_at:'2026-10-07T09:30:19.569Z',last_online:null,latency_ms:2618,media:null},
        }],
      }]),{status:200,headers:{'content-type':'application/json','content-length':'900'}});
    }
    if(url.includes('iptv-org.github.io/iptv/countries/gr.m3u')){
      return new Response(
        '#EXTM3U\n'
        +'#EXTINF:-1 tvg-id="ANT1.gr" tvg-name="ANT1",ANT1\n'
        +'https://mcdn.antennaplus.gr/live/media0/Ant1/HLS/Ant1.m3u8\n',
        {status:200,headers:{'content-type':'audio/x-mpegurl'}}
      );
    }
    if(url.includes('gist.githubusercontent.com/Twilight0/')){
      return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
    }
    return new Response('#EXTM3U\n',{status:200,headers:{'content-type':'audio/x-mpegurl'}});
  };

  const response=await smart.fetch(new Request('https://discovery.test/discover',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      provider:'curated-remote-feeds',
      freshness:'7d',
      channel:{name:'ANT1',id:'ant1',originalId:'ANT1'}
    })
  }),{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.version,'1.16');
  assert.equal(body.planning.strategy,'greece-curated');
  assert.equal(body.planning.nexusIntelligence,true);
  assert.equal(body.nexusIntelligence.attempted,true);
  assert.equal(body.nexusIntelligence.status,200);
  assert.equal(body.nexusIntelligence.countryCode,'gr');
  assert.equal(body.nexusIntelligence.matched,true);
  assert.equal(body.nexusIntelligence.channelId,'ANT1.gr');
  assert.equal(body.nexusIntelligence.count,1);
  assert.ok(body.reports.some(item=>item.feed==='IPTV Nexus JSON'&&item.status===200&&item.count===1));

  const route=body.candidates.find(item=>item.sourceUrl==='https://mcdn.antennaplus.gr/live/media0/Ant1/HLS/Ant1.m3u8'&&item.requiredHeaders?.Referer==='http://watch.antennaplus.gr');
  assert.ok(route,'existing curated route must gain a Nexus-enriched playback variant/descriptor');
  assert.equal(route.requiredHeaders['User-Agent'],'Chrome');
  assert.equal(route.sourceIntelligence.provider,'iptv-nexus');
  assert.equal(route.sourceIntelligence.healthStatus,'blocked');
  assert.equal(route.sourceIntelligence.quality,'1080p');
  assert.ok(route.sourceObservations.some(item=>item.sourceOrigin==='IPTV Nexus JSON'));
  assert.ok(body.actions.some(item=>item.type==='intelligence.nexus.completed'));

  const targeted=await smart.fetch(new Request('https://discovery.test/discover',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      provider:'curated-remote-feeds',
      freshness:'24h',
      sourceFamilyIds:['iptv-org-gr'],
      channel:{name:'ANT1',id:'ant1',originalId:'ANT1',tvgId:'ANT1.gr'}
    })
  }),{});
  const targetedBody=await targeted.json();
  assert.equal(targetedBody.planning.strategy,'targeted-refresh');
  assert.ok(targetedBody.candidates.some(item=>item.sourceFamilyId==='iptv-org-gr'&&item.sourceIntelligence?.provider==='iptv-nexus'),'same-route Nexus intelligence must enrich a targeted saved-family refresh without widening to unrelated new routes');

  console.log('Source Discovery smart IPTV Nexus enrichment PASS');
}finally{
  globalThis.fetch=originalFetch;
}
