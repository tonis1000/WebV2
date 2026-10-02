import assert from 'node:assert/strict';
import { sanitizeCandidateUrl } from '../src/core/source-candidate-url.js';

assert.equal(
  sanitizeCandidateUrl('https://cdn.test/live.m3u8?dpssid=x\\u0026amp;sid=y\\u0026amp;ndvc=1\\u003c/a\\u003e\\\\'),
  'https://cdn.test/live.m3u8?dpssid=x&sid=y&ndvc=1'
);
assert.equal(
  sanitizeCandidateUrl('https:\\/\\/cdn.test\\/live.m3u8?x=1&amp;y=2'),
  'https://cdn.test/live.m3u8?x=1&y=2'
);
assert.equal(sanitizeCandidateUrl('https://cdn.test/live.m3u8\n\n'),'https://cdn.test/live.m3u8');
assert.equal(sanitizeCandidateUrl('not-a-url'),'');
assert.equal(sanitizeCandidateUrl('https://cdn.test/live.m3u8<bad>'),'https://cdn.test/live.m3u8');

console.log('candidate URL sanitizer PASS');
