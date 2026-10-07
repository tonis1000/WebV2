import assert from 'node:assert/strict';
import {
  IPTV_NEXUS_BASE_URL,
  nexusCountryCodeFor,
  selectNexusChannel,
  nexusStreamCandidates,
} from '../workers/source-discovery/iptv-nexus-intelligence.js';

const greekShard=[
  {
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
      health:{
        status:'blocked',
        score:35,
        uptime:0,
        checked_at:'2026-10-07T09:30:19.569Z',
        last_online:null,
        latency_ms:2618,
        media:null,
      },
    }],
  },
  {
    id:'ANT1Europe.gr',
    name:'ANT1 Europe',
    alt_names:[],
    country:'GR',
    score:0,
    online:false,
    streams:[],
  },
];

assert.equal(IPTV_NEXUS_BASE_URL,'https://dearbulut.github.io/iptv');
assert.equal(nexusCountryCodeFor({name:'ANT1',tvgId:'ANT1.gr'},{}),'gr');
assert.equal(nexusCountryCodeFor({name:'ANT1'}, {strategy:'greece-curated'}),'gr');
assert.equal(nexusCountryCodeFor({name:'CNN',tvgId:'CNN.us'}, {strategy:'iptv-org-country',countryCode:'us'}),'us');

const exact=selectNexusChannel(greekShard,{name:'ANT1',id:'ant1',originalId:'ANT1'});
assert.equal(exact?.id,'ANT1.gr','exact normalized channel name should match ANT1, not ANT1 Europe');

const exactId=selectNexusChannel(greekShard,{name:'Whatever',tvgId:'ANT1.gr'});
assert.equal(exactId?.id,'ANT1.gr','exact tvgId must be strongest Nexus identity');

const ambiguous=selectNexusChannel([
  {id:'ART.gr',name:'ART',alt_names:[],streams:[]},
  {id:'ARTTV.gr',name:'ART TV',alt_names:[],streams:[]},
],{name:'ART TV'});
assert.equal(ambiguous?.id,'ARTTV.gr','matching must not collapse sibling channel identities');

const candidates=nexusStreamCandidates(exact,{channelName:'ANT1',sourceFamilyId:'iptv-nexus-gr',sourceOriginUrl:'https://dearbulut.github.io/iptv/api/v1/by-country/gr.json'});
assert.equal(candidates.length,1);
assert.equal(candidates[0].sourceFamilyId,'iptv-nexus-gr');
assert.equal(candidates[0].inputFormatId,'iptv-nexus-json');
assert.deepEqual(candidates[0].requiredHeaders,{'User-Agent':'Chrome',Referer:'http://watch.antennaplus.gr'});
assert.equal(candidates[0].sourceIntelligence.provider,'iptv-nexus');
assert.equal(candidates[0].sourceIntelligence.healthStatus,'blocked');
assert.equal(candidates[0].sourceIntelligence.healthScore,35);
assert.equal(candidates[0].sourceIntelligence.uptime,0);
assert.equal(candidates[0].sourceIntelligence.latencyMs,2618);
assert.equal(candidates[0].sourceIntelligence.quality,'1080p');
assert.equal(candidates[0].sourceIntelligence.rank,44.81);
assert.deepEqual(candidates[0].sourceIntelligence.sources,['iptv-org']);
assert.deepEqual(candidates[0].sourceObservations[0].requiredHeaderNames,['User-Agent','Referer']);

console.log('IPTV Nexus intelligence selection PASS');
