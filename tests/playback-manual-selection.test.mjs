import assert from 'node:assert/strict';
import { PlayerController } from '../src/core/player.js';

// A manually selected route must be the only attempted route. The existing
// Auto mode remains responsible for health-ranked retry/fallback behavior.
// This contract is intentionally RED until the selected-route playback API exists.
assert.equal(typeof PlayerController.prototype.playSelectedRoute, 'function',
  'PlayerController must expose an explicit selected-route playback entrypoint');

console.log('manual playback selection contract PASS');
