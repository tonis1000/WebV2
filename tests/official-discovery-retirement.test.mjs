import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker=fs.readFileSync('workers/webtv-source-discovery.js','utf8');
const externalClient=fs.readFileSync('src/discovery/external-discovery-client.js','utf8');
const deployWorkflow=fs.readFileSync('.github/workflows/deploy-source-discovery.yml','utf8');
const unifiedAdapter=fs.readFileSync('src/search/adapters/discovery-provider-adapter.js','utf8');

assert.equal(fs.existsSync('workers/source-discovery/official-provider-lane.js'),false);
assert.equal(fs.existsSync('workers/source-discovery/official-api-resolver.js'),false);
assert.doesNotMatch(worker,/official-provider-lane|official-api-resolver/i);
assert.doesNotMatch(externalClient,/OFFICIAL_PROVIDER_LANE|OFFICIAL_API_RESOLVER_PROVIDER|discoverOfficialProvider|discoverOfficialApi/);
assert.equal(fs.existsSync('src/discovery/discovery-ui.js'),false,'retired legacy Discovery shell must remain deleted');
assert.doesNotMatch(deployWorkflow,/\bOFFICIAL(?:_API)?=\$\(curl/);
assert.doesNotMatch(deployWorkflow,/\[\[services\]\][\s\S]*?SOURCE_VERIFIER/);
assert.doesNotMatch(deployWorkflow,/provider\\?['"]?\s*[:=]\s*['"]official-(?:provider-lane|api-resolver)/i);
assert.match(deployWorkflow,/hasOwnProperty\.call\(s\.providers\|\|\{\},'official-provider-lane'\)/);
assert.match(deployWorkflow,/hasOwnProperty\.call\(s\.providers\|\|\{\},'official-api-resolver'\)/);
assert.match(unifiedAdapter,/BLOCKED_PROVIDER=\/official\/i/);

for(const provider of ['curated-remote-feeds','github-public-playlists','recent-web-search','strm-specific-discovery']){
  assert.match(worker,new RegExp(provider.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(externalClient,new RegExp(provider.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
}

assert.equal(fs.existsSync('.github/workflows/diagnose-official-api-resolver-ert1.yml'),false,'retired official API resolver diagnostic workflow must remain deleted');
assert.equal(fs.existsSync('src/diagnostics-overlay-behavior.js'),false,'orphan Diagnostics overlay behavior must remain deleted; canonical main.js owns Diagnostics controls');
console.log('official discovery retirement contract PASS');
