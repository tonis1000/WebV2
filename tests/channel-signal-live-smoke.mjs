import assert from 'node:assert/strict';

const base=String(process.env.TV_CACHE_URL||'https://tv-cache.atonis.workers.dev').replace(/\/$/,'');
const candidate='https://mcdn.antennaplus.gr/live/media0/Ant1/HLS/Ant1.m3u8';
const response=await fetch(`${base}/external-health?url=${encodeURIComponent(candidate)}`,{cache:'no-store'});
assert.equal(response.status,200,`Channel Signal live endpoint HTTP ${response.status}`);
const body=await response.json();
assert.equal(body.source,'channel-signal');
assert.equal(body.advisory,true);
assert.ok(['alive','flaky','blocked','unreachable','disputed','dead'].includes(body.state),`unexpected live Channel Signal state: ${body.state}`);
assert.notEqual(body.state,'not-found','known ANT1 Channel Signal URL must remain tracked');
console.log(`Channel Signal live endpoint PASS · ${body.state} · ${body.checkedAt||body.lastSwept||'no-date'}`);
