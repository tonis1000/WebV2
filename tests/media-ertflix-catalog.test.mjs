import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker=fs.readFileSync(new URL('../workers/webtv-media.js',import.meta.url),'utf8');
const media=fs.readFileSync(new URL('../media.html',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../src/media-page.js',import.meta.url),'utf8');

assert.match(worker,/WebTV Media Catalog/,'media worker must have one explicit catalog-owner service identity');
assert.match(worker,/live\.ertflix\.gr/,'ERTFlix adapter must use the current official public ERTFlix web surface');
assert.match(worker,/\/api\/catalog/,'media worker must expose catalog read endpoint');
assert.match(worker,/\/api\/series\//,'media worker must expose bounded series-details endpoint');
assert.doesNotMatch(worker,/D1|prepare\(|\.put\(|\.delete\(/,'phase 1 media adapter must remain read-only and persistence-free');
assert.doesNotMatch(worker,/api\.search\.brave|BRAVE_API_KEY/,'media catalog must not use paid Brave search');

assert.match(media,/id="media-status"/,'media page must expose catalog status');
assert.match(media,/id="media-catalog"/,'media page must expose a catalog surface');
assert.match(media,/id="media-detail"/,'media page must expose a series detail surface');
assert.match(media,/src="\.\/src\/media-page\.js\?v=/,'media page must load its dedicated client');

assert.match(client,/webtv-media\.atonis\.workers\.dev/,'media client must use the dedicated media catalog worker');
assert.match(client,/api\/catalog/,'media client must load the catalog');
assert.match(client,/api\/series\//,'media client must load exact series details');
assert.doesNotMatch(client,/WebTVPlaybackAPI|WebTVMyPlaylistAPI|WebTVRegistryAuth/,'phase 1 media browser must not create playback or persistence coupling');

console.log('media ERTFlix catalog contract ok');
