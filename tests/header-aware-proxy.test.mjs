import assert from 'node:assert/strict';
import { parseIptvUrl, workerUrl, cleanUrl } from '../src/core/utils.js';
import { SourceRegistry } from '../src/core/source-registry.js';
import { routeMediaType } from '../src/core/player.js';
import worker from '../workers/tv-cache.js';

const health = {
  isCoolingDown: () => false,
  score: () => 0,
};

const raw = 'https://example.com/live.m3u8|user-agent=Kodi%2F21&referer=https%3A%2F%2Fsite.example%2F&origin=https%3A%2F%2Fsite.example&authorization=secret';
const parsed = parseIptvUrl(raw);
assert.equal(parsed.url, 'https://example.com/live.m3u8');
assert.deepEqual(parsed.headers, {
  'User-Agent': 'Kodi/21',
  Referer: 'https://site.example/',
  Origin: 'https://site.example',
});
assert.equal(cleanUrl(raw), 'https://example.com/live.m3u8');
assert.equal(parseIptvUrl('https://example.com/a.m3u8|referer=good%0D%0AX-Evil%3Ayes').headers.Referer, undefined);

const plainWorker = workerUrl('https://example.com/live.m3u8');
assert.equal(plainWorker, 'https://tv-cache.atonis.workers.dev/?url=https%3A%2F%2Fexample.com%2Flive.m3u8');
const headerWorker = workerUrl(parsed.url, parsed.headers);
assert.match(headerWorker, /^https:\/\/tv-cache\.atonis\.workers\.dev\/\?h=[A-Za-z0-9_-]+&url=/);
assert.ok(headerWorker.endsWith('live.m3u8'));
assert.equal(routeMediaType({ originalUrl: parsed.url, playbackUrl: headerWorker }), 'hls');
assert.equal(routeMediaType({ originalUrl: 'https://example.com/live.mpd', playbackUrl: 'https://proxy.example/?url=encoded' }), 'dash');

const registry = new SourceRegistry(health);
let routes = await registry.getSources({ id: 'header-test', name: 'Header Test', directUrls: [raw], sourceTrust: 'temporary' });
assert.equal(routes.length, 2);
assert.equal(routes[0].route, 'direct');
assert.equal(routes[0].playbackUrl, parsed.url);
assert.equal(routes[1].route, 'worker+headers');
assert.deepEqual(routes[1].requestHeaders, parsed.headers);
assert.equal(routeMediaType(routes[1]), 'hls');

const normalRegistry = new SourceRegistry(health);
routes = await normalRegistry.getSources({ id: 'normal-test', name: 'Normal Test', directUrls: ['https://example.com/plain.m3u8'], sourceTrust: 'temporary' });
assert.equal(routes.length, 2);
assert.equal(routes[0].playbackUrl, 'https://example.com/plain.m3u8');
assert.equal(routes[1].playbackUrl, 'https://tv-cache.atonis.workers.dev/?url=https%3A%2F%2Fexample.com%2Fplain.m3u8');
assert.equal(routeMediaType(routes[1]), 'hls');

const seen = [];
globalThis.caches = { default: { match: async () => null, put: async () => {} } };
globalThis.fetch = async (target, init = {}) => {
  const href = String(target);
  const headers = Object.fromEntries(new Headers(init.headers || {}).entries());
  seen.push({ href, headers });
  if (href.endsWith('/redirect.strm')) {
    return new Response(raw, { status: 200 });
  }
  if (href.endsWith('/live.m3u8')) {
    return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nchild/variant.m3u8\n#EXT-X-KEY:METHOD=AES-128,URI="keys/key.bin"\n', { status: 200, headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
  }
  if (href.endsWith('/child/variant.m3u8')) {
    return new Response('#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg-1.ts\n', { status: 200, headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
  }
  return new Response('data', { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
};

const strmRegistry = new SourceRegistry(health);
const strmRoutes = await strmRegistry.getSources({ id: 'strm-test', name: 'STRM Test', directUrls: ['https://example.com/redirect.strm'], sourceTrust: 'temporary' });
assert.equal(strmRoutes[1].route, 'worker+headers');
assert.equal(strmRoutes[1].requestHeaders.Referer, 'https://site.example/');
assert.equal(routeMediaType(strmRoutes[1]), 'hls');

const ctx = { waitUntil() {} };
const first = await worker.fetch(new Request(headerWorker), { TV_CACHE: {} }, ctx);
assert.equal(first.status, 200);
const master = await first.text();
assert.match(master, /\?h=[A-Za-z0-9_-]+&url=https%3A%2F%2Fexample.com%2Fchild%2Fvariant.m3u8/);
assert.match(master, /URI="https:\/\/tv-cache\.atonis\.workers\.dev\/\?h=[A-Za-z0-9_-]+&url=https%3A%2F%2Fexample.com%2Fkeys%2Fkey.bin"/);
const upstreamMaster = seen.find(item => item.href.endsWith('/live.m3u8'));
assert.equal(upstreamMaster.headers['user-agent'], 'Kodi/21');
assert.equal(upstreamMaster.headers.referer, 'https://site.example/');
assert.equal(upstreamMaster.headers.origin, 'https://site.example');

const childUrl = master.split('\n').find(line => line.includes('variant.m3u8'));
const child = await worker.fetch(new Request(childUrl), { TV_CACHE: {} }, ctx);
const childText = await child.text();
assert.match(childText, /\?h=[A-Za-z0-9_-]+&url=https%3A%2F%2Fexample.com%2Fchild%2Fseg-1.ts/);
const upstreamChild = seen.find(item => item.href.endsWith('/child/variant.m3u8'));
assert.equal(upstreamChild.headers['user-agent'], 'Kodi/21');
assert.equal(upstreamChild.headers.referer, 'https://site.example/');
assert.equal(upstreamChild.headers.origin, 'https://site.example');

const badPayload = Buffer.from(JSON.stringify({ Referer: 'good\r\nX-Evil: yes' }), 'utf8').toString('base64url');
const badReq = new Request(`https://tv-cache.atonis.workers.dev/?h=${badPayload}&url=${encodeURIComponent('https://example.com/live.m3u8')}`);
const badResp = await worker.fetch(badReq, { TV_CACHE: {} }, ctx);
assert.equal(badResp.status, 400);

console.log('header-aware proxy regression tests: PASS');
