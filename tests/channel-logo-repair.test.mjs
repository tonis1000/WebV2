import assert from 'node:assert/strict';
import {
  normalizeLogoMatchKey,
  scoreLogoCandidate,
  piconCandidateUrls,
  lookupChannelLogo,
} from '../workers/channel-logo-repair.js';

assert.equal(normalizeLogoMatchKey('  Crete TV HD  '),'crete tv');
assert.ok(scoreLogoCandidate('crete tv','crete-tv') > 0.9);
assert.ok(scoreLogoCandidate('ert 1','ert1') > 0.8);
assert.ok(scoreLogoCandidate('alpha tv','alphacyp') < 0.7,'different channel variants must not fuzzy-match aggressively');

const picons=piconCandidateUrls({id:'ert1',name:'ERT1 HD'});
assert.ok(picons.some(url=>url.includes('/ert1.default.svg')));
assert.ok(picons.length<=8,'picons fallback must stay bounded');

function response(body,{status=200,headers={'content-type':'text/plain'}}={}){
  return new Response(body,{status,headers});
}

// tv-logo should win first and be curated, not verified.
{
  const calls=[];
  const fetchImpl=async url=>{
    calls.push(String(url));
    if(String(url).includes('tv-logo/tv-logos')&&String(url).endsWith('0_all_logos_mosaic.md')){
      return response('[crete-tv]:crete-tv-gr.png\n[ert1]:ert1-gr.png\n');
    }
    return response('',{status:404});
  };
  const result=await lookupChannelLogo({id:'crete-tv',name:'Crete TV',country:'GR'},{fetchImpl});
  assert.equal(result.found,true);
  assert.equal(result.provider,'tv-logo');
  assert.equal(result.sourceKind,'curated-third-party');
  assert.match(result.url,/countries\/greece\/crete-tv-gr\.png$/);
  assert.equal(calls.length,1,'first strong provider match should stop the lookup chain');
}

// picons must be a bounded fallback without downloading its huge recursive tree.
{
  const fetchImpl=async url=>{
    const value=String(url);
    if(value.includes('0_all_logos_mosaic.md'))return response('',{status:404});
    if(value.endsWith('/ert1.default.svg'))return response('<svg/>',{headers:{'content-type':'image/svg+xml'}});
    return response('',{status:404});
  };
  const result=await lookupChannelLogo({id:'ert1',name:'ERT1',country:'GR'},{fetchImpl});
  assert.equal(result.provider,'picons');
  assert.match(result.url,/ert1\.default\.svg$/);
}

// iptv-org may use an exact tvg-id after earlier providers miss.
{
  const logos=JSON.stringify([
    {channel:'ERT1.gr',feed:null,url:'https://cdn.example.test/ert1.png',in_use:true},
    {channel:'ERT2.gr',feed:null,url:'https://cdn.example.test/ert2.png',in_use:true},
  ]);
  const fetchImpl=async url=>{
    const value=String(url);
    if(value.includes('0_all_logos_mosaic.md'))return response('',{status:404});
    if(value.includes('raw.githubusercontent.com/picons/'))return response('',{status:404});
    if(value.includes('iptv-org.github.io/api/logos.json'))return response(logos,{headers:{'content-type':'application/json'}});
    return response('',{status:404});
  };
  const result=await lookupChannelLogo({id:'ert1',name:'ERT1',tvgId:'ERT1.gr',country:'GR'},{fetchImpl});
  assert.equal(result.provider,'iptv-org');
  assert.equal(result.url,'https://cdn.example.test/ert1.png');
}

// grtv is Greece-only last fallback and must preserve untrusted community provenance as curated.
{
  const m3u='#EXTM3U\n#EXTINF:-1 tvg-name="EPIRUS TV1" tvg-logo="https://i.imgur.com/6PovX6q.png",EPIRUS TV1\nhttps://example.test/live.m3u8\n';
  const fetchImpl=async url=>{
    const value=String(url);
    if(value.includes('0_all_logos_mosaic.md'))return response('',{status:404});
    if(value.includes('raw.githubusercontent.com/picons/'))return response('',{status:404});
    if(value.includes('iptv-org.github.io/api/logos.json'))return response('[]',{headers:{'content-type':'application/json'}});
    if(value.includes('jimgate07/grtv'))return response(m3u);
    return response('',{status:404});
  };
  const result=await lookupChannelLogo({id:'epirus-tv1',name:'EPIRUS TV1',country:'GR'},{fetchImpl});
  assert.equal(result.provider,'grtv');
  assert.equal(result.url,'https://i.imgur.com/6PovX6q.png');
  assert.equal(result.trust,'curated');
}

console.log('channel logo repair provider contract PASS');
