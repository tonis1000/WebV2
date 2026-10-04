import assert from 'node:assert/strict';
import fs from 'node:fs';
import epgWorker,{analyzeXmltv,requestedChannelTerms,filterXmltv,matchesCosmoteChannel,cosmoteDayRange,cosmoteGuideRange} from '../workers/epg-proxy-gr.js';

const source=fs.readFileSync(new URL('../workers/epg-proxy-gr.js',import.meta.url),'utf8');
for(const required of [
  'www.digea.gr/el/api/epg/get-events',
  'mwapi-prod.cosmotetvott.gr/api/v3.4/epg',
  'ext.greektv.app/epg/epg.xml',
  'epg_ripper_GR1.xml.gz',
  'epg_ripper_DE1.xml.gz',
])assert.ok(source.includes(required),'EPG worker must include source '+required);

const sample='<?xml version="1.0"?><tv><channel id="a"><display-name>ANT1</display-name></channel><channel id="b"><display-name>RTL</display-name></channel><channel id="c"><display-name>ANT1 Cyprus</display-name></channel><programme channel="a" start="20261003120000 +0300" stop="20261003130000 +0300"><title>A</title></programme><programme channel="b" start="20261003120000 +0200" stop="20261003130000 +0200"><title>B</title></programme><programme channel="c" start="20261003120000 +0300" stop="20261003130000 +0300"><title>C</title></programme></tv>';
assert.deepEqual(requestedChannelTerms(new URL('https://x/epg.xml?channels=ant1,ANT1%20HD,rtl')),['ant1','ANT1 HD','rtl']);
const filtered=filterXmltv(sample,['ant1']);
assert.match(filtered,/ANT1/);
assert.doesNotMatch(filtered,/RTL/);
assert.doesNotMatch(filtered,/ANT1 Cyprus/,'ANT1 must not pull sibling/country variants into a scoped request');
assert.equal(analyzeXmltv(filtered).channels,1);
assert.equal(analyzeXmltv(filtered).programmes,1);
assert.equal(matchesCosmoteChannel({title:'COSMOTE Sport 1 HD',callSign:'sport1hd'},['COSMOTE Sport 1']),true);
assert.equal(matchesCosmoteChannel({title:'COSMOTE Sport 1 HD',callSign:'sport1hd'},['cosmotesport1']),true);
assert.equal(matchesCosmoteChannel({title:'COSMOTE Sport 2 HD',callSign:'sport2hd'},['COSMOTE Sport 1']),false);
const day0=cosmoteDayRange(0);assert.ok(day0.to>day0.from);assert.ok(day0.to-day0.from>=86398&&day0.to-day0.from<=86400,'COSMOTE requests must use one-day windows');
const guideRange=cosmoteGuideRange();assert.ok(guideRange.to-guideRange.from>=7*86398,'COSMOTE guide range must cover today plus the next six days');
assert.match(source,/GUIDE_DAY_COUNT=7/,'EPG worker must request a seven-day guide horizon');

const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async request=>{
    const url=String(request instanceof Request?request.url:request);
    if(url.includes('ext.greektv.app'))return new Response(sample,{status:200});
    return new Response('upstream unavailable',{status:503});
  };
  const response=await epgWorker.fetch(new Request('https://epg.test/epg.xml?channels=ANT1'));
  assert.equal(response.status,200,'one healthy source must keep the merged feed alive');
  const xml=await response.text();
  assert.match(xml,/ANT1/);
  assert.doesNotMatch(xml,/RTL/);
}finally{globalThis.fetch=originalFetch;}

console.log('EPG multi-source + sidebar filter contract PASS');
