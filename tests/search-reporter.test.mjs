import assert from 'node:assert/strict';
import { createSearchReporter } from '../src/search/search-reporter.js';

const reporter=createSearchReporter({searchId:'search_42',maxEvents:5});
reporter.emit({type:'search.started',severity:'INFO',message:'ERT search started'});
reporter.emit({type:'lane.started',severity:'INFO',laneId:'github',sourceId:'github-search',sourceLabel:'GitHub'});
reporter.emit({type:'candidate.found',severity:'OK',laneId:'github',sourceId:'github-search',sourceLabel:'GitHub',candidateId:'c1',channelName:'ERT1',detail:{sourceUrl:'https://stream.test/ert1.m3u8'}});
reporter.emit({type:'verification.completed',severity:'OK',candidateId:'c1',channelName:'ERT1',detail:{status:'VERIFIED'}});
reporter.emit({type:'lane.timeout',severity:'TIMEOUT',laneId:'web',sourceId:'web-search',sourceLabel:'Recent Web',message:'timeout'});

const firstSnapshot=reporter.snapshot();
assert.equal(firstSnapshot.length,5);
assert.equal(firstSnapshot[0].type,'search.started');
assert.ok(firstSnapshot.every((event,index)=>index===0 || event.at>=firstSnapshot[index-1].at),'events must be chronological');
assert.throws(()=>{firstSnapshot[0].message='mutated';},TypeError,'events must be immutable');

const summary=reporter.summary();
assert.equal(summary.timeouts,1);
assert.equal(summary.candidates,1);
assert.equal(summary.verified,1);
assert.equal(summary.warnings,0);
assert.equal(summary.status,'running');

assert.deepEqual(reporter.filterBySource('github-search').map(event=>event.type),['lane.started','candidate.found']);
assert.deepEqual(reporter.filterByCandidate('c1').map(event=>event.type),['candidate.found','verification.completed']);

reporter.emit({type:'lane.failed',severity:'ERROR',laneId:'forum',sourceId:'forum',message:'HTTP 403'});
assert.equal(reporter.snapshot().length,5,'event retention must be bounded');
assert.equal(reporter.snapshot()[0].type,'lane.started','oldest event should be evicted when maxEvents is exceeded');
assert.equal(reporter.summary().failed,1);

const secrets=createSearchReporter({searchId:'secret-test'});
secrets.emit({
  type:'source.failed',severity:'ERROR',sourceId:'xtream',sourceLabel:'Living Room',message:'bad login',
  detail:{
    url:'https://user:secret@example.test/player_api.php?username=user&password=secret&token=abc',
    username:'user',password:'secret',Authorization:'Bearer abc',Cookie:'sid=123',apiKey:'key123',safe:'kept',
    nested:{access_token:'xyz',note:'visible'},
  },
});
const redacted=secrets.snapshot()[0];
const serialized=JSON.stringify(redacted);
for(const forbidden of ['secret','Bearer abc','sid=123','key123','xyz'])assert.equal(serialized.includes(forbidden),false,`report must redact ${forbidden}`);
assert.equal(redacted.detail.safe,'kept');
assert.equal(redacted.detail.nested.note,'visible');
assert.match(redacted.detail.url,/\[redacted\]/i);

const text=secrets.exportText();
const json=secrets.exportJson();
for(const exported of [text,json]){
  assert.equal(exported.includes('secret'),false,'exports must use redacted snapshot only');
  assert.equal(exported.includes('Bearer abc'),false);
  assert.equal(exported.includes('sid=123'),false);
}
assert.deepEqual(JSON.parse(json),secrets.snapshot());

secrets.emit({type:'search.cancelled',severity:'WARN',message:'superseded'});
assert.equal(secrets.summary().status,'cancelled');
assert.equal(secrets.summary().warnings,1);

const complete=createSearchReporter({searchId:'done'});
complete.emit({type:'search.started',severity:'INFO'});
complete.emit({type:'search.completed',severity:'OK'});
assert.equal(complete.summary().status,'completed');

console.log('unified search reporter contract PASS');
