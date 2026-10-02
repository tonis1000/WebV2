import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFileSync(path.join(ROOT,relative),'utf8');

const main=read('src/main.js');
const favorites=read('src/favorites-ui.js');
const manager=read('src/playlist-manager.js');
const sidebar=read('src/sidebar-now.js');

assert.match(
  main,
  /webtv:channel-selected/,
  'main.js must publish the canonical structured channel-selection event'
);
assert.match(
  main,
  /getSelectedChannel/,
  'main.js must keep WebTVPlaylistAPI.getSelectedChannel as the canonical selected-channel snapshot'
);

assert.doesNotMatch(
  favorites,
  /MutationObserver\(updateSelectedButton\)[\s\S]*channelName/,
  'Favorites UI must not use rendered #channel-name DOM as a selected-channel state bus'
);
assert.match(
  favorites,
  /webtv:channel-selected/,
  'Favorites UI must react to the canonical channel-selection event'
);

assert.doesNotMatch(
  manager,
  /\$\('channel-list'\)\?\.addEventListener\('click',[\s\S]*updateMyAction/,
  'Playlist Manager must not infer selected-channel state from generic channel-list clicks'
);
assert.doesNotMatch(
  manager,
  /MutationObserver\([\s\S]*updateMyAction[\s\S]*channel-name/,
  'Playlist Manager must not infer selected-channel state from rendered #channel-name DOM'
);
assert.match(
  manager,
  /webtv:channel-selected/,
  'Playlist Manager must react to the canonical channel-selection event'
);

assert.doesNotMatch(
  sidebar,
  /querySelector\('strong'\)\?\.textContent/,
  'Sidebar Now Playing must not reconstruct channel identity from rendered row text'
);
assert.match(
  sidebar,
  /WebTVPlaylistAPI\?\.getChannelById/,
  'Sidebar Now Playing must resolve row identity through the canonical playlist API'
);

console.log('Sidebar selected-channel ownership PASS');
