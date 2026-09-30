import assert from 'node:assert/strict';
import { EpgService } from '../src/core/epg.js';
import {
  EPG_PHASE_C_BASELINE_COMMIT,
  EPG_PARITY_NOW_ISO,
  EPG_FEED_INDEX_FIXTURE,
  EPG_MY_PLAYLIST_LEGACY_PARITY,
  EPG_PHASE_C_FAILURE_CLOSED,
  EPG_OUTPUT_PARITY,
} from './fixtures/epg-phase-c-parity.mjs';

const SINGLETON_KEY='__webtv_epg_service_singleton__';

function freshService(){
  delete globalThis[SINGLETON_KEY];
  const service=new EpgService();
  service.programs.clear();
  service.resolveIndex.clear();
  service.programKeyIndex.clear();
  return service;
}

function seedResolveIndex(service){
  for(const row of EPG_FEED_INDEX_FIXTURE){
    for(const key of row.keys) service.resolveIndex.set(key,row.id);
  }
}

function currentMarker(resolvedId,now){
  return [{
    start:new Date(now.getTime()-30*60*1000),
    stop:new Date(now.getTime()+30*60*1000),
    title:`resolved:${resolvedId}`,
    description:'',
  }];
}

function observedResolvedId(service,channel,now){
  const result=service.get(channel,now);
  const title=result.current?.title||'';
  return title.startsWith('resolved:')?title.slice('resolved:'.length):null;
}

assert.match(EPG_PHASE_C_BASELINE_COMMIT,/^[0-9a-f]{40}$/,'Phase C parity fixture must name the exact baseline commit');
assert.equal(EPG_MY_PLAYLIST_LEGACY_PARITY.length,24,'Phase C parity must cover all 24 My Playlist identities');
assert.equal(new Set(EPG_MY_PLAYLIST_LEGACY_PARITY.map(row=>row.channel.id)).size,24,'Phase C parity identities must be unique');
assert.ok(EPG_PHASE_C_FAILURE_CLOSED.length>=4,'Phase C must define explicit fail-closed cases before migration');

const now=new Date(EPG_PARITY_NOW_ISO);
assert.ok(!Number.isNaN(now.getTime()),'Phase C parity clock must be deterministic');

// Freeze the observable legacy resolver baseline without parsing/fetching XMLTV.
// The service indexes are public runtime state; seeding them exercises the real private resolver.
{
  const service=freshService();
  seedResolveIndex(service);
  for(const row of EPG_FEED_INDEX_FIXTURE) service.programs.set(row.id,currentMarker(row.id,now));

  for(const row of EPG_MY_PLAYLIST_LEGACY_PARITY){
    const observed=observedResolvedId(service,row.channel,now);
    assert.equal(observed,row.legacyResolvedId,`${row.channel.id}: legacy EPG resolution changed before Phase C migration`);
  }

  const unsafe=EPG_MY_PLAYLIST_LEGACY_PARITY.filter(row=>row.unsafeLegacy);
  assert.equal(unsafe.length,1,'The baseline must explicitly isolate the active My Playlist unsafe collision');
  assert.equal(unsafe[0].channel.id,'meganews');
  assert.equal(unsafe[0].legacyResolvedId,'MEGA.gr');
  assert.equal(unsafe[0].phaseCExpectedResolvedId,'MEGA.News.gr');
}

// Record known sibling false positives separately. These are observations of the legacy matcher,
// plus the Phase C target contract; the target is enforced only in the separate migration change.
{
  const service=freshService();
  seedResolveIndex(service);
  for(const row of EPG_FEED_INDEX_FIXTURE) service.programs.set(row.id,currentMarker(row.id,now));

  for(const row of EPG_PHASE_C_FAILURE_CLOSED){
    const observed=observedResolvedId(service,row.channel,now);
    assert.equal(observed,row.legacyResolvedId,`${row.channel.id}: documented legacy safety observation changed`);
    assert.ok(Object.prototype.hasOwnProperty.call(row,'phaseCExpectedResolvedId'),`${row.channel.id}: Phase C target resolution must be explicit`);
    assert.ok(String(row.reason||'').trim(),`${row.channel.id}: fail-closed case requires a reason`);
  }
}

// Lock current programme output semantics independently from identity ownership.
{
  const service=freshService();
  seedResolveIndex(service);
  service.programs.set(EPG_OUTPUT_PARITY.resolvedId,EPG_OUTPUT_PARITY.programmes.map(item=>({
    ...item,
    start:new Date(item.start),
    stop:new Date(item.stop),
  })));

  const result=service.get(EPG_OUTPUT_PARITY.channel,new Date(EPG_OUTPUT_PARITY.now));
  assert.equal(result.current?.title,EPG_OUTPUT_PARITY.expected.currentTitle,'current programme selection must remain stable');
  assert.equal(result.current?.description,EPG_OUTPUT_PARITY.expected.currentDescription,'current programme description must remain stable');
  assert.equal(result.current?.progress,EPG_OUTPUT_PARITY.expected.progress,'current progress calculation must remain stable');
  assert.deepEqual(result.next.map(item=>item.title),EPG_OUTPUT_PARITY.expected.nextTitles,'next programme ordering/limit must remain stable');
  assert.ok(String(result.current?.timeLabel||'').includes('–'),'current programme must keep a human-readable time range');
}

// Current resolver already fails closed for a truly unknown identity; Phase C must preserve that.
{
  const service=freshService();
  seedResolveIndex(service);
  const result=service.get({id:'totally-unknown',originalId:'TOTALLY.UNKNOWN',name:'Totally Unknown'},now);
  assert.equal(result.current,null);
  assert.deepEqual(result.next,[]);
}

console.log('EPG Phase C legacy parity + fail-closed contract captured.');
