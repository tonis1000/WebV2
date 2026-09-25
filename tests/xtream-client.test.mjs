import assert from 'node:assert/strict';
import { xtreamChannelsToM3U, summarizeXtreamChannels } from '../src/xtream-client.js';

const account = { id: 'xt_demo', name: 'Provider A', server: 'http://provider.invalid:8080' };
const channels = [
  {
    id: 'xtream:xt_demo:101',
    streamId: '101',
    tvgId: 'mega.gr',
    name: 'MEGA',
    logo: 'https://example.invalid/mega.png',
    group: 'Greek',
    playbackUrl: 'https://webtv-xtream.example/stream/xt_demo/101.m3u8?s=opaque-signature',
  },
  {
    id: 'xtream:xt_demo:202',
    streamId: '202',
    tvgId: 'sport.1',
    name: 'SPORT 1',
    logo: '',
    group: 'Sports',
    playbackUrl: 'https://webtv-xtream.example/stream/xt_demo/202.m3u8?s=opaque-signature-2',
  },
];

const m3u = xtreamChannelsToM3U(channels, account);
assert.match(m3u, /^#EXTM3U/);
assert.match(m3u, /tvg-id="mega\.gr"/);
assert.match(m3u, /group-title="Sports"/);
assert.match(m3u, /\/stream\/xt_demo\/101\.m3u8\?s=/);
assert.equal(m3u.includes('provider.invalid'), false, 'provider host must not leak into the generated My Playlist source');
assert.equal(m3u.includes('username'), false);
assert.equal(m3u.includes('password'), false);

const summary = summarizeXtreamChannels(channels);
assert.equal(summary.count, 2);
assert.equal(summary.groups, 2);
assert.deepEqual(summary.sample, ['MEGA', 'SPORT 1']);

console.log('xtream-client tests passed');
