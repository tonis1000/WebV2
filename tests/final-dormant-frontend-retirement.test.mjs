import assert from 'node:assert/strict';
import fs from 'node:fs';

const retired=[
  'src/cloud-auto-sync.js',
  'src/d1-sync-addon.js',
  'src/core/official-fallbacks.js',
  'src/discovery/discovery-ui.js',
  'src/discovery/new-xtream-preview.js'
];
for(const file of retired){
  assert.equal(fs.existsSync(new URL('../'+file,import.meta.url)),false,`${file} must remain retired after final zero-consumer proof`);
}

const rightRail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
assert.doesNotMatch(rightRail,/findDiscoveryButton/,'right rail must not retain a retired Discovery Beta compatibility lookup');
assert.doesNotMatch(rightRail,/discovery\s*\\s\*beta/i,'right rail must not infer retired Discovery Beta controls from rendered text');

const player=fs.readFileSync(new URL('../src/core/player.js',import.meta.url),'utf8');
assert.match(player,/OFFICIAL_FALLBACKS/,'active Player official fallback ownership must remain');
assert.match(player,/officialFallbackFor\s*\(/,'active Player official fallback resolver must remain');

assert.equal(fs.existsSync(new URL('../src/core/enigma2-core.js',import.meta.url)),true,'active shared Enigma2 core must remain');
const worker=fs.readFileSync(new URL('../workers/webtv-source-discovery.js',import.meta.url),'utf8');
assert.match(worker,/src\/core\/enigma2-core\.js/,'Source Discovery Worker must retain shared Enigma2 core dependency');

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(index,/Manual Source Test/,'Manual Source Test must remain');
assert.match(index,/Unified Search is the only automatic discovery surface/,'Unified Search must remain sole automatic discovery surface');
assert.doesNotMatch(index,/Discovery Beta/i,'retired Discovery Beta UI must remain absent');

const xtream=fs.readFileSync(new URL('../src/xtream-client.js',import.meta.url),'utf8');
assert.match(xtream,/previewXtreamAccount/,'active Xtream Preview client capability must remain');

console.log('Final dormant frontend surface retirement PASS');
