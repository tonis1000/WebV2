import assert from 'node:assert/strict';
import { EpgService } from '../src/core/epg.js';
import { getChannelProfileById } from '../src/core/channel-profile-gr.js';
import {
  EPG_PHASE_C_BASELINE_COMMIT,
  EPG_PARITY_NOW_ISO,
  EPG_FEED_INDEX_FIXTURE,
  EPG_MY_PLAYLIST_LEGACY_PARITY,
  EPG_PHASE_C_FAILURE_CLOSED,
  EPG_OUTPUT_PARITY,
} from './fixtures/epg-phase-c-parity.mjs';

const SINGLETON_KEY='__webtv_epg_service_singleton__';

const EXPECTED_PROFILE_EPG_ALIASES=new Map([
  ['ert1',['ERT1.gr','ERT1.HD.gr','EPT1.gr','ΕΡΤ1','ERT1 HD']],
  ['ert2',['ERT2.gr','ERT2.HD.gr','EPT2.gr','ΕΡΤ2','ERT2 HD','ERT2 SPOR HD']],
  ['ert3',['ERT3.gr','ERT3.HD.gr','EPT3.gr','ΕΡΤ3','ERT3 HD']],
  ['ertnews',['ERTNEWS.gr','ERT.NEWS.gr','ΕΡΤNEWS','ERT NEWS']],
  ['ant1',['ANT1.gr','ANT1.HD.gr','Antenna1.gr','ANT1 HD']],
  ['alpha',['ALPHA.gr','ALPHA.HD.gr','Alpha.gr','Alpha.HD.gr','alphatv','ALPHA HD']],
  ['skai',['SKAI.gr','SKAI.HD.gr','skaitv','SKAI HD']],
  ['open',['OPEN.gr','OPEN.HD.gr','OPEN.BEYOND.HD.gr','opentv','OPEN TV HD']],
  ['mega',['MEGA.gr','MEGA.HD.gr','MegaChannel.gr','megatv','MEGA HD']],
  ['meganews',['MEGA NEWS','Mega News','MEGA.News.gr','meganews']],
  ['star',['STAR.gr','STAR.HD.gr','startv','STAR HD']],
  ['action24',['ACTION24.gr','ACTION24.HD.gr']],
  ['kontra',['KONTRA.gr','KONTRA.HD.gr']],
  ['madtv',['MADTV','MAD TV','MAD.TV.gr','MAD TV GREECE']],
]);

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

for(const row of EPG_MY_PLAYLIST_LEGACY_PARITY){
  const profile=getChannelProfileById(row.channel.id);
  assert.ok(profile,`${row.channel.id}: Phase C requires a Channel Profile`);
  assert.equal(profile.epg.status,'pending',`${row.channel.id}: EPG availability must remain pending without independent verification`);
  assert.equal(profile.epg.sourceId,null,`${row.channel.id}: pending EPG must not claim a sourceId`);
  assert.equal(profile.epg.preferredId,null,`${row.channel.id}: pending EPG must not claim a preferredId`);
  assert.deepEqual([...profile.epg.aliases],EXPECTED_PROFILE_EPG_ALIASES.get(row.channel.id)||[],`${row.channel.id}: EPG-specific aliases must be owned by Channel Profile`);
}

const now=new Date(EPG_PARITY_NOW_ISO);
assert.ok(!Number.isNaN(now.getTime()),'Phase C parity clock must be deterministic');

// Phase C keeps safe baseline matches but intentionally fixes the documented active collision.
{
  const service=freshService();
  seedResolveIndex(service);
  for(const row of EPG_FEED_INDEX_FIXTURE) service.programs.set(row.id,currentMarker(row.id,now));

  for(const row of EPG_MY_PLAYLIST_LEGACY_PARITY){
    const observed=observedResolvedId(service,row.channel,now);
    const expected=Object.prototype.hasOwnProperty.call(row,'phaseCExpectedResolvedId')?row.phaseCExpectedResolvedId:row.legacyResolvedId;
    assert.equal(observed,expected,`${row.channel.id}: Phase C EPG resolution must preserve safe parity and fix explicit unsafe collisions`);
  }

  const unsafe=EPG_MY_PLAYLIST_LEGACY_PARITY.filter(row=>row.unsafeLegacy);
  assert.equal(unsafe.length,1,'The baseline must explicitly isolate the active My Playlist unsafe collision');
  assert.equal(unsafe[0].channel.id,'meganews');
  assert.equal(unsafe[0].legacyResolvedId,'MEGA.gr');
  assert.equal(unsafe[0].phaseCExpectedResolvedId,'MEGA.News.gr');
}

// Phase C must fail closed on sibling/family false positives instead of borrowing a guide.
{
  const service=freshService();
  seedResolveIndex(service);
  for(const row of EPG_FEED_INDEX_FIXTURE) service.programs.set(row.id,currentMarker(row.id,now));

  for(const row of EPG_PHASE_C_FAILURE_CLOSED){
    const observed=observedResolvedId(service,row.channel,now);
    assert.equal(observed,row.phaseCExpectedResolvedId,`${row.channel.id}: ${row.reason}`);
    assert.ok(String(row.reason||'').trim(),`${row.channel.id}: fail-closed case requires a reason`);
  }
}

// Programme output semantics stay independent from identity ownership.
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

{
  const service=freshService();
  seedResolveIndex(service);
  const result=service.get({id:'totally-unknown',originalId:'TOTALLY.UNKNOWN',name:'Totally Unknown'},now);
  assert.equal(result.current,null);
  assert.deepEqual(result.next,[]);
}

console.log('EPG Phase C shared-identity/profile parity + fail-closed contract verified.');
