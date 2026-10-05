import assert from 'node:assert/strict';
import { saveSourceEligibility } from '../src/search/save-source-policy.js';

const selected={id:'mega',originalId:'MEGA.gr',name:'MEGA'};
const verified={candidateId:'cand_mega',channelName:'MEGA',normalizedChannelName:'mega',sourceType:'hls',discoveryProvider:'recent-web-search',verificationStatus:'VERIFIED'};

assert.equal(saveSourceEligibility({candidate:verified,channelName:'MEGA',selectedChannel:selected,playbackConfirmed:false}).enabled,false,'verified source must not save before playback confirmation');
assert.equal(saveSourceEligibility({candidate:{...verified,verificationStatus:'UNVERIFIED'},channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true}).enabled,false,'playback alone must not bypass verifier gate');
assert.equal(saveSourceEligibility({candidate:verified,channelName:'MEGA',selectedChannel:{name:'SKAI'},playbackConfirmed:true}).enabled,false,'candidate must not save into a different selected sidebar channel');

const eligible=saveSourceEligibility({candidate:verified,channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true});
assert.equal(eligible.enabled,true,'verified + playback-confirmed + matching selected channel must be saveable');
assert.equal(eligible.label,'Save source');

const xtream=saveSourceEligibility({candidate:{...verified,sourceType:'xtream',xtreamContext:{accountRef:'acct'}},channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true});
assert.equal(xtream.enabled,false,'generic save must reject Xtream candidates');
assert.match(xtream.label,/Xtream Preview/);

const saved=saveSourceEligibility({candidate:verified,channelName:'MEGA',selectedChannel:selected,playbackConfirmed:true,alreadySaved:true});
assert.equal(saved.enabled,false);
assert.equal(saved.label,'Saved ✓');

console.log('Unified Search Save source policy PASS');
