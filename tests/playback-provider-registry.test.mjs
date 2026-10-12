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

assert.throws(() => normalizeEmbedRoute({
  playbackUrl: 'https://evil.example/embed/demo',
  route: 'embed',
  provider: 'youtube',
  player: 'embed',
}), /not allowed/i);

console.log('universal playback provider contract PASS');
