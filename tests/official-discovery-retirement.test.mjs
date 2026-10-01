import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker=fs.readFileSync('workers/webtv-source-discovery.js','utf8');
const externalClient=fs.readFileSync('src/discovery/external-discovery-client.js','utf8');
const legacyUi=fs.readFileSync('src/discovery/discovery-ui.js','utf8');
const deployWorkflow=fs.readFileSync('.github/workflows/deploy-source-discovery.yml','utf8');
const unifiedAdapter=fs.readFileSync('src/search/adapters/discovery-provider-adapter.js','utf8');

assert.equal(fs.existsSync('workers/source-discovery/official-provider-lane.js'),false);
assert.equal(fs.existsSync('workers/source-discovery/official-api-resolver.js'),false);
assert.doesNotMatch(worker,/official-provider-lane|official-api-resolver/i);
assert.doesNotMatch(externalClient,/OFFICIAL_PROVIDER_LANE|OFFICIAL_API_RESOLVER_PROVIDER|discoverOfficialProvider|discoverOfficialApi/);
assert.doesNotMatch(legacyUi,/Find Official Sources|discovery-scan-official|scanOfficial/);
assert.doesNotMatch(deployWorkflow,/OFFICIAL_API|OFFICIAL=|official-provider-lane|official-api-resolver|SOURCE_VERIFIER/);
assert.match(unifiedAdapter,/BLOCKED_PROVIDER=\/official\/i/);

for(const provider of ['curated-remote-feeds','github-public-playlists','recent-web-search','strm-specific-discovery']){
  assert.match(worker,new RegExp(provider.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(externalClient,new RegExp(provider.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
}

console.log('official discovery retirement contract PASS');
