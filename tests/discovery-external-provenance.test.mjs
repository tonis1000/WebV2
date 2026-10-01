import assert from 'node:assert/strict';
import { normalizeCandidate, GITHUB_PUBLIC_PLAYLISTS_PROVIDER } from '../src/discovery/external-discovery-client.js';

const channel={id:'ert1',name:'ERT1'};
const normalized=normalizeCandidate(GITHUB_PUBLIC_PLAYLISTS_PROVIDER,{
  channelName:'ERT1',
  sourceType:'hls',
  sourceUrl:'https://stream.example/ert1/master.m3u8',
  sourceOrigin:'fixture-github',
  sourceOriginLabel:'Example playlist',
  sourceOriginUrl:'https://github.com/example/repo/blob/main/greece.m3u',
  inputFormatId:'m3u',
  discoveryProvider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,
},channel);

assert.equal(normalized.sourceOriginLabel,'Example playlist');
assert.equal(normalized.sourceOriginUrl,'https://github.com/example/repo/blob/main/greece.m3u');
assert.equal(normalized.inputFormatId,'m3u');
assert.equal(normalized.resolvedMediaFormatId,'hls');
assert.equal(normalized.browserPlayable,true);

console.log('external discovery provenance normalization PASS');
