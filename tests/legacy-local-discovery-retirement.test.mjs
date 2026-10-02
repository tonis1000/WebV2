import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const exists=rel=>fs.existsSync(path.join(root,rel));

assert.equal(exists('src/discovery/local-data-reader.js'),false,'legacy Local Discovery data reader must be deleted after zero-consumer proof');
assert.equal(exists('src/discovery/local-candidates.js'),false,'legacy Local Discovery candidate builder must be deleted after canonical migration');
assert.equal(exists('tests/discovery-local-sources.test.mjs'),false,'legacy Local Discovery unit test must retire with the deleted owner');

const index=read('index.html');
const registryDefault=read('src/registry-default.js');
const searchRuntime=read('src/search/search-runtime.js');
const discoveryAdapter=read('src/search/adapters/discovery-provider-adapter.js');
const known=read('src/known-source-collector.js');
const knownTest=read('tests/known-source-collector.test.mjs');

assert.doesNotMatch(index,/discovery\/discovery-ui\.js/,'legacy Discovery shell must remain outside the production page entrypoint');
assert.doesNotMatch(registryDefault,/discovery\/discovery-ui\.js/,'registry defaults must not load the legacy Discovery shell');

assert.equal(exists('src/discovery/discovery-ui.js'),false,'legacy Discovery shell must remain deleted after Unified Search consolidation');
assert.match(searchRuntime,/curated-remote-feeds/,'Unified Search must retain curated external capability');
assert.match(searchRuntime,/github-public-playlists/,'Unified Search must retain GitHub external capability');
assert.match(searchRuntime,/recent-web-search/,'Unified Search must retain Recent Web capability');
assert.match(searchRuntime,/strm-specific-discovery/,'Unified Search must retain STRM capability');
assert.match(searchRuntime,/authorized-xtream/,'Unified Search must retain Authorized Xtream capability');
assert.match(discoveryAdapter,/external-discovery-client\.js/,'Unified Search discovery adapter must retain external discovery client');
assert.match(discoveryAdapter,/authorized-xtream\.js/,'Unified Search discovery adapter must retain authorized Xtream capability');

assert.match(known,/savedPlaylists/,'canonical known-source owner must retain Saved Playlist awareness');
assert.match(known,/customPlaylists/,'canonical known-source owner must retain Custom Playlist awareness');
assert.match(known,/myPlaylist/,'canonical known-source owner must retain My Playlist awareness');
assert.match(known,/loadedCatalog/,'canonical known-source owner must retain already-loaded catalog awareness');
for(const forbidden of ['search-orchestrator','external-discovery-client','local-data-reader','source-hunt','fetch(']){
  assert.equal(known.includes(forbidden),false,`canonical known-source collector must not depend on ${forbidden}`);
}
assert.match(knownTest,/saved-m3u/,'canonical regression must retain Saved M3U known-source coverage');
assert.match(knownTest,/different channel sources must never merge/,'canonical regression must retain channel-isolation coverage');

console.log('Legacy Local Discovery retirement PASS');
