import assert from 'node:assert/strict';
import { UnifiedSearchState } from '../src/search/search-state.js';

const state = new UnifiedSearchState();

const first = state.beginSearch({ query:'ERT', intent:{ type:'group', query:'ERT', targets:[] } });
assert.equal(first.query, 'ERT');
assert.equal(first.status, 'running');
assert.equal(first.playingChannel, undefined, 'search state must not own playback state');

state.setLaneStatus(first.searchId, 'm3u', 'running');
state.mergeLaneResult(first.searchId, 'm3u', {
  candidates:[{ candidateId:'a', channelName:'ERT1', sourceUrl:'https://example.test/ert1.m3u8' }],
  leads:[],
  reports:[],
});
let snapshot = state.snapshot();
assert.equal(snapshot.candidates.length, 1);
assert.equal(snapshot.lanes.m3u.status, 'running');

state.mergeLaneResult(first.searchId, 'enigma2', {
  candidates:[{ candidateId:'b', channelName:'ERT2', sourceUrl:'https://example.test/ert2.m3u8' }],
  leads:[],
  reports:[],
});
snapshot = state.snapshot();
assert.deepEqual(snapshot.candidates.map(item => item.candidateId), ['a','b'], 'lane batches must merge progressively');

const second = state.beginSearch({ query:'MEGA', intent:{ type:'channel', query:'MEGA', targets:[] } });
assert.notEqual(second.searchId, first.searchId, 'new search must receive a new token/id');
assert.equal(state.snapshot().query, 'MEGA');
assert.deepEqual(state.snapshot().candidates, [], 'new search starts with a clean candidate set');

const accepted = state.mergeLaneResult(first.searchId, 'late-old-lane', {
  candidates:[{ candidateId:'stale', channelName:'ERT3', sourceUrl:'https://example.test/stale.m3u8' }],
});
assert.equal(accepted, false, 'late results from superseded searches must be ignored');
assert.deepEqual(state.snapshot().candidates, []);

assert.equal(state.cancelSearch(second.searchId, 'user'), true);
assert.equal(state.snapshot().status, 'cancelled');
assert.equal(state.snapshot().cancelReason, 'user');

const frozen = state.snapshot();
assert.throws(() => { frozen.query = 'mutated'; }, TypeError, 'snapshots must be immutable');

console.log('unified search state contract PASS');
