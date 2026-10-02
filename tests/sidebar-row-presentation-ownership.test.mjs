import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const favorites=fs.readFileSync(new URL('../src/favorites-ui.js',import.meta.url),'utf8');
const sidebar=fs.readFileSync(new URL('../src/sidebar-now.js',import.meta.url),'utf8');

assert.match(
  main,
  /WebTVFavoritesPresentationAPI\?\.getState\?\.\(\)/,
  'main.js must consume the canonical Favorites presentation-state API when deriving channel rows'
);
assert.match(
  main,
  /webtv:favorites-presentation-changed/,
  'main.js must rerender the channel list when Favorites presentation state changes'
);
assert.match(
  main,
  /favoritesOnly[\s\S]*filter\([\s\S]*favorites[\s\S]*sort\(/,
  'main.js must own Favorites-only filtering and favorite-first row ordering before rendering the summary/list'
);

assert.match(
  favorites,
  /window\.WebTVFavoritesPresentationAPI\s*=\s*\{/,
  'Favorites must expose a narrow read-only presentation-state API'
);
assert.match(
  favorites,
  /webtv:favorites-presentation-changed/,
  'Favorites must notify main.js when its presentation state changes'
);
assert.doesNotMatch(
  favorites,
  /item\.hidden\s*=/,
  'Favorites must not directly own channel-row visibility'
);
assert.doesNotMatch(
  favorites,
  /list\.appendChild\s*\(/,
  'Favorites must not physically reorder channel-list children'
);
assert.doesNotMatch(
  favorites,
  /MutationObserver\([^)]*scheduleApply[\s\S]*observe\(list/,
  'Favorites must not observe and post-process channel-list child mutations'
);

assert.doesNotMatch(
  sidebar,
  /list\.(?:appendChild|prepend|replaceChildren|insertBefore)\s*\(/,
  'Sidebar Now Playing may decorate row subtrees but must not own channel-list child order'
);
assert.doesNotMatch(
  sidebar,
  /\.hidden\s*=/,
  'Sidebar Now Playing must not own channel-row visibility'
);

console.log('Sidebar row presentation ownership PASS');
