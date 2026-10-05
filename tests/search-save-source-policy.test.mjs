import assert from 'node:assert/strict';
import { saveSourceEligibility, bestSourceSaveEligibility } from '../src/search/save-source-policy.js';

const selected={id:'mega',originalId:'MEGA.gr',name:'MEGA'};
const verified={candidateId:'cand_mega',channelName:'MEGA',normalizedChannelName:'mega',sourceType:'hls',discoveryProvider:'recent-web-search',verified:true,verificationStatus:'VERIFIED',streamKind:'live'};

assert.equal(saveSourceEligibility({candidate:verified,channelName:'MEGA',selectedChannel:selected,playbackConfirmed:false}).enabled,false,'verified source must not save before playback confirmation');
assert.equal(saveSourceEligibility({candidate:{...verified,verified:false},channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true}).enabled,false,'verificationStatus VERIFIED without canonical verified=true proof must not save');
assert.equal(saveSourceEligibility({candidate:{...verified,verificationStatus:'UNVERIFIED',verified:false},channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true}).enabled,false,'playback alone must not bypass verifier gate');
assert.equal(saveSourceEligibility({candidate:verified,channelName:'MEGA',selectedChannel:{name:'SKAI'},playbackConfirmed:true}).enabled,false,'candidate must not save into a different selected sidebar channel');

const eligible=saveSourceEligibility({candidate:verified,channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true});
assert.equal(eligible.enabled,true,'verified + playback-confirmed + matching selected channel must be saveable');
assert.equal(eligible.label,'Save source');

const vod=saveSourceEligibility({candidate:{...verified,streamKind:'vod'},channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true});
assert.equal(vod.enabled,false,'verified VOD must not be saveable as a live channel source');
assert.match(vod.title,/on-demand|live/i);

const unknownKind=saveSourceEligibility({candidate:{...verified,streamKind:'unknown'},channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true});
assert.equal(unknownKind.enabled,false,'unknown live/VOD semantics must not be promoted into a linear channel');

const directVideo=saveSourceEligibility({candidate:{...verified,sourceType:'direct',resolvedMediaFormatId:'direct-video',streamKind:'vod'},channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true});
assert.equal(directVideo.enabled,false,'playable MP4/direct-video must not be saveable as a live channel source');

const xtream=saveSourceEligibility({candidate:{...verified,sourceType:'xtream',xtreamContext:{accountRef:'acct'}},channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true});
assert.equal(xtream.enabled,false,'generic save must reject Xtream candidates');
assert.match(xtream.label,/Xtream Preview/);

const saved=saveSourceEligibility({candidate:verified,channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true,alreadySaved:true});
assert.equal(saved.enabled,false);
assert.equal(saved.label,'Saved ✓');

const bestBlocked=bestSourceSaveEligibility({candidate:verified,playbackConfirmed:false});
assert.equal(bestBlocked.enabled,false,'Best Source must require real playback confirmation');
const bestFalseProof=bestSourceSaveEligibility({candidate:{...verified,verified:false,browserPlayable:true},playbackConfirmed:true});
assert.equal(bestFalseProof.enabled,false,'Best Source must require canonical verified=true proof, not only a VERIFIED status label');
const bestEligible=bestSourceSaveEligibility({candidate:{...verified,browserPlayable:true},playbackConfirmed:true});
assert.equal(bestEligible.enabled,true,'verified live browser-playable playback-confirmed candidate should be usable as Best Source');
const bestDrm=bestSourceSaveEligibility({candidate:{...verified,browserPlayable:true,drmDetected:true},playbackConfirmed:true});
assert.equal(bestDrm.enabled,false,'DRM candidate must never use generic Best Source persistence');

console.log('Unified Search Save source policy PASS');
