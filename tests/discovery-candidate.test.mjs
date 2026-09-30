import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCandidate, candidateForDisplay, detectCandidateType, normalizeChannelName, SOURCE_TYPES } from '../src/discovery/candidate-model.js';
import { DiscoveryState, DEFAULT_FRESHNESS, FRESHNESS_OPTIONS } from '../src/discovery/discovery-state.js';

assert.equal(normalizeChannelName('  ΜΕΓΑ TV HD  '),'μεγα tv hd');
assert.equal(detectCandidateType('https://x.test/live.m3u8?token=1'),'hls');
assert.equal(detectCandidateType('https://x.test/live.mpd'),'dash');
assert.equal(detectCandidateType('https://x.test/a.strm'),'strm');
assert.equal(detectCandidateType('https://x.test/list.m3u'),'m3u');
assert.equal(detectCandidateType('rtsp://example.test/live'),'rtsp');
assert.equal(detectCandidateType('rtmps://example.test/live'),'rtmp');
assert.equal(detectCandidateType('https://x.test/live?id=1'),'direct');
assert.equal(detectCandidateType('https://x.test/live.m3u8','dash'),'dash');
assert.equal(detectCandidateType('https://x.test/live.m3u8','not-a-format'),'hls');
assert.equal(detectCandidateType('foo://example.test/live'),'unknown');
for (const type of ['hls','dash','strm','m3u','direct','rtsp','rtmp','xtream','xtream-preview','header-aware','unknown']) assert.equal(SOURCE_TYPES.has(type), true);

const candidateSource=fs.readFileSync(new URL('../src/discovery/candidate-model.js',import.meta.url),'utf8');
assert.match(candidateSource,/source-format-registry\.js/);
assert.match(candidateSource,/detectSourceFormat/);
assert.match(candidateSource,/toLegacySourceType/);
assert.doesNotMatch(candidateSource,/if \(\/\^rtsps\?:\\\/\\\//);
assert.doesNotMatch(candidateSource,/if \(\/\\\.m3u8/);

const rtsp=createCandidate({channelName:'MEGA',sourceUrl:'rtsp://user:password@example.test/live'});
assert.equal(rtsp.saveEligible,false);
assert.equal(candidateForDisplay(rtsp).sourceUrl.includes('password'),false);

const hls=createCandidate({channelName:'MEGA',sourceUrl:'https://x.test/live.m3u8',requiredHeaders:{'User-Agent':'UA','Cookie':'nope'},matchConfidence:'HIGH'});
assert.equal(hls.sourceType,'hls');
assert.equal(hls.verificationStatus,'UNVERIFIED');
assert.equal(hls.verified,false);
assert.deepEqual(hls.requiredHeaders,{'User-Agent':'UA'});

const xtream=createCandidate({channelName:'MEGA',sourceType:'xtream',sourceUrl:'https://provider.test/live/user/pass/42.ts',xtreamContext:{server:'https://provider.test',username:'user',password:'secret',streamId:'42',accountRef:'acct-1'},matchConfidence:'HIGH'});
assert.equal(xtream.sourceType,'xtream');
assert.equal(xtream.xtreamStreamId,'42');
assert.equal(xtream.xtreamContext.password,'secret');
const displayXtream=candidateForDisplay(xtream);
assert.equal(displayXtream.xtreamContext.password,'••••••••');
assert.equal(displayXtream.sourceUrl,'[redacted Xtream source]');
assert.equal(displayXtream.sourceUrl.includes('secret'),false);
assert.equal(displayXtream.sourceUrl.includes('/user/pass/'),false);

const state=new DiscoveryState();
assert.equal(state.snapshot().freshness,DEFAULT_FRESHNESS);
assert.deepEqual(FRESHNESS_OPTIONS.map(x=>x.id),['24h','7d','30d']);
state.setChannel({id:'mega',name:'MEGA',group:'General'});
assert.equal(state.snapshot().candidates.length,0);
assert.equal(state.snapshot().scanStatus,'idle');
state.setScanning();
assert.equal(state.snapshot().scanStatus,'loading');
state.setScanResult({candidates:[hls],lanes:{myPlaylist:1,total:1},message:'done'});
assert.equal(state.snapshot().candidates.length,1);
assert.equal(state.snapshot().lanes.myPlaylist,1);
assert.equal(state.snapshot().scanStatus,'done');
assert.equal(state.snapshot().scanMessage,'done');
assert.equal(Boolean(state.snapshot().lastScanAt),true);
assert.throws(()=>state.setFreshness('90d'));
state.setFreshness('24h');
assert.equal(state.snapshot().freshness,'24h');
console.log('discovery candidate/state tests PASS');
