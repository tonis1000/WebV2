import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalDefaultChannelName, savedChannelDisplayName } from '../src/channel-display-name.js';

assert.equal(canonicalDefaultChannelName({name:'SKAI TV'}),'SKAI');
assert.equal(canonicalDefaultChannelName({name:'ALPHA HD'}),'Alpha TV');
assert.equal(canonicalDefaultChannelName({originalId:'ERTNEWS.gr',name:'ERT NEWS HD'}),'ERT News');
assert.equal(canonicalDefaultChannelName({name:'Completely New Channel'}),'Completely New Channel');

assert.equal(
  savedChannelDisplayName({name:'SKAI TV'},{name:'Το κανάλι μου'}),
  'Το κανάλι μου',
  'stored My Playlist display name must override canonical default'
);
assert.equal(
  savedChannelDisplayName({name:'SKAI TV'},null),
  'SKAI',
  'new saved channels should start from canonical default'
);

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const manager=fs.readFileSync(new URL('../src/playlist-manager.js',import.meta.url),'utf8');

assert.match(main,/name:canonicalDefaultChannelName\(channel\)/,'temporary known channels should use canonical presentation names');
assert.match(main,/name:\s*c\.name/,'cloud My Playlist must keep the stored display name');
assert.match(manager,/name:canonicalDefaultChannelName\(channel\)/,'new generic My Playlist additions should start canonical');
assert.match(manager,/savedChannelDisplayName\(channel,index<0\?null:myCache\[index\]\)/,'Xtream re-save must preserve an existing custom display name');
assert.match(manager,/prompt\('Channel name',channel\.name\)/,'manual rename UI must remain available');

console.log('channel display-name policy ok');
