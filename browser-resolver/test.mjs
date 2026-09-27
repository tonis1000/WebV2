import assert from 'node:assert/strict';
import resolver,{ALLOWED_PAGE_HOSTS,MEDIA_RE,sanitizeHeaders,safePageUrl,timeoutFrom,clickSelectedChannelWithRetry} from './src/index.js';

assert.ok(ALLOWED_PAGE_HOSTS.has('live.ertflix.gr'));
assert.ok(ALLOWED_PAGE_HOSTS.has('www.antenna.gr'));
assert.equal(safePageUrl('https://live.ertflix.gr/').hostname,'live.ertflix.gr');
assert.throws(()=>safePageUrl('http://live.ertflix.gr/'),/HTTPS/);
assert.throws(()=>safePageUrl('https://example.com/'),/allowlisted/);
assert.equal(MEDIA_RE.test('https://cdn.test/live/master.m3u8?token=x'),true);
assert.equal(MEDIA_RE.test('https://cdn.test/live/manifest.mpd'),true);
assert.equal(MEDIA_RE.test('https://cdn.test/app.js'),false);
assert.deepEqual(sanitizeHeaders({
  'user-agent':'UA',Referer:'https://live.ertflix.gr/',Origin:'https://live.ertflix.gr',Cookie:'secret=1',Authorization:'Bearer nope',
}),{'User-Agent':'UA',Referer:'https://live.ertflix.gr/',Origin:'https://live.ertflix.gr'});
assert.equal(timeoutFrom({capture:{timeoutMs:1}}),2500);
assert.equal(timeoutFrom({capture:{timeoutMs:99999}}),12000);

let attempts=0;
const delayedPage={evaluate:async()=>{attempts+=1;return attempts>=3?{clicked:true,label:'ERT 1'}:{clicked:false,label:''};}};
const delayedSelection=await clickSelectedChannelWithRetry(delayedPage,{id:'ert1'},4,1);
assert.deepEqual(delayedSelection,{clicked:true,label:'ERT 1'});
assert.equal(attempts,3);

const status=await resolver.fetch(new Request('https://resolver.test/'),{});
assert.equal(status.status,200);
const statusBody=await status.json();
assert.equal(statusBody.service,'WebTV Browser Resolver');
assert.equal(statusBody.ready,false);

const unauthorized=await resolver.fetch(new Request('https://resolver.test/resolve',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),{RESOLVER_SHARED_TOKEN:'secret'});
assert.equal(unauthorized.status,401);

const invalidHost=await resolver.fetch(new Request('https://resolver.test/resolve',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer secret'},body:JSON.stringify({url:'https://example.com/'})}),{RESOLVER_SHARED_TOKEN:'secret',BROWSER:{}});
assert.equal(invalidHost.status,400);
assert.match((await invalidHost.json()).error,/allowlisted/);

console.log('browser resolver contract tests PASS');
