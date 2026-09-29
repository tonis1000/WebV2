import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');

const bootMatch = main.match(/async function boot\(\)\{([\s\S]*?)\n\}/);
assert.ok(bootMatch, 'main.js must expose the boot function');
const boot = bootMatch[1];

const sourceRefresh = boot.indexOf('sources.refresh()');
const playlistAwait = boot.indexOf("await loadCloudMyPlaylist({reason:'startup',preserveSelection:false})");
const readyFlag = boot.indexOf('window.WebTVPlaylistAPI.ready=true');
const readyEvent = boot.indexOf("window.dispatchEvent(new CustomEvent('webtv:ready'))");
const epgAwait = boot.indexOf('await epgTask');

assert.ok(sourceRefresh >= 0, 'boot must still start the remote Source Registry refresh');
assert.ok(playlistAwait > sourceRefresh, 'remote Source Registry refresh should start in parallel before the D1 playlist completes');
assert.ok(readyFlag > playlistAwait, 'the app should become ready only after the D1 My Playlist is loaded');
assert.ok(readyEvent > readyFlag, 'webtv:ready must be emitted after the ready flag is set');
assert.ok(epgAwait > readyEvent, 'EPG completion must not block webtv:ready');
assert.doesNotMatch(boot, /await\s+sourceTask\b/, 'remote Source Registry must never block initial interactivity');
assert.doesNotMatch(boot, /const\s+sourceTask\s*=\s*sources\.refresh\(\)/, 'boot should not create a Source Registry promise that is later awaited');
assert.match(boot, /sources\.refresh\(\)[\s\S]*?\.then\(\(\)=>\{[\s\S]*?if\(window\.WebTVPlaylistAPI\?\.ready\)renderChannels\(\)/, 'background Source Registry completion should refresh channel route counts after startup');

console.log('startup non-blocking regression: PASS');
