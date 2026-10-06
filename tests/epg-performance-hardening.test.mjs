import assert from 'node:assert/strict';
import fs from 'node:fs';

const workerSource=fs.readFileSync(new URL('../workers/epg-proxy-gr.js',import.meta.url),'utf8');
const epgSource=fs.readFileSync(new URL('../src/core/epg.js',import.meta.url),'utf8');
const indexSource=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const guideSource=fs.readFileSync(new URL('../src/epg-guide.js',import.meta.url),'utf8');

assert.match(workerSource,/\/now-next\.json/,'EPG Worker must expose a compact now-next JSON endpoint');
assert.match(workerSource,/buildNowNextPayload/,'EPG Worker must build a compact current + next payload');
assert.match(workerSource,/planRequestedSources/,'EPG Worker must route requested channels to bounded provider lanes');
assert.match(workerSource,/caches\.default|cache\.match/,'EPG Worker should use edge response caching when available');

assert.match(epgSource,/now-next\.json/,'Viewer EPG refresh must use the compact now-next endpoint');
assert.match(epgSource,/refreshGuide/,'Full XMLTV guide refresh must be a separate explicit path');

assert.doesNotMatch(indexSource,/href="\.\/epg-guide\.css[^"]*"/,'EPG Guide CSS must not load in the locked viewer startup path');
assert.doesNotMatch(indexSource,/src="\.\/src\/epg-guide\.js[^"]*"/,'EPG Guide module must not load in the locked viewer startup path');
assert.match(indexSource,/src="\.\/src\/epg-guide-loader\.js[^"]*"/,'Locked viewer should load only the lightweight EPG Guide loader');

assert.match(guideSource,/updateNowPresentation/,'Open Guide should update NOW presentation without rebuilding the whole grid');
assert.doesNotMatch(guideSource,/setInterval\(\(\)=>\{if\(!\$\('epg-guide-overlay'\)\?\.hidden&&dayOffset===0\)renderGuide\(\);\},60000\)/,'Minute timer must not rebuild the complete Guide DOM');

const mod=await import('../workers/epg-proxy-gr.js');
assert.equal(typeof mod.buildNowNextPayload,'function','Worker must export buildNowNextPayload for regression coverage');

const now=Date.UTC(2026,9,6,10,30,0);
const xml=`<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="demo"><display-name>Demo TV</display-name></channel>
  <programme channel="demo" start="20261006100000 +0000" stop="20261006110000 +0000"><title>Current</title></programme>
  <programme channel="demo" start="20261006110000 +0000" stop="20261006113000 +0000"><title>Next 1</title></programme>
  <programme channel="demo" start="20261006113000 +0000" stop="20261006120000 +0000"><title>Next 2</title></programme>
  <programme channel="demo" start="20261006120000 +0000" stop="20261006123000 +0000"><title>Next 3</title></programme>
  <programme channel="demo" start="20261006123000 +0000" stop="20261006130000 +0000"><title>Next 4</title></programme>
</tv>`;

const payload=mod.buildNowNextPayload(xml,{nowMs:now,maxNext:3});
assert.equal(payload.channels.length,1);
assert.equal(payload.channels[0].current.title,'Current');
assert.deepEqual(payload.channels[0].next.map(x=>x.title),['Next 1','Next 2','Next 3']);
assert.equal(payload.programmes,4,'compact viewer payload must cap each matched channel at current + next 3');

console.log('EPG performance hardening regression passed');
