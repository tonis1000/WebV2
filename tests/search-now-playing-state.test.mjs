import assert from 'node:assert/strict';
import { UnifiedNowPlayingState } from '../src/search/now-playing-state.js';

const state=new UnifiedNowPlayingState();
assert.equal(state.value('MEGA'),'MEGA','sidebar channel is the default playback label');

state.setCandidate('ERT1');
assert.equal(state.value('MEGA'),'ERT1','successful candidate playback must override later search updates');
assert.equal(state.value('MEGA'),'ERT1','repeated renders must preserve the candidate playback label');

state.sidebarChanged();
assert.equal(state.value('ANT1'),'ANT1','explicit sidebar channel change must clear the candidate override');

state.setCandidate('');
assert.equal(state.value('ANT1'),'ANT1','empty candidate names must not create a fake playback label');

console.log('Unified Search Now Playing state contract PASS');
