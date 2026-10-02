import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SourceRegistry } from '../src/core/source-registry.js';

const healthUi=fs.readFileSync(new URL('../src/source-health-ui.js',import.meta.url),'utf8');
const registry=fs.readFileSync(new URL('../src/core/source-registry.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

assert.doesNotMatch(
  healthUi,
  /import\s*\{[^}]*\bparseIptvUrl\b[^}]*\}\s*from\s*['"]\.\/core\/utils\.js/,
  'Source Health must not parse IPTV routes independently'
);
assert.doesNotMatch(
  healthUi,
  /import\s*\{[^}]*\bworkerUrl\b[^}]*\}\s*from\s*['"]\.\/core\/utils\.js/,
  'Source Health must not build worker routes independently'
);
assert.doesNotMatch(
  healthUi,
  /import\s*\{[^}]*\b(isHls|isDash)\b[^}]*\}\s*from\s*['"]\.\/core\/utils\.js/,
  'Source Health must not classify playable media independently'
);
assert.doesNotMatch(
  healthUi,
  /new\s+StrmResolver\s*\(/,
  'Source Health must not own a second STRM resolver'
);
assert.doesNotMatch(
  healthUi,
  /async\s+function\s+routeRows\s*\(/,
  'Source Health must not own a second route reconstruction function'
);

assert.match(
  registry,
  /async\s+getCuratedRouteDiagnostics\s*\(channel\)/,
  'SourceRegistry must expose canonical curated route diagnostics'
);
assert.match(
  main,
  /getSourceHealthRows\s*:\s*channel\s*=>\s*sources\.getCuratedRouteDiagnostics\(channel\)/,
  'Diagnostics API must delegate Source Health rows to the active SourceRegistry instance'
);
assert.match(
  healthUi,
  /WebTVDiagnosticsAPI\?\.getSourceHealthRows/,
  'Source Health must consume canonical diagnostic rows'
);

const sourceRegistry=new SourceRegistry({});
const channel={
  id:'source-health-ownership-qa',
  name:'Source Health Ownership QA',
  directUrls:[
    'https://example.test/live.m3u8',
    'https://example.test/headers.m3u8|User-Agent=WebTV-QA',
    'http://example.test/http-only.m3u8',
    'https://example.test/manifest.mpd',
    'https://example.test/video.mp4',
    'https://example.test/not-media.json',
  ],
};
const rows=await sourceRegistry.getCuratedRouteDiagnostics(channel);
const kindsFor=source=>rows.filter(row=>row.source===source).map(row=>row.kind).sort();

assert.deepEqual(kindsFor('https://example.test/live.m3u8'),['direct','worker'],'HTTPS HLS diagnostics must match canonical direct + worker routes');
assert.deepEqual(kindsFor('https://example.test/headers.m3u8'),['direct','worker+headers'],'header HLS diagnostics must preserve canonical worker+headers route identity');
assert.deepEqual(kindsFor('http://example.test/http-only.m3u8'),['worker'],'HTTP HLS diagnostics must expose only the canonical worker route');
assert.deepEqual(kindsFor('https://example.test/manifest.mpd'),['direct'],'HTTPS DASH diagnostics must expose the canonical direct route');
assert.deepEqual(kindsFor('https://example.test/video.mp4'),['direct'],'HTTPS video diagnostics must expose the canonical direct route');
assert.equal(rows.some(row=>row.source==='https://example.test/not-media.json'),false,'non-media HTTPS URLs must not appear as playback routes in Source Health');

console.log('Source Health route ownership PASS');
