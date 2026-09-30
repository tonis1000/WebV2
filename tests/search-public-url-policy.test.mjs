import assert from 'node:assert/strict';
import { safePublicActionUrl } from '../src/search/public-url-policy.js';

assert.equal(safePublicActionUrl('https://github.com/example/repo/blob/main/list.m3u'),'https://github.com/example/repo/blob/main/list.m3u');
assert.equal(safePublicActionUrl('http://example.test/page'),'http://example.test/page');
assert.equal(safePublicActionUrl('javascript:alert(1)'),'');
assert.equal(safePublicActionUrl('file:///tmp/test.m3u'),'');
assert.equal(safePublicActionUrl('https://user:pass@example.test/list.m3u'),'');
assert.equal(safePublicActionUrl('https://example.test/list.m3u?token=secret'),'');
assert.equal(safePublicActionUrl('https://example.test/list.m3u?Signature=secret&Key-Pair-Id=abc'),'');
assert.equal(safePublicActionUrl('https://example.test/live/user/pass/100.ts'),'');
assert.equal(safePublicActionUrl('https://example.test/movie/user/pass/100.mp4'),'');
assert.equal(safePublicActionUrl('https://example.test/path?foo=bar'),'https://example.test/path?foo=bar');

console.log('Unified Search public URL exposure policy PASS');
