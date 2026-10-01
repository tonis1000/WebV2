import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(repoRoot,relative),'utf8');
const registryDefault=read('src/registry-default.js');
const searchRuntime=read('src/search/search-runtime.js');
const discoveryAdapter=read('src/search/adapters/discovery-provider-adapter.js');

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

console.log('discovery entrypoint ownership PASS');
