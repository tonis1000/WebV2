import fs from 'node:fs';
import assert from 'node:assert/strict';
import epgWorker from '../workers/epg-proxy-gr.js';

const workflow=fs.readFileSync('.github/workflows/deploy-epg-proxy-gr.yml','utf8');

assert.match(workflow,/\$WORKER_URL\/epg\.xml\?[^\"\n]*channels=[^\"\n]*verify=/,'EPG deploy verification must request the real scoped /epg.xml feed');
assert.match(workflow,/\$WORKER_URL\/status\?[^\"\n]*channels=[^\"\n]*verify=/,'EPG deploy verification must request the scoped /status diagnostic');
assert.match(workflow,/--max-time\s+\d+/,'EPG feed verification must have a bounded curl timeout');
assert.match(workflow,/<tv/,'EPG deploy verification must require an XMLTV <tv> root');
assert.match(workflow,/<channel/,'EPG deploy verification must require at least one channel');
assert.match(workflow,/<programme/,'EPG deploy verification must require at least one programme');
assert.doesNotMatch(workflow,/grep -q 'Use \/epg or \/epg\.xml'/,'root banner alone must not prove EPG deployment');
for(const required of ['cosmotesport1','novasports1','DasErste.de','epgshare-gr','epgshare-de','cosmote'])assert.ok(workflow.includes(required),'EPG deploy source matrix must include '+required);

const sample='<?xml version="1.0"?><tv><channel id="a"></channel><channel id="b"></channel><programme channel="a"></programme><programme channel="b"></programme></tv>';
const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async()=>new Response(sample,{status:200,headers:{'content-type':'application/xml'}});
  const statusResponse=await epgWorker.fetch(new Request('https://epg.test/status'));
  assert.equal(statusResponse.status,200);
  const status=await statusResponse.json();
  assert.equal(status.ok,true);
  assert.equal(status.valid,true);
  assert.equal(status.service,'WebTV EPG Proxy');
  assert.equal(status.version,'multi-v4');
  assert.equal(status.channels,2);
  assert.equal(status.programmes,2);
  assert.ok(status.bytes>=sample.length);
  assert.equal(status.source,'multi');
  assert.ok(Array.isArray(status.sourcesConfigured)&&status.sourcesConfigured.length>=5);

  const feedResponse=await epgWorker.fetch(new Request('https://epg.test/epg.xml'));
  assert.equal(feedResponse.status,200);
  assert.match(await feedResponse.text(),/<programme/);

  globalThis.fetch=async()=>new Response('<html>not xmltv</html>',{status:200});
  const invalidStatus=await epgWorker.fetch(new Request('https://epg.test/status'));
  assert.equal(invalidStatus.status,502);
  const invalid=await invalidStatus.json();
  assert.equal(invalid.ok,false);
  assert.equal(invalid.valid,false);
}finally{
  globalThis.fetch=originalFetch;
}

console.log('EPG deploy + status diagnostic contract verified.');
