import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseEnigma2 } from '../workers/webtv-source-discovery.js';

const source = fs.readFileSync(new URL('../workers/webtv-source-discovery.js', import.meta.url), 'utf8');

assert.match(source, /enigma2-core\.js/,
  'Source Discovery must consume the shared Enigma2 structural core');
assert.doesNotMatch(source, /function\s+parseEnigma2\s*\([^)]*\)\s*\{[\s\S]*?split\(['"]\\n['"]\)/,
  'Source Discovery must not keep its own line-level Enigma2 structural parser');
assert.match(source, /selectEnigma2BouquetServices\s*\(/,
  'Source Discovery must derive neutral service structure through the shared core selective API');

const channel={id:'skai',originalId:'SKAI',name:'SKAI',tvgId:'Skai.gr'};
const fixture=`#NAME Greek\n#SERVICE 4097:0:1:0:0:0:0:0:0:0:https%3A//cdn.example.test/skai/master.m3u8:SKAI\n#DESCRIPTION SKAI\n#SERVICE 1:0:1:0:0:0:0:0:0:0:rtsp%3A//camera.example.test/live:SKAI\n#DESCRIPTION SKAI\n#SERVICE 5002:0:1:0:0:0:0:0:0:0:https%3A//cdn.example.test/skai/live.mpd:SKAI\n#DESCRIPTION SKAI\n`;
const candidates=parseEnigma2(fixture,channel,{name:'fixture-enigma',format:'enigma2'});
assert.deepEqual(candidates.map(item=>item.sourceType),['hls','dash'],
  'Discovery keeps its existing service-type acceptance policy after structural migration');
assert.deepEqual(candidates.map(item=>item.sourceUrl),[
  'https://cdn.example.test/skai/master.m3u8',
  'https://cdn.example.test/skai/live.mpd',
]);
assert.ok(candidates.every(item=>item.sourceOrigin==='fixture-enigma'));

console.log('Source Discovery Enigma2 parity tests PASS');
