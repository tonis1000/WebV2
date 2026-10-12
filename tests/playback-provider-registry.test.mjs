import assert from 'node:assert/strict';
import {
  PlayerController,
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


const makeController = () => {
  const states = [];
  const diagnostics = [];
  const iframe = { onload: null, onerror: null, src: 'about:blank', hidden: true };
  const video = {
    hidden: false,
    pause() {},
    removeAttribute() {},
    load() {},
  };
  let successes = 0;
  const controller = new PlayerController({
    video,
    iframe,
    emptyState: { hidden: false },
    health: {
      recordSuccess() { successes += 1; },
      recordFailure() { return { cooldownUntil: 0 }; },
      quarantine() {},
    },
    onState(state, label) { states.push({ state, label }); },
    onDiagnostics(row) { diagnostics.push(row); },
  });
  return { controller, iframe, states, diagnostics, getSuccesses: () => successes };
};

{
  const runtime = makeController();
  const play = runtime.controller.playSelectedRoute(
    { id: 'demo', name: 'Vindral Demo' },
    vindralDemo
  );
  queueMicrotask(() => runtime.iframe.onload?.());
  const result = await play;
  assert.equal(result.player, 'vindral-demo-embed');
  assert.equal(result.verifiedPlayback, false, 'iframe load is not playback proof');
  assert.equal(runtime.iframe.src, vindralDemo.playbackUrl);
  assert.equal(runtime.getSuccesses(), 0, 'unverified embed must not become Health success');
  assert.equal(runtime.states.at(-1)?.state, 'fallback');
}

{
  const runtime = makeController();
  const play = runtime.controller.play(
    { id: 'demo', name: 'Vindral Demo' },
    [vindralDemo],
    { allowOfficialFallback: false }
  );
  queueMicrotask(() => runtime.iframe.onload?.());
  await assert.rejects(play, /Embed loaded but playback not confirmed/);
  assert.equal(runtime.getSuccesses(), 0, 'Auto must not promote iframe onload to playback success');
  assert.equal(runtime.states.at(-1)?.state, 'error');
}

console.log('universal playback provider runtime semantics PASS');

{
  const runtime = makeController();
  const rawEmbed = {
    embedUrl: vindralDemo.playbackUrl,
    provider: 'vindral',
    route: 'embed',
  };
  const play = runtime.controller.playSelectedRoute(
    { id: 'demo', name: 'Vindral Demo' }, rawEmbed
  );
  queueMicrotask(() => runtime.iframe.onload?.());
  const result = await play;
  assert.equal(result.playbackUrl, vindralDemo.playbackUrl,
    'manual embedUrl-only descriptor must normalize before playback');
  assert.equal(result.verifiedPlayback, false);
  assert.equal(runtime.getSuccesses(), 0);
}

{
  const runtime = makeController();
  const invalid = { embedUrl: 'https://evil.example/embed/demo', route: 'embed' };
  await assert.rejects(
    runtime.controller.playSelectedRoute({ id: 'demo', name: 'Demo' }, invalid),
    /not allowed/i
  );
  assert.equal(runtime.getSuccesses(), 0);
}

{
  const runtime = makeController();
  const play = runtime.controller.play(
    { id: 'demo', name: 'Vindral Demo' },
    [vindralDemo, { playbackUrl: 'https://example.test/unknown', route: 'direct' }],
    { allowOfficialFallback: false }
  );
  queueMicrotask(() => runtime.iframe.onload?.());
  await assert.rejects(play, /Unsupported non-media source/);
  assert.equal(runtime.getSuccesses(), 0,
    'Auto cannot mark the unverified first embed as successful');
  assert.equal(runtime.diagnostics.some(row =>
    row.error === 'Embed loaded but playback not confirmed'), true,
    'Auto must record the unverified embed and proceed to the next candidate');
}
