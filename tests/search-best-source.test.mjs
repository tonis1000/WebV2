import assert from 'node:assert/strict';
import { selectBestSource, rankBestSources } from '../src/search/best-source.js';

const base={
  channelName:'MEGA',
  sourceType:'hls',
  resolvedMediaFormatId:'hls',
  browserPlayable:true,
  verificationStatus:'VERIFIED',
  streamKind:'live',
  drmDetected:false,
  startupMs:1200,
};

const healthy={...base,candidateId:'healthy',sourceUrl:'https://good.example/live.m3u8'};
const weak={...base,candidateId:'weak',sourceUrl:'https://weak.example/live.m3u8'};
const http={...base,candidateId:'http',sourceUrl:'http://legacy.example/live.m3u8'};
const vod={...base,candidateId:'vod',sourceUrl:'https://vod.example/movie.m3u8',streamKind:'vod'};
const drm={...base,candidateId:'drm',sourceUrl:'https://drm.example/manifest.mpd',drmDetected:true};
const failed={...base,candidateId:'failed',sourceUrl:'https://dead.example/live.m3u8',verificationStatus:'HTTP 403'};

const scores=new Map([[healthy.sourceUrl,85],[weak.sourceUrl,-20],[http.sourceUrl,95]]);
const ranked=rankBestSources([weak,http,healthy,vod,drm,failed],{
  scoreHealth:candidate=>scores.get(candidate.sourceUrl)??0,
  playbackConfirmedIds:new Set(),
  pageProtocol:'https:',
});
assert.deepEqual(ranked.map(row=>row.candidate.candidateId),['healthy','http','weak'],'only verified live non-DRM browser candidates should rank');
assert.equal(ranked[0].healthScore,85);
assert.equal(ranked[0].browserCompatible,true);
assert.equal(ranked[1].browserCompatible,false,'HTTP candidate should lose browser compatibility on an HTTPS page');

const confirmed=selectBestSource([healthy,weak],{
  scoreHealth:candidate=>candidate.candidateId==='healthy'?95:-10,
  playbackConfirmedIds:new Set(['weak']),
  pageProtocol:'https:',
});
assert.equal(confirmed.candidateId,'weak','real playback confirmation must outrank historical health');

const none=selectBestSource([{...base,candidateId:'x',streamKind:'unknown'}]);
assert.equal(none,null,'unknown live/VOD semantics must never become Best Source');

console.log('Unified Search Best Source ranking PASS');
