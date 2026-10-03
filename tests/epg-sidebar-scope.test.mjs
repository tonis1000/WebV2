import assert from 'node:assert/strict';
import fs from 'node:fs';

const epg=fs.readFileSync(new URL('../src/core/epg.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

assert.match(epg,/refresh\(\{\s*force\s*=\s*false\s*,\s*channels\s*=\s*\[\]/,'EpgService refresh must accept the active catalog');
assert.match(epg,/searchParams\.set\(['"]channels['"]/,'scoped EPG URL must send channel terms to the Worker');
assert.match(epg,/getSchedule\(/,'EPG owner must expose arbitrary channel schedules for the Guide');
assert.match(main,/epg\.refresh\(\{channels/,'runtime must scope EPG refresh to current catalog');
assert.doesNotMatch(main,/const epgTask=epg\.refresh\(\)\s*\n[\s\S]{0,500}await loadCloudMyPlaylist/,'startup must not fetch the unscoped EPG before the sidebar catalog exists');

console.log('sidebar-scoped EPG fetch contract PASS');
