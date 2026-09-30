import assert from 'node:assert/strict';
import { CURATED_SOURCE_FEEDS } from '../src/search/curated-source-catalog.js';
import { listSearchSources } from '../src/search/source-registry.js';
import { FEEDS } from '../workers/webtv-source-discovery.js';

assert.ok(CURATED_SOURCE_FEEDS.length>=10,'shared curated source catalog must own the current feed set');
assert.deepEqual(FEEDS,CURATED_SOURCE_FEEDS,'Discovery Worker must consume the same canonical curated source catalog');

const registry=listSearchSources();
for(const feed of CURATED_SOURCE_FEEDS){
  const row=registry.find(item=>item.id===feed.id);
  assert.ok(row,`Unified Search registry must expose curated source ${feed.id}`);
  assert.equal(row.type,feed.format);
  assert.equal(row.location,feed.url);
  assert.equal(row.enabled,feed.enabled!==false);
}

assert.ok(registry.some(item=>item.type==='strm'),'non-curated STRM lane must remain registered');
assert.ok(registry.some(item=>item.type==='xtream'),'authorized Xtream lane must remain registered');
assert.equal(registry.some(item=>/official/i.test(item.id)||/official/i.test(item.label)),false,'Official sources remain outside Unified Search registry');

console.log('single-owner curated source addition ergonomics PASS');
