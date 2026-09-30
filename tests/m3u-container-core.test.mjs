import assert from 'node:assert/strict';
import {
  isM3uContainer,
  parseM3uAttributes,
  parseM3uContainer,
} from '../src/core/m3u-container.js';

assert.equal(isM3uContainer('#EXTM3U\n#EXTINF:-1,MEGA\nhttps://cdn.test/mega.m3u8\n'), true);
assert.equal(isM3uContainer('plain text\nhttps://cdn.test/mega.m3u8\n'), false);

const attrs = parseM3uAttributes('#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA TV" tvg-logo="https://img.test/mega.png" group-title="General",MEGA');
assert.deepEqual(attrs, {
  'tvg-id': 'MEGA',
  'tvg-name': 'MEGA TV',
  'tvg-logo': 'https://img.test/mega.png',
  'group-title': 'General',
});

const bareAttrs = parseM3uAttributes('#EXTINF:-1 tvg-id=MEGA tvg-name=MEGA group-title=General,MEGA');
assert.equal(bareAttrs['tvg-id'], 'MEGA');
assert.equal(bareAttrs['tvg-name'], 'MEGA');
assert.equal(bareAttrs['group-title'], 'General');

const [entry] = parseM3uContainer(`#EXTM3U\r\n#extinf:-1 tvg-id="MEGA" group-title="General",MEGA, Greece\r\n\r\n#EXTVLCOPT:http-user-agent=WebTV\r\nhttps://cdn.test/mega.m3u8?token=1|User-Agent=UA\r\n`);
assert.equal(entry.index, 0);
assert.equal(entry.extinf, '#extinf:-1 tvg-id="MEGA" group-title="General",MEGA, Greece');
assert.equal(entry.duration, -1);
assert.equal(entry.title, 'MEGA, Greece');
assert.equal(entry.attributes['tvg-id'], 'MEGA');
assert.equal(entry.attributes['group-title'], 'General');
assert.equal(entry.sourceLine, 'https://cdn.test/mega.m3u8?token=1|User-Agent=UA');
assert.deepEqual(entry.directivesBeforeSource, ['#EXTVLCOPT:http-user-agent=WebTV']);

const structural = parseM3uContainer(`#EXTM3U
#EXTINF:-1,HLS
https://cdn.test/live.m3u8?token=1
#EXTINF:-1,DASH
https://cdn.test/live.mpd
#EXTINF:-1,DIRECT
https://cdn.test/live?id=1
#EXTINF:-1,RTSP
rtsp://camera.test/live
#EXTINF:-1,RTMP
rtmp://media.test/live/channel
#EXTINF:-1,STRM
https://raw.test/channel.strm
`);
assert.deepEqual(structural.map(item => item.sourceLine), [
  'https://cdn.test/live.m3u8?token=1',
  'https://cdn.test/live.mpd',
  'https://cdn.test/live?id=1',
  'rtsp://camera.test/live',
  'rtmp://media.test/live/channel',
  'https://raw.test/channel.strm',
]);

const missing = parseM3uContainer(`#EXTM3U
#EXTINF:-1,Missing source
#COMMENT keep me
#EXTINF:-1,Next
https://cdn.test/next.m3u8
`);
assert.equal(missing.length, 2);
assert.equal(missing[0].sourceLine, '');
assert.deepEqual(missing[0].directivesBeforeSource, ['#COMMENT keep me']);
assert.equal(missing[1].sourceLine, 'https://cdn.test/next.m3u8');

const duplicates = parseM3uContainer(`#EXTM3U
#EXTINF:-1,Same
https://cdn.test/one.m3u8
#EXTINF:-1,Same
https://cdn.test/two.m3u8
`);
assert.equal(duplicates.length, 2);
assert.deepEqual(duplicates.map(item => item.index), [0, 1]);
assert.deepEqual(duplicates.map(item => item.sourceLine), ['https://cdn.test/one.m3u8', 'https://cdn.test/two.m3u8']);

const malformed = parseM3uContainer(`#EXTM3U
#EXTINF:,Broken
#COMMENT still structural
https://cdn.test/broken.m3u8
#EXTINF:-1,Good
https://cdn.test/good.m3u8
`);
assert.equal(malformed.length, 2);
assert.equal(malformed[0].title, 'Broken');
assert.equal(malformed[0].duration, null);
assert.equal(malformed[0].sourceLine, 'https://cdn.test/broken.m3u8');
assert.equal(malformed[1].title, 'Good');

console.log('M3U container core contract PASS');
