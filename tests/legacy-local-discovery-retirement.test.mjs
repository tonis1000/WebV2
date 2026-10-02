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
const legacyUi=read('src/discovery/discovery-ui.js');
const known=read('src/known-source-collector.js');
const knownTest=read('tests/known-source-collector.test.mjs');

assert.doesNotMatch(index,/discovery\/discovery-ui\.js/,'legacy Discovery shell must remain outside the production page entrypoint');
assert.doesNotMatch(registryDefault,/discovery\/discovery-ui\.js/,'registry defaults must not load the legacy Discovery shell');

assert.doesNotMatch(legacyUi,/local-data-reader\.js|local-candidates\.js/,'legacy Discovery shell must not import retired Local owners');
assert.doesNotMatch(legacyUi,/readLocalSourceContext|collectLocalCandidates|scanLocalSources/,'legacy Discovery shell must not retain a hidden Local scan path');
assert.doesNotMatch(legacyUi,/discovery-scan-local|Find Local Sources/,'legacy Discovery shell must not render Local scan controls');
assert.doesNotMatch(legacyUi,/My Playlist',snapshot\.lanes\.myPlaylist|Saved Playlists',snapshot\.lanes\.savedPlaylists|Xtream loaded',snapshot\.lanes\.xtream/,'legacy Discovery shell must not present retired Local lanes');

assert.match(legacyUi,/discoverCuratedRemoteFeeds/,'retained legacy shell must preserve curated external capability');
assert.match(legacyUi,/discoverGithubPublicPlaylists/,'retained legacy shell must preserve GitHub external capability');
assert.match(legacyUi,/discoverRecentWebSearch/,'retained legacy shell must preserve Recent Web capability');
assert.match(legacyUi,/discoverStrmSpecific/,'retained legacy shell must preserve STRM capability');
assert.match(legacyUi,/discoverAuthorizedXtream/,'retained legacy shell must preserve Authorized Xtream capability');
assert.match(legacyUi,/verifyCandidates/,'retained legacy shell must preserve verifier capability');
assert.match(legacyUi,/promoteCandidate/,'retained legacy shell must preserve generic verified-source promotion capability');

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
