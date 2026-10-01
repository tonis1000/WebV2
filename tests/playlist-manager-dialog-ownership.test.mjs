import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/playlist-manager.js',import.meta.url),'utf8');
assert.match(
  source,
  /xtream-save-destination-dialog[^\n]*contains\(event\.target\)/,
  'Playlist Manager outside-click ownership must treat the Xtream save destination dialog as an owned surface so Save does not close the manager',
);
console.log('playlist manager Xtream dialog ownership PASS');
