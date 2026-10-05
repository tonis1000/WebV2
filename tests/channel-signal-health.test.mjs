import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parseChannelSignalSnapshot, lookupChannelSignalUrl } from '../workers/channel-signal-health.js';

const dashboard=`<!doctype html><p class="subline">2039 channels · last swept 2026-10-04T00:57:42Z</p>
<table id="problems"><tbody>
<tr data-state="blocked"><td>greece</td><td>ANT1</td><td><span>blocked</span></td><td class="url"><a href="https://mcdn.antennaplus.gr/live/media0/Ant1/HLS/Ant1.m3u8">same</a></td><td class="dim">2026-10-04</td></tr>
<tr data-state="flaky"><td>greece</td><td>Skai TV</td><td><span>flaky</span></td><td class="url"><a href="http://skai-live.siliconweb.com/media/cambria4/index.m3u8">same</a></td><td class="dim">2026-10-04</td></tr>
</tbody></table>`;
const playlist=`#EXTM3U
#EXTINF:-1 group-title="Greece",MEGA
https://example.test/mega.m3u8
#EXTINF:-1 group-title="Greece",ANT1
https://mcdn.antennaplus.gr/live/media0/Ant1/HLS/Ant1.m3u8
`;

const snapshot=parseChannelSignalSnapshot({dashboardHtml:dashboard,playlistText:playlist});
assert.equal(snapshot.lastSwept,'2026-10-04T00:57:42Z');

const alive=lookupChannelSignalUrl(snapshot,'https://example.test/mega.m3u8');
assert.equal(alive.state,'alive');
assert.equal(alive.channel,'MEGA');
assert.equal(alive.list,'Greece');
assert.equal(alive.advisory,true);

const blocked=lookupChannelSignalUrl(snapshot,'https://mcdn.antennaplus.gr/live/media0/Ant1/HLS/Ant1.m3u8');
assert.equal(blocked.state,'blocked');
assert.equal(blocked.channel,'ANT1');
assert.equal(blocked.checkedAt,'2026-10-04');

const flaky=lookupChannelSignalUrl(snapshot,'http://skai-live.siliconweb.com/media/cambria4/index.m3u8');
assert.equal(flaky.state,'flaky');

const missing=lookupChannelSignalUrl(snapshot,'https://not-listed.example/live.m3u8');
assert.equal(missing.state,'not-found');
assert.equal(missing.advisory,true);

console.log('Channel Signal external health policy PASS');

const worker=fs.readFileSync(new URL('../workers/tv-cache.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../src/search/search-ui.js',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../src/search/external-health-client.js',import.meta.url),'utf8');
assert.match(worker,/\/external-health/,'TV Cache must own the external health endpoint');
assert.match(worker,/lookupChannelSignalHealth/,'TV Cache endpoint must delegate to the Channel Signal adapter');
assert.match(ui,/fetchExternalHealth/,'Unified Search details must use the external health client');
assert.match(ui,/addEventListener\(['"]toggle['"]/,'Channel Signal lookup must be lazy on Details open');
assert.doesNotMatch(client,/WebTVMyPlaylistAPI|testCandidate|recordSuccess|recordFailure/,'external health client must not own save, playback or canonical health mutation');
