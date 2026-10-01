import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(repoRoot,relative),'utf8');
const registryDefault=read('src/registry-default.js');
const searchRuntime=read('src/search/search-runtime.js');
const discoveryAdapter=read('src/search/adapters/discovery-provider-adapter.js');
const legacyDiscoveryUi=read('src/discovery/discovery-ui.js');
const xtreamUi=read('src/xtream-ui.js');

assert.doesNotMatch(registryDefault,/discovery\/discovery-ui\.js/);
assert.match(searchRuntime,/curated-remote-feeds/);
assert.match(searchRuntime,/github-public-playlists/);
assert.match(searchRuntime,/recent-web-search/);
assert.match(searchRuntime,/strm-specific-discovery/);
assert.match(searchRuntime,/authorized-xtream/);
assert.match(searchRuntime,/hunt-exploration/);
assert.match(discoveryAdapter,/external-discovery-client\.js/);
assert.match(discoveryAdapter,/authorized-xtream\.js/);
assert.match(discoveryAdapter,/BLOCKED_PROVIDER=\/official\/i/);

assert.doesNotMatch(legacyDiscoveryUi,/discoverNewXtreamPreview|NEW_XTREAM_PREVIEW_PROVIDER/,'legacy Discovery shell must not own New Xtream preview calls');
assert.doesNotMatch(legacyDiscoveryUi,/discovery-xtream-(?:name|server|username|password)|discovery-preview-xtream/,'legacy Discovery shell must not render or bind New Xtream credential/test controls');
assert.doesNotMatch(legacyDiscoveryUi,/promotePreviewXtreamChannel|saveFullXtreamAccountFromCandidate/,'legacy Discovery shell must not own preview persistence actions');
assert.match(xtreamUi,/previewXtreamAccount/,'production Xtream account management must own Test / Preview');
assert.match(xtreamUi,/Test \/ Preview/,'production Xtream card must expose Test / Preview');
assert.match(xtreamUi,/webtv:xtream-preview-save-channel-request/,'production Xtream card must own explicit channel-save request');
assert.match(xtreamUi,/webtv:xtream-preview-save-account-request/,'production Xtream card must own explicit full-account-save request');

console.log('discovery entrypoint ownership PASS');
