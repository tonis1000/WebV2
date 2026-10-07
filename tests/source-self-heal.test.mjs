import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  buildRefreshOrigin,
  parseRefreshOrigin,
  candidatePlaybackReference,
  selectRefreshCandidates,
  selfHealSaveEligibility,
} from '../src/source-self-heal.js';

const origin=buildRefreshOrigin({
  discoveryProvider:'curated-remote-feeds',
  sourceFamilyId:'iptv-org-gr',
  sourceObservations:[
    {sourceFamilyId:'iptv-org-gr',sourceOrigin:'iptv-org Greece'},
    {sourceFamilyId:'free-tv-iptv-gr',sourceOrigin:'Free-TV/IPTV Greece'},
  ],
});
assert.equal(origin,'self-heal:curated-remote-feeds:free-tv-iptv-gr,iptv-org-gr');
assert.deepEqual(parseRefreshOrigin(origin),{
  provider:'curated-remote-feeds',
  familyIds:['free-tv-iptv-gr','iptv-org-gr'],
});
assert.deepEqual(parseRefreshOrigin('curated'),{provider:'curated-remote-feeds',familyIds:[]},'legacy curated rows should fall back to the curated provider without inventing a family');

const ref=candidatePlaybackReference({
  sourceUrl:'https://cdn.example.test/ant1/master.m3u8',
  requiredHeaders:{Referer:'https://antenna.gr/','User-Agent':'Fixture UA',Origin:'https://antenna.gr'},
});
assert.match(ref,/^https:\/\/cdn\.example\.test\/ant1\/master\.m3u8\|/);
assert.match(ref,/Referer=https%3A%2F%2Fantenna\.gr%2F/);
assert.match(ref,/User-Agent=Fixture\+UA/);
assert.match(ref,/Origin=https%3A%2F%2Fantenna\.gr/);

const candidates=[
  {candidateId:'a',sourceUrl:'https://a.test/live.m3u8',discoveryProvider:'curated-remote-feeds',sourceFamilyId:'hitnickgr-iptv',verified:true,verificationStatus:'VERIFIED',streamKind:'live',browserPlayable:true},
  {candidateId:'b',sourceUrl:'https://b.test/live.m3u8',discoveryProvider:'curated-remote-feeds',sourceFamilyId:'iptv-org-gr',verified:true,verificationStatus:'VERIFIED',streamKind:'live',browserPlayable:true,requiredHeaders:{Referer:'https://antenna.gr/'}},
  {candidateId:'c',sourceUrl:'https://c.test/live.m3u8',discoveryProvider:'curated-remote-feeds',sourceFamilyId:'iptv-org-gr',verified:false,verificationStatus:'UNVERIFIED',streamKind:'unknown',browserPlayable:true},
];
const targeted=selectRefreshCandidates(candidates,{provider:'curated-remote-feeds',familyIds:['iptv-org-gr']});
assert.deepEqual(targeted.map(item=>item.candidateId),['b','c'],'targeted refresh must keep only candidates from the saved family before verification filtering');
const fallback=selectRefreshCandidates(candidates,{provider:'curated-remote-feeds',familyIds:[]});
assert.equal(fallback.length,3,'legacy saved source without family provenance may use the bounded provider-wide refresh lane');

assert.equal(selfHealSaveEligibility({candidate:candidates[1],playbackConfirmed:true,existingSavedChannel:true}).enabled,true);
assert.equal(selfHealSaveEligibility({candidate:{...candidates[1],verified:false},playbackConfirmed:true,existingSavedChannel:true}).enabled,false);
assert.equal(selfHealSaveEligibility({candidate:{...candidates[1],drmDetected:true},playbackConfirmed:true,existingSavedChannel:true}).enabled,false);
assert.equal(selfHealSaveEligibility({candidate:candidates[1],playbackConfirmed:false,existingSavedChannel:true}).enabled,false);
assert.equal(selfHealSaveEligibility({candidate:candidates[1],playbackConfirmed:true,existingSavedChannel:false}).enabled,false,'self-heal must never auto-save a new channel');

const playlistManager=fs.readFileSync(new URL('../src/playlist-manager.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
assert.match(playlistManager,/autoRefreshVerifiedSource/,'Playlist Manager must own automatic refresh persistence');
assert.match(playlistManager,/reason!=='playback-self-heal'/,'automatic refresh persistence must be reason-gated');
assert.match(playlistManager,/Self-heal can update only an existing My Playlist channel/,'self-heal must fail closed instead of creating a new channel');
assert.match(playlistManager,/interactiveAuth:false/,'automatic refresh must not silently trigger an interactive auth flow');
assert.match(main,/verifySearchCandidates/,'self-heal must use the canonical verifier client path');
assert.match(main,/testCandidate\(playbackRef/,'self-heal playback proof must delegate to the canonical Player bridge');
assert.match(main,/autoRefreshVerifiedSource/,'only playback-confirmed refresh should reach My Playlist persistence');
assert.match(main,/allowOfficialFallback:false[\s\S]*attemptMyPlaylistSelfHeal[\s\S]*allowOfficialFallback:true/,'self-heal must run between saved-route failure and canonical official fallback');

console.log('My Playlist source self-heal policy PASS');
