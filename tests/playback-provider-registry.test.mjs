import assert from 'node:assert/strict';
import {
  resolvePlaybackProvider,
  normalizeEmbedRoute,
} from '../src/core/player.js';

const youtube = normalizeEmbedRoute({
  playbackUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1',
  route: 'embed',
  provider: 'youtube',
  player: 'embed',
});
assert.equal(youtube.provider, 'youtube');
assert.equal(youtube.player, 'embed');
assert.equal(youtube.playbackUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1');

assert.equal(resolvePlaybackProvider({
  playbackUrl: 'https://example.test/live.m3u8',
  originalUrl: 'https://example.test/live.m3u8',
}).id, 'hls');

assert.equal(resolvePlaybackProvider({
  playbackUrl: 'https://example.test/live.mpd',
  originalUrl: 'https://example.test/live.mpd',
}).id, 'dash');

assert.equal(resolvePlaybackProvider({
  playbackUrl: 'https://example.test/movie.mp4',
  originalUrl: 'https://example.test/movie.mp4',
}).id, 'native-video');

assert.equal(resolvePlaybackProvider(youtube).id, 'youtube-embed');

const vindralDemo = normalizeEmbedRoute({
  playbackUrl: 'https://player.vindral.com/?core.channelId=vindral_demo1_ci_099ee1fa-80f3-455e-aa23-3d184e93e04f',
  route: 'embed',
  provider: 'vindral',
  player: 'embed',
});
assert.equal(vindralDemo.provider, 'vindral');
assert.equal(resolvePlaybackProvider(vindralDemo).id, 'vindral-demo-embed');

assert.throws(() => normalizeEmbedRoute({
  playbackUrl: 'https://evil.example/embed/demo',
  route: 'embed',
  provider: 'youtube',
  player: 'embed',
}), /not allowed/i);

assert.throws(() => normalizeEmbedRoute({
  playbackUrl: 'https://player.vindral.com/?core.channelId=private_channel&core.authenticationToken=secret',
  route: 'embed',
  provider: 'vindral',
  player: 'embed',
}), /not allowed/i);

console.log('universal playback provider contract PASS');
