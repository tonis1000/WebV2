import assert from 'node:assert/strict';
import { createCandidate, candidateForDisplay } from '../src/discovery/candidate-model.js';

const hls = createCandidate({
  channelName:'ERT1',
  sourceUrl:'https://stream.example/ert1/master.m3u8',
  sourceOrigin:'HansSettings Greece',
  sourceOriginLabel:'HansSettings Greece',
  sourceOriginUrl:'https://gitlab.openpli.org/openpli/hanssettings/-/blob/master/userbouquet.stream_griekenland__gr_.tv',
  inputFormatId:'enigma2',
});
assert.equal(hls.inputFormatId, 'enigma2');
assert.equal(hls.resolvedMediaFormatId, 'hls');
assert.equal(hls.browserPlayable, true);
assert.equal(hls.sourceUrl, 'https://stream.example/ert1/master.m3u8');
assert.equal(hls.sourceOriginUrl.includes('gitlab.openpli.org'), true);

const dash = createCandidate({channelName:'ERT2',sourceUrl:'https://stream.example/ert2/live.mpd',inputFormatId:'strm'});
assert.equal(dash.resolvedMediaFormatId, 'dash');
assert.equal(dash.browserPlayable, true);

const video = createCandidate({channelName:'Video',sourceUrl:'https://stream.example/archive/movie.mp4'});
assert.equal(video.resolvedMediaFormatId, 'direct-video');
assert.equal(video.browserPlayable, true);

const m3u = createCandidate({channelName:'List',sourceUrl:'https://example.test/list.m3u',inputFormatId:'m3u'});
assert.equal(m3u.inputFormatId, 'm3u');
assert.equal(m3u.resolvedMediaFormatId, 'unknown');
assert.equal(m3u.browserPlayable, false);

const strm = createCandidate({channelName:'Reference',sourceUrl:'https://example.test/channel.strm',inputFormatId:'strm'});
assert.equal(strm.resolvedMediaFormatId, 'unknown');
assert.equal(strm.browserPlayable, false);

const rtsp = createCandidate({channelName:'Legacy',sourceUrl:'rtsp://example.test/live',inputFormatId:'rtsp'});
assert.equal(rtsp.resolvedMediaFormatId, 'unknown');
assert.equal(rtsp.browserPlayable, false);

const rtmp = createCandidate({channelName:'Legacy',sourceUrl:'rtmp://example.test/live',inputFormatId:'rtmp'});
assert.equal(rtmp.browserPlayable, false);

const unsafeOrigin = candidateForDisplay(createCandidate({
  channelName:'MEGA',
  sourceUrl:'https://stream.example/mega.m3u8',
  sourceOriginLabel:'Unsafe fixture',
  sourceOriginUrl:'https://user:secret@example.test/private/list.m3u',
}));
assert.equal(unsafeOrigin.sourceOriginUrl, '', 'credential-bearing provenance URL must not be exposed');

const nonWebOrigin = candidateForDisplay(createCandidate({
  channelName:'MEGA',
  sourceUrl:'https://stream.example/mega.m3u8',
  sourceOriginUrl:'file:///tmp/private.m3u',
}));
assert.equal(nonWebOrigin.sourceOriginUrl, '', 'non-http(s) provenance URL must not be exposed');

const safeOrigin = candidateForDisplay(hls);
assert.equal(safeOrigin.sourceOriginUrl, hls.sourceOriginUrl);
assert.equal(safeOrigin.sourceOriginLabel, 'HansSettings Greece');

const observed=createCandidate({
  channelName:'ANT1',
  sourceUrl:'https://stream.example/ant1.m3u8',
  sourceOrigin:'hitnickgr/iptv',
  requiredHeaders:{Referer:'https://www.antenna.gr/'},
  sourceObservations:[
    {sourceFamilyId:'hitnickgr-iptv',sourceOrigin:'hitnickgr/iptv',sourceOriginUrl:'https://github.com/example/a',inputFormatId:'m3u',requiredHeaders:{}},
    {sourceFamilyId:'iptv-org-gr',sourceOrigin:'iptv-org Greece',sourceOriginUrl:'https://github.com/example/b',inputFormatId:'m3u',requiredHeaders:{Referer:'https://www.antenna.gr/'},unsupportedDirectiveNames:['KODIPROP:inputstream']},
  ],
  unsupportedDirectiveNames:['KODIPROP:inputstream'],
  headerConflictKeys:['Origin'],
});
assert.equal(observed.sourceObservations.length,2,'candidate model must preserve merged source observations');
assert.deepEqual(observed.sourceObservations.map(item=>item.sourceFamilyId),['hitnickgr-iptv','iptv-org-gr'],'candidate model must preserve stable source-family ids for future refresh');
assert.deepEqual(observed.unsupportedDirectiveNames,['KODIPROP:inputstream']);
assert.deepEqual(observed.headerConflictKeys,['Origin']);

console.log('discovery candidate provenance/capability contract PASS');
