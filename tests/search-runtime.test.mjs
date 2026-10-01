import assert from 'node:assert/strict';
import { listUnifiedSearchLanes, getUnifiedSearchRuntimeAdapter } from '../src/search/search-runtime.js';

const lanes=listUnifiedSearchLanes();
assert.deepEqual(lanes.map(item=>item.id),[
  'curated-remote-feeds',
  'github-public-playlists',
  'recent-web-search',
  'strm-specific-discovery',
  'authorized-xtream',
  'hunt-exploration',
]);
assert.equal(lanes.some(item=>/official/i.test(`${item.id} ${item.provider||''}`)),false,'Official lanes are excluded from unified runtime');
assert.equal(lanes.filter(item=>item.provider==='curated-remote-feeds').length,1,'curated catalog must execute as one lane, not once per concrete feed');
assert.ok(lanes.every(item=>item.enabled===true));
assert.equal(typeof getUnifiedSearchRuntimeAdapter('discovery-provider').search,'function');
assert.equal(typeof getUnifiedSearchRuntimeAdapter('hunt-exploration').search,'function');
assert.throws(()=>getUnifiedSearchRuntimeAdapter('m3u'),/runtime adapter/i,'concrete catalog formats are not direct browser execution lanes');

console.log('unified search runtime lane contract PASS');
