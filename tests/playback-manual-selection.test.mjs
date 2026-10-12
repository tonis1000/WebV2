import assert from 'node:assert/strict';
import { PlayerController } from '../src/core/player.js';

const attempts = [];
const makeController = () => new PlayerController({
  video: { pause() {}, removeAttribute() {}, load() {}, hidden: false },
  iframe: { onload: null, onerror: null, src: 'about:blank', hidden: true },
  emptyState: { hidden: false },
  health: {
    recordFailure(url) { attempts.push(url); return { cooldownUntil: 0 }; },
    recordSuccess() { throw new Error('Unexpected successful playback'); },
    quarantine() {},
  },
});
const channel = { id: 'TestChannel.gr', name: 'Test Channel' };
const first = { playbackUrl: 'https://example.test/bad-first', originalUrl: 'https://example.test/bad-first', route: 'direct', saved: true };
const second = { playbackUrl: 'https://example.test/bad-second', originalUrl: 'https://example.test/bad-second', route: 'direct', saved: true };

assert.equal(typeof PlayerController.prototype.playSelectedRoute, 'function');
await assert.rejects(() => makeController().playSelectedRoute(channel, first), /Unsupported non-media source/);
assert.deepEqual(attempts, [first.playbackUrl], 'Manual choice must attempt only the selected route');
attempts.length = 0;
await assert.rejects(() => makeController().play(channel, [first, second], { allowOfficialFallback: false }), /Unsupported non-media source/);
assert.deepEqual(attempts, [first.playbackUrl, second.playbackUrl], 'Auto mode must retain existing ordered retries');
await assert.rejects(() => makeController().playSelectedRoute(channel, null), /route must be selected/);
console.log('manual playback selection contract PASS');
