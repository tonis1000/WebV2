import assert from 'node:assert/strict';
import {
  FEEDS,
  FALLBACK_TRIGGER_COUNT,
  parseM3u,
  parseEnigma2,
  parseFeed,
} from '../workers/webtv-source-discovery.js';

assert.ok(FEEDS.some(feed=>feed.name==='iptv-org Greece'&&feed.format==='m3u'));
assert.ok(FEEDS.some(feed=>feed.name==='jimgate07/grtv multi'&&feed.tier==='primary'&&feed.priority==='high'&&/griptv\.m3u/.test(feed.url)),'rich jimgate multi-source playlist must be scanned as a primary curated feed');
assert.ok(FEEDS.some(feed=>feed.name==='IPTV Nexus Greece'&&feed.tier==='primary'&&feed.priority==='high'&&/country\/gr\.m3u/.test(feed.url)),'health-ranked Greece feed must be primary');
assert.ok(FEEDS.some(feed=>feed.name==='Free-TV/IPTV Greece'&&feed.tier==='primary'&&/playlist_greece\.m3u8/.test(feed.url)),'Free-TV Greece-specific feed must replace broad global fallback');
assert.equal(FEEDS.some(feed=>feed.name==='Free-TV/IPTV'&&/master\/playlist\.m3u8/.test(feed.url)),false,'broad Free-TV global playlist should not remain in curated catalog');
assert.ok(FEEDS.some(feed=>feed.name==='HansSettings Greece'&&feed.format==='enigma2'));
assert.ok(FEEDS.some(feed=>feed.name==='Ciefp IPTV Mix'&&feed.tier==='fallback'));
assert.ok(FEEDS.some(feed=>feed.name==='b2og iptv-org All'&&feed.tier==='fallback'));
assert.equal(FALLBACK_TRIGGER_COUNT,3);

const channel={id:'skai',originalId:'SKAI',name:'SKAI',tvgId:'Skai.gr'};
const m3u=`#EXTM3U\n#EXTINF:-1 tvg-id="Skai.gr" tvg-name="SKAI HD",SKAI\nhttps://cdn.example.test/skai/master.m3u8\n`;
const m3uCandidates=parseM3u(m3u,channel,{name:'fixture-m3u'});
assert.equal(m3uCandidates.length,1);
assert.equal(m3uCandidates[0].sourceUrl,'https://cdn.example.test/skai/master.m3u8');
assert.equal(m3uCandidates[0].sourceType,'hls');
assert.equal(m3uCandidates[0].sourceOrigin,'fixture-m3u');
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

const wrongChannel=parseEnigma2(enigma,{name:'MEGA'},{name:'fixture-enigma',format:'enigma2'});
assert.equal(wrongChannel.length,0);

console.log('curated remote feed parser tests PASS');
