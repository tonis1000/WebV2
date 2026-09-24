import assert from 'node:assert/strict';
import { rankRoutesByHealth } from '../src/core/source-registry.js';

const route=(url,kind='direct',saved=true)=>({
  originalUrl:url,
  playbackUrl:kind==='direct'?url:`https://worker.invalid/?url=${encodeURIComponent(url)}`,
  route:kind,
  saved
});
const a='https://example.test/weak-a.m3u8';
const b='https://example.test/weak-b.m3u8';
const c='https://example.test/strong.m3u8';
const routes=[route(a),route(a,'worker'),route(b),route(b,'worker'),route(c),route(c,'worker')];
const scores=new Map([
  [a,-15],[routes[1].playbackUrl,-15],
  [b,-15],[routes[3].playbackUrl,-15],
  [c,99],[routes[5].playbackUrl,0],
]);
const health={score:url=>scores.get(url)??0};
const ranked=rankRoutesByHealth(routes,health);
assert.equal(ranked[0].originalUrl,c,'known-good source family must rank first');
assert.equal(ranked[0].route,'direct','DIRECT must stay first inside winning family');
assert.equal(ranked[1].originalUrl,c,'winning family Worker must stay adjacent as fallback');
assert.equal(ranked[1].route,'worker');
console.log('source ranking: PASS · strongest known family first · DIRECT before WORKER');
