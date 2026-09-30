import assert from 'node:assert/strict';
import fs from 'node:fs';
import { StrmResolver, isStrmReference } from '../src/core/strm-resolver.js';

assert.equal(isStrmReference('https://example.test/live.strm'), true);
assert.equal(isStrmReference('https://example.test/live.strm?token=1'), true);
assert.equal(isStrmReference('https://example.test/live.m3u8'), false);

const originalFetch = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = async input => {
    calls += 1;
    const url = String(input);
    if (url.endsWith('/root.strm')) return new Response('#KODIPROP:inputstream.adaptive.license_type=widevine\nhttps://example.test/nested.strm');
    if (url.endsWith('/nested.strm')) return new Response('https://media.test/live.mpd');
    if (url.endsWith('/fail.strm')) return new Response('nope', { status: 500 });
    return new Response('https://media.test/live.m3u8');
  };

  const resolver = new StrmResolver({ timeoutMs: 1000 });
  const root = 'https://github.com/acme/repo/blob/main/root.strm';
  assert.equal(await resolver.resolve(root), 'https://media.test/live.mpd');
  assert.equal(resolver.peekInfo(root)?.drm, true);
  const beforeCached = calls;
  assert.equal(await resolver.resolve(root), 'https://media.test/live.mpd');
  assert.equal(calls, beforeCached, 'successful resolution should be cached');

  const fail = new StrmResolver({ timeoutMs: 1000 });
  assert.equal(await fail.resolve('https://example.test/fail.strm'), '');
  const afterFail = calls;
  assert.equal(await fail.resolve('https://example.test/fail.strm'), '');
  assert.equal(calls, afterFail, 'failure should be cached inside failure TTL');

  let release;
  let concurrentCalls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async () => { concurrentCalls += 1; await gate; return new Response('https://media.test/live.m3u8'); };
  const concurrent = new StrmResolver({ timeoutMs: 1000 });
  const a = concurrent.resolve('https://example.test/concurrent.strm');
  const b = concurrent.resolve('https://example.test/concurrent.strm');
  release();
  assert.equal(await a, 'https://media.test/live.m3u8');
  assert.equal(await b, 'https://media.test/live.m3u8');
  assert.equal(concurrentCalls, 1, 'in-flight resolutions should deduplicate');
} finally {
  globalThis.fetch = originalFetch;
}

const source = fs.readFileSync(new URL('../src/core/strm-resolver.js', import.meta.url), 'utf8');
assert.match(source, /from ['"]\.\/strm-core\.js/,
  'browser StrmResolver must consume shared STRM core');
assert.doesNotMatch(source, /function\s+parseStrmText\s*\(/,
  'browser StrmResolver must not keep a local STRM document parser');

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /"\.\/src\/core\/strm-core\.js"\s*:\s*"\.\/src\/core\/strm-core\.js\?v=20260930-strm-e3a"/,
  'browser import map must cache-bust the shared STRM core');
assert.match(index, /"\.\/src\/core\/strm-resolver\.js"\s*:\s*"\.\/src\/core\/strm-resolver\.js\?v=20260930-strm-e3a"/,
  'browser import map must cache-bust the migrated STRM resolver');

console.log('browser STRM resolver parity tests PASS');
