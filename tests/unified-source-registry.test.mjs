import assert from 'node:assert/strict';
import { listSearchSources, getSearchSource } from '../src/search/source-registry.js';

const sources = listSearchSources();
assert.ok(Array.isArray(sources) && sources.length >= 4, 'registry should expose structured search sources');

const byType = type => sources.filter(item => item.type === type);
assert.ok(byType('m3u').length >= 1, 'at least one M3U source must be registered');
assert.ok(byType('enigma2').length >= 1, 'at least one Enigma2 source must be registered');
assert.ok(byType('strm').length >= 1, 'STRM discovery context must be registered');
assert.ok(byType('xtream').length >= 1, 'authorized Xtream context must be registered');
assert.equal(sources.some(item => /official/i.test(item.type) || /official/i.test(item.id)), false, 'Official discovery must be absent from unified search registry');

for (const source of sources) {
  assert.ok(String(source.id || '').trim(), 'source id is required');
  assert.ok(String(source.label || '').trim(), `${source.id}: label is required`);
  assert.ok(String(source.type || '').trim(), `${source.id}: type is required`);
  assert.equal(typeof source.enabled, 'boolean', `${source.id}: enabled must be boolean`);
  assert.equal(getSearchSource(source.id)?.id, source.id, `${source.id}: lookup must round-trip`);
  assert.equal('browserPlayback' in source, false, `${source.id}: format capability must not be duplicated into source config`);
}

assert.equal(getSearchSource('does-not-exist'), null);
console.log(`unified source registry contract PASS · ${sources.length} sources`);
