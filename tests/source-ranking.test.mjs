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

const staleBacking={ [a]:{success:0,fail:1,consecutiveFailures:1}, [c]:{success:1,fail:0,consecutiveFailures:0,lastSuccess:Date.now(),avgStartupMs:850} };
const liveHealth={
  map:{},
  refresh(){this.map=staleBacking;},
  score(url){
    const e=this.map[url]; if(!e)return 0;
    const attempts=(e.success||0)+(e.fail||0);
    return (attempts?(e.success||0)/attempts*70:0)-((e.consecutiveFailures||0)*15)+(e.lastSuccess?20:0);
  }
};
liveHealth.refresh();
const synced=rankRoutesByHealth([route(a),route(c)],liveHealth);
assert.equal(synced[0].originalUrl,c,'ranking must use refreshed persistent health state');
