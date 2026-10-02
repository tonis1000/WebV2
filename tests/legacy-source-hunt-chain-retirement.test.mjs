import assert from 'node:assert/strict';
import fs from 'node:fs';

const retired=[
  'src/source-hunt-engine.js',
  'src/source-hunt-web.js',
  'src/source-hunt-save-destination.js',
  'src/source-hunt-discovery-integration.js',
  'src/source-hunt-enigma2.js',
  'src/source-hunt-playlist-provenance.js'
];

for(const file of retired){
  assert.equal(fs.existsSync(new URL('../'+file,import.meta.url)),false,`${file} must remain retired after zero-consumer proof`);
}

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const searchRuntime=fs.readFileSync(new URL('../src/search/search-runtime.js',import.meta.url),'utf8');
const discoveryAdapter=fs.readFileSync(new URL('../src/search/adapters/discovery-provider-adapter.js',import.meta.url),'utf8');
const m3uCore=fs.readFileSync(new URL('../src/core/m3u-container.js',import.meta.url),'utf8');
const strmCore=fs.readFileSync(new URL('../src/core/strm-resolver.js',import.meta.url),'utf8');

assert.match(index,/Manual Source Test/,'Manual Source Test must remain in production');
assert.match(index,/Unified Search is the only automatic discovery surface/,'Unified Search must remain the sole automatic discovery surface');
assert.match(index,/src\/search\/search-ui\.js/,'Unified Search UI must remain loaded');
assert.match(searchRuntime,/hunt-exploration/,'Unified Search must retain Hunt exploration lane');
assert.match(searchRuntime,/curated-remote-feeds/,'Unified Search must retain curated discovery lane');
assert.match(searchRuntime,/recent-web-search/,'Unified Search must retain recent-web discovery lane');
assert.match(searchRuntime,/strm-specific-discovery/,'Unified Search must retain STRM discovery lane');
assert.match(searchRuntime,/authorized-xtream/,'Unified Search must retain authorized Xtream lane');
assert.match(discoveryAdapter,/external-discovery-client\.js/,'Unified Search discovery adapter must remain active');
assert.match(m3uCore,/parseM3uContainer/,'shared M3U parser must remain active');
assert.match(strmCore,/resolveStrmReference/,'shared STRM resolver must remain active');
assert.equal(fs.existsSync(new URL('../workers/source-hunt-bouquet-proxy.js',import.meta.url)),true,'Enigma2 bouquet Worker capability must remain');
assert.equal(fs.existsSync(new URL('../workers/source-huntatonisworkersdev.js',import.meta.url)),true,'Source Hunt Worker capability must remain');

console.log('Legacy Source Hunt frontend chain retirement PASS');
