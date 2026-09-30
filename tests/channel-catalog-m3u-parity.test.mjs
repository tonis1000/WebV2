import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseM3U } from '../src/core/channel-catalog.js';

const quoted = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA TV" tvg-logo="https://img.test/mega.png" group-title="General",Fallback
https://cdn.test/mega.m3u8?token=1
`);
assert.equal(quoted.length, 1);
assert.equal(quoted[0].originalId, 'MEGA');
assert.equal(quoted[0].name, 'MEGA TV');
assert.equal(quoted[0].logo, 'https://img.test/mega.png');
assert.equal(quoted[0].group, 'General');
assert.deepEqual(quoted[0].directUrls, ['https://cdn.test/mega.m3u8?token=1']);
assert.equal(quoted[0].sourceTrust, 'temporary');

const bare = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id=MEGA tvg-name=MEGA group-title=News,MEGA fallback
https://cdn.test/bare.m3u8
`)[0];
assert.equal(bare.originalId, 'MEGA');
assert.equal(bare.name, 'MEGA');
assert.equal(bare.group, 'News');

const fallback = parseM3U(`#EXTM3U
#EXTINF:-1,MEGA, Greece
https://cdn.test/fallback.m3u8
`)[0];
assert.equal(fallback.originalId, 'MEGA, Greece');
assert.equal(fallback.name, 'MEGA, Greece');

const schemes = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="A",A
rtsp://camera.test/live
#EXTINF:-1 tvg-id="B",B
rtmp://media.test/live
#EXTINF:-1 tvg-id="C",C
file.strm
#EXTINF:-1 tvg-id="D",D
#EXTVLCOPT:http-user-agent=WebTV

https://cdn.test/d.m3u8|User-Agent=UA
`);
assert.deepEqual(schemes.map(item => item.directUrls), [[], [], [], ['https://cdn.test/d.m3u8|User-Agent=UA']]);

const noSteal = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="ONE",One
#COMMENT no source
#EXTINF:-1 tvg-id="TWO",Two
https://cdn.test/two.m3u8
`);
assert.equal(noSteal.length, 2);
assert.deepEqual(noSteal[0].directUrls, []);
assert.deepEqual(noSteal[1].directUrls, ['https://cdn.test/two.m3u8']);

const deduped = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA" group-title="Other",MEGA
https://cdn.test/one.m3u8
#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA" tvg-logo="https://img.test/mega.png" group-title="General",MEGA
https://cdn.test/two.m3u8
`);
assert.equal(deduped.length, 1);
assert.deepEqual(deduped[0].directUrls, ['https://cdn.test/one.m3u8', 'https://cdn.test/two.m3u8']);
assert.equal(deduped[0].logo, 'https://img.test/mega.png');
assert.equal(deduped[0].group, 'General');

const source = fs.readFileSync(new URL('../src/core/channel-catalog.js', import.meta.url), 'utf8');
assert.match(source, /m3u-container\.js/, 'Channel Catalog must delegate M3U structure to the shared core');
assert.match(source, /parseM3uContainer/, 'Channel Catalog must consume parseM3uContainer');
assert.doesNotMatch(source, /function\s+attr\s*\(/, 'Channel Catalog must not keep a private EXTINF attribute parser');

console.log('Channel Catalog M3U parity PASS');
