import assert from 'node:assert/strict';
import { registerSearchAdapter, getSearchAdapter } from '../src/search/adapter-registry.js';

const adapter = {
  async search({ target, source, signal }) {
    return { candidates:[], leads:[], reports:[{ target, source, aborted:Boolean(signal?.aborted) }] };
  },
};

assert.throws(() => getSearchAdapter('missing-adapter'), /not registered/i, 'missing adapters must fail explicitly');
assert.equal(registerSearchAdapter('test-format', adapter), adapter);
assert.equal(getSearchAdapter('test-format'), adapter);
assert.throws(() => registerSearchAdapter('test-format', adapter), /already registered/i, 'duplicate adapter ownership must be rejected');
assert.throws(() => registerSearchAdapter('', adapter), /type/i);
assert.throws(() => registerSearchAdapter('broken-format', {}), /search/i);

const result = await getSearchAdapter('test-format').search({ target:{ name:'ERT1' }, source:{ id:'fixture' }, signal:new AbortController().signal });
assert.deepEqual(result.candidates, []);
assert.deepEqual(result.leads, []);
assert.equal(result.reports.length, 1);

console.log('unified search adapter contract PASS');
