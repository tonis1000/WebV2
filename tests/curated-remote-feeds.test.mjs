import assert from 'node:assert/strict';
import { selectIptvOrgStreamRows } from '../workers/source-discovery/iptv-org-structured.js';
import {
  FEEDS,
  FALLBACK_TRIGGER_COUNT,
  parseM3u,
  parseEnigma2,
  parseFeed,
  parseAliveGrJson,
  selectCuratedFeedPlan,
  MAX_FALLBACK_FEEDS_PER_REQUEST,
} from '../workers/webtv-source-discovery.js';

assert.ok(FEEDS.some(feed=>feed.name==='iptv-org Greece'&&feed.format==='m3u'));
assert.ok(FEEDS.some(feed=>feed.name==='jimgate07/grtv multi'&&feed.tier==='primary'&&feed.priority==='high'&&/griptv\.m3u/.test(feed.url)),'rich jimgate multi-source playlist must be scanned as a primary curated feed');
assert.ok(FEEDS.some(feed=>feed.name==='IPTV Nexus Greece'&&feed.tier==='primary'&&feed.priority==='high'&&/country\/gr\.m3u/.test(feed.url)),'health-ranked Greece feed must be primary');
assert.ok(FEEDS.some(feed=>feed.name==='Free-TV/IPTV Greece'&&feed.tier==='primary'&&/playlist_greece\.m3u8/.test(feed.url)),'Free-TV Greece-specific feed must replace broad global fallback');
assert.equal(FEEDS.some(feed=>feed.name==='Free-TV/IPTV'&&/master\/playlist\.m3u8/.test(feed.url)),false,'broad Free-TV global playlist should not remain in curated catalog');
assert.ok(FEEDS.some(feed=>feed.name==='HansSettings Greece'&&feed.format==='enigma2'));
assert.ok(FEEDS.some(feed=>feed.id==='alivegr-live'&&feed.format==='alivegr-json'&&feed.tier==='intelligence'&&feed.priority==='high'),'AliveGR live JSON must be an enabled bounded intelligence source inside Curated');
assert.ok(FEEDS.some(feed=>feed.name==='Ciefp IPTV Mix'&&feed.tier==='fallback'));
assert.ok(FEEDS.some(feed=>feed.name==='b2og iptv-org All'&&feed.tier==='fallback'));
assert.equal(FALLBACK_TRIGGER_COUNT,3);
assert.equal(MAX_FALLBACK_FEEDS_PER_REQUEST,1);
const plan=selectCuratedFeedPlan(FEEDS);
const enabledPrimaryFeeds=FEEDS.filter(feed=>feed.enabled!==false&&(feed.tier||'primary')==='primary');
assert.equal(plan.primary.length,enabledPrimaryFeeds.length,'Greece curated discovery must scan every enabled primary feed');
assert.deepEqual(plan.primary.map(feed=>feed.id).sort(),enabledPrimaryFeeds.map(feed=>feed.id).sort(),'no enabled primary feed may be excluded from the Greece runtime plan');
const futurePrimary={id:'future-greek-primary',name:'Future Greek Primary',url:'https://future.example.test/gr.m3u',format:'m3u',tier:'primary',enabled:true,priority:'high'};
const futurePlan=selectCuratedFeedPlan([...FEEDS,futurePrimary]);
assert.ok(futurePlan.primary.some(feed=>feed.id===futurePrimary.id),'new enabled primary feeds must automatically join the Greece runtime plan without changing a numeric cap');
assert.equal(plan.fallback.length,1);
assert.ok(plan.primary.some(feed=>feed.id==='hanssettings-gr'),'HansSettings Greece must stay inside the bounded primary runtime plan');
assert.equal(plan.intelligence.length,1);
assert.equal(plan.intelligence[0]?.id,'alivegr-live','AliveGR must stay inside the bounded intelligence runtime plan without displacing existing primary feeds');
assert.equal(plan.fallback[0]?.id,'ciefp-iptv-mix','Ciefp private-route acceptance corpus must be the single bounded fallback runtime lane');
assert.equal(plan.fallback.some(feed=>feed.id==='b2og-iptv-org-all'),false,'broad fourth fallback feed must stay outside the per-request CPU budget');

const foreignPlan=selectCuratedFeedPlan(FEEDS,{name:'CNN',id:'cnn',originalId:'CNN',tvgId:'CNN.us'});
assert.equal(foreignPlan.primary.length,1,'foreign exact identities should avoid scanning Greece-only primaries');
assert.equal(foreignPlan.primary[0]?.id,'iptv-org-country-us','foreign exact identity should use the bounded native iptv-org country feed first');
assert.equal(foreignPlan.primary[0]?.url,'https://iptv-org.github.io/iptv/countries/us.m3u');
assert.equal(foreignPlan.intelligence.length,0,'Greece-specific intelligence should not run for a foreign exact identity');
assert.equal(foreignPlan.fallback.length,1);
assert.equal(foreignPlan.fallback[0]?.id,'b2og-iptv-org-all','b2og All should be the bounded mirror fallback for an exact foreign identity');

const greekPlan=selectCuratedFeedPlan(FEEDS,{name:'SKAI',id:'skai',originalId:'SKAI',tvgId:'Skai.gr'});
assert.ok(greekPlan.primary.some(feed=>feed.id==='hanssettings-gr'),'Greek exact identity should retain the current Greece-first curated plan');
assert.equal(greekPlan.intelligence[0]?.id,'alivegr-live');
assert.equal(greekPlan.fallback[0]?.id,'ciefp-iptv-mix','Greek/no-country fallback exploration should retain Ciefp');

const channel={id:'skai',originalId:'SKAI',name:'SKAI',tvgId:'Skai.gr'};
const m3u=`#EXTM3U\n#EXTINF:-1 tvg-id="Skai.gr" tvg-name="SKAI HD",SKAI\nhttps://cdn.example.test/skai/master.m3u8\n`;
const m3uCandidates=parseM3u(m3u,channel,{name:'fixture-m3u'});
assert.equal(m3uCandidates.length,1);
assert.equal(m3uCandidates[0].sourceUrl,'https://cdn.example.test/skai/master.m3u8');
assert.equal(m3uCandidates[0].sourceType,'hls');
assert.equal(m3uCandidates[0].sourceOrigin,'fixture-m3u');

const m3uWithHeaders=`#EXTM3U
#EXTINF:-1 tvg-id="Skai.gr" tvg-name="SKAI" http-referrer="https://attr.example/watch" http-user-agent="AttrUA",SKAI
#EXTVLCOPT:http-referrer=https://directive.example/watch
#EXTVLCOPT:http-user-agent=DirectiveUA
https://cdn.example.test/skai/headers.m3u8
`;
const m3uHeaderCandidates=parseM3u(m3uWithHeaders,channel,{name:'fixture-m3u-headers'});
assert.equal(m3uHeaderCandidates.length,1);
assert.deepEqual(m3uHeaderCandidates[0].requiredHeaders,{
  'User-Agent':'AttrUA',
  Referer:'https://attr.example/watch',
},'EXTINF http-* headers should be preserved and take precedence over equivalent EXTVLCOPT directives');

const m3uDirectiveHeaders=`#EXTM3U
#EXTINF:-1 tvg-id="Skai.gr" tvg-name="SKAI",SKAI
#EXTVLCOPT:http-referrer=https://directive.example/watch
#EXTVLCOPT:http-user-agent=DirectiveUA
#EXTVLCOPT:http-cookie=secret=must-not-pass
https://cdn.example.test/skai/directive.m3u8
`;
const directiveHeaderCandidates=parseM3u(m3uDirectiveHeaders,channel,{name:'fixture-m3u-directives'});
assert.deepEqual(directiveHeaderCandidates[0].requiredHeaders,{
  'User-Agent':'DirectiveUA',
  Referer:'https://directive.example/watch',
},'only safe Referer/User-Agent EXTVLCOPT directives should flow into requiredHeaders');

const inlineHeaderCandidate=parseM3u(`#EXTM3U
#EXTINF:-1 tvg-id="Skai.gr" tvg-name="SKAI" http-referrer="https://attr.example/watch" http-user-agent="AttrUA",SKAI
#EXTVLCOPT:http-user-agent=DirectiveUA
https://cdn.example.test/skai/inline.m3u8|User-Agent=InlineUA&Referer=https%3A%2F%2Finline.example%2F
`,channel,{name:'fixture-m3u-inline'})[0];
assert.deepEqual(inlineHeaderCandidate.requiredHeaders,{
  'User-Agent':'InlineUA',
  Referer:'https://inline.example/',
},'inline IPTV URL headers should remain the most specific override');
const rtspM3u=`#EXTM3U\n#EXTINF:-1 tvg-name="SKAI",SKAI\nrtsp://camera.example.test/live\n#EXTINF:-1 tvg-name="SKAI",SKAI\nrtmp://media.example.test/live/skai\n`;
const gatewayCandidates=parseM3u(rtspM3u,channel,{name:'fixture-protocols'});
assert.deepEqual(gatewayCandidates.map(item=>item.sourceType),['rtsp','rtmp']);
assert.ok(gatewayCandidates.every(item=>item.saveEligible===false));

const enigma=`#NAME Stream Griekenland (GR)\n#SERVICE 4097:0:1:0:0:0:0:0:0:0:https%3a//cdn.example.test/skai/index.m3u8:SKAI\n#DESCRIPTION SKAI\n#SERVICE 1:0:19:2EF:2BC:13E:820000:0:0:0:\n#DESCRIPTION Satellite only\n`;
const enigmaCandidates=parseEnigma2(enigma,channel,{name:'fixture-enigma',format:'enigma2'});
assert.equal(enigmaCandidates.length,1);
assert.equal(enigmaCandidates[0].sourceUrl,'https://cdn.example.test/skai/index.m3u8');
assert.equal(enigmaCandidates[0].sourceType,'hls');
assert.equal(enigmaCandidates[0].sourceOrigin,'fixture-enigma');

const headerAware=`#SERVICE 5002:0:1:0:0:0:0:0:0:0:https%3a//cdn.example.test/skai/live.m3u8%7CReferer%3Dhttps%253A%252F%252Fwww.skai.gr%252F:SKAI\n#DESCRIPTION SKAI\n`;
const headerCandidates=parseFeed(headerAware,channel,{name:'fixture-header',format:'enigma2'});
assert.equal(headerCandidates.length,1);
assert.ok(headerCandidates[0].sourceUrl.startsWith('https://cdn.example.test/skai/live.m3u8|Referer='));

const alivegr=JSON.stringify({
  updated:'05-10-2026',
  channels:[
    {
      name:'ANT1',
      streams:[
        {
          url:'http://15.235.41.165/hls/antenna.m3u8',
          drm:null,
          headers:{
            'User-Agent':'Roku/DVP-15.6 (15.6.4.9914-CE)',
            'x-roku-reserved-dev-id':'fixture-roku-id'
          }
        },
        {
          url:'https://drm.example.test/ant1/manifest.mpd',
          drm:['org.w3.clearkey',{'kid':'key'}],
          headers:null
        }
      ]
    },
    {
      name:'MEGA',
      streams:[{url:'https://cdn.example.test/mega/master.m3u8',drm:null,headers:null}]
    }
  ]
});
const alivegrCandidates=parseAliveGrJson(alivegr,{id:'ant1',name:'ANT1'},{id:'alivegr-live',name:'AliveGR',format:'alivegr-json',url:'https://example.test/alivegr.json'});
assert.equal(alivegrCandidates.length,1,'DRM alternatives and wrong channels must not become AliveGR candidates');
assert.equal(alivegrCandidates[0].sourceUrl,'http://15.235.41.165/hls/antenna.m3u8');
assert.equal(alivegrCandidates[0].sourceOrigin,'AliveGR');
assert.equal(alivegrCandidates[0].sourceOriginUrl,'https://example.test/alivegr.json');
assert.equal(alivegrCandidates[0].inputFormatId,'alivegr-json');
assert.deepEqual(alivegrCandidates[0].requiredHeaders,{
  'User-Agent':'Roku/DVP-15.6 (15.6.4.9914-CE)',
  'X-Roku-Reserved-Dev-Id':'fixture-roku-id'
});

const wrongChannel=parseEnigma2(enigma,{name:'MEGA'},{name:'fixture-enigma',format:'enigma2'});
assert.equal(wrongChannel.length,0);

const structuredStreams=JSON.stringify([
  {
    channel:'CNN.us',
    feed:'SD',
    title:'CNN International primary',
    url:'https://cdn.example.test/cnn/primary.m3u8',
    referrer:'https://cnn.example/watch',
    user_agent:'StructuredUA/1.0',
    quality:'1080p',
    labels:['Geo-blocked']
  },
  {
    channel:'CNN.us',
    feed:'SD',
    title:'CNN International alternate',
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
  },
  {
    channel:'BBCNews.uk',
    feed:'SD',
    title:'BBC News',
    url:'https://cdn.example.test/bbc/news.m3u8',
    referrer:null,
    user_agent:null,
    quality:'1080p',
    labels:[]
  }
]);
const structuredCandidates=selectIptvOrgStreamRows(structuredStreams,{name:'CNN',tvgId:'CNN.us@SD'});
assert.equal(structuredCandidates.length,2,'exact iptv-org channel/feed identity should retain multiple distinct structured stream routes');
assert.deepEqual(structuredCandidates.map(item=>item.url),[
  'https://cdn.example.test/cnn/primary.m3u8',
  'https://cdn.example.test/cnn/alternate.m3u8',
]);
assert.equal(structuredCandidates[0].channel,'CNN.us');
assert.equal(structuredCandidates[0].feed,'SD');
assert.equal(structuredCandidates[0].quality,'1080p');
assert.deepEqual(structuredCandidates[0].labels,['Geo-blocked']);
assert.equal(structuredCandidates.some(item=>item.feed==='East'),false,'an explicit @feed suffix must prevent sibling-feed leakage');

console.log('curated remote feed parser tests PASS');
