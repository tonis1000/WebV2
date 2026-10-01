import assert from 'node:assert/strict';
import { UnifiedSearchState } from '../src/search/search-state.js';

const state=new UnifiedSearchState();
const run=state.beginSearch({query:'ERT1',intent:{type:'channel',query:'ERT1',targets:[]}});
assert.equal(state.completeSearch(run.searchId),true);
const completed=state.snapshot();
assert.equal(completed.status,'completed');
assert.equal(completed.cancelReason,'');
assert.ok(completed.completedAt);
assert.equal(state.cancelSearch(run.searchId,'late-cancel'),false,'completed run cannot be cancelled afterwards');
assert.equal(state.completeSearch('stale-search'),false,'stale search cannot complete the active state');

console.log('unified search state completion contract PASS');
