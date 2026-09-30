import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createSourceFormatRegistry,
  detectSourceFormat,
  getSourceFormat,
  classifySourceBody,
  listSourceFormats,
  toLegacySourceType,
} from '../src/core/source-format-registry.js';
import { isHls, isDash, isVideoFile } from '../src/core/utils.js';

function pick(value, keys) {
  return Object.fromEntries(keys.map(key => [key, value[key]]));
}

const hls = detectSourceFormat({ sourceUrl: 'https://x/live.m3u8?token=1#frag' });
assert.equal(hls.formatId, 'hls');
assert.equal(hls.mediaFormatId, 'hls');
assert.equal(hls.status, 'recognized');

const dash = detectSourceFormat({ sourceUrl: 'https://x/live.mpd?token=1' });
assert.equal(dash.formatId, 'dash');
assert.equal(dash.mediaFormatId, 'dash');

assert.equal(detectSourceFormat({ sourceUrl: 'https://x/video.mp4' }).formatId, 'direct-video');
assert.equal(detectSourceFormat({ sourceUrl: 'https://x/video.webm' }).formatId, 'direct-video');

assert.deepEqual(
  pick(detectSourceFormat({ sourceUrl: 'https://x/live?id=1' }), ['formatId', 'mediaFormatId', 'confidence']),
  { formatId: 'http-resource', mediaFormatId: 'unknown', confidence: 'transport-only' },
);
assert.equal(toLegacySourceType(detectSourceFormat({ sourceUrl: 'https://x/live?id=1' })), 'direct');

const unknown = detectSourceFormat({ sourceUrl: 'foo://host/live.xyz' });
assert.equal(unknown.status, 'unknown');
assert.equal(unknown.formatId, 'unknown');
assert.equal(unknown.mediaFormatId, 'unknown');
assert.equal(unknown.rawScheme, 'foo');
assert.equal(unknown.rawExtension, '.xyz');

for (const sourceUrl of ['rtsp://host/live', 'rtmp://host/live']) {
  const value = detectSourceFormat({ sourceUrl });
  assert.equal(value.status, 'recognized-unsupported');
  assert.equal(value.capabilities.browserPlayback, false);
}

const strm = detectSourceFormat({ sourceUrl: 'https://x/file.strm' });
assert.equal(strm.formatId, 'strm');
assert.equal(strm.capabilities.requiresResolver, true);
assert.equal(strm.capabilities.container, true);

const m3u = detectSourceFormat({ sourceUrl: 'https://x/list.m3u' });
assert.equal(m3u.formatId, 'm3u');
assert.equal(m3u.capabilities.container, true);
assert.equal(m3u.resolutionMode, 'container');

assert.equal(detectSourceFormat({ sourceUrl: 'https://x/live.m3u8', explicitType: 'dash' }).formatId, 'dash');
assert.equal(detectSourceFormat({ sourceUrl: 'https://x/live.m3u8', explicitType: 'not-a-format' }).formatId, 'hls');

const hlsBody = classifySourceBody({ body: '#EXTM3U\n#EXT-X-VERSION:3\n', contentType: 'application/vnd.apple.mpegurl' });
assert.equal(hlsBody.mediaFormatId, 'hls');
const dashBody = classifySourceBody({ body: '<MPD></MPD>', contentType: 'application/dash+xml' });
assert.equal(dashBody.mediaFormatId, 'dash');
const videoBody = classifySourceBody({ body: '', contentType: 'video/mp4' });
assert.equal(videoBody.mediaFormatId, 'direct-video');
const htmlBody = classifySourceBody({ body: '<html>nope</html>', contentType: 'text/html' });
assert.equal(htmlBody.mediaFormatId, 'unknown');

const listed = listSourceFormats();
for (const id of ['hls','dash','direct-video','http-resource','strm','m3u','rtsp','rtmp','xtream','header-aware','unknown']) {
  assert.ok(listed.some(item => item.id === id), `missing default format ${id}`);
  assert.equal(getSourceFormat(id)?.id, id);
}

const future = createSourceFormatRegistry([
  ...listed,
  {
    id: 'future-test',
    aliases: [],
    priority: 999,
    detectUrl: ({ sourceUrl }) => String(sourceUrl || '').startsWith('future://'),
    detectBody: () => false,
    capabilities: { browserPlayback: false, verifierProbe: false, requiresResolver: true, container: false, credentialed: false, live: false, vod: false },
    verificationMode: 'unsupported',
    resolutionMode: 'external',
    savePolicy: 'inspect-only',
    compatibilityType: 'unknown',
  },
]);
assert.equal(detectSourceFormat({ sourceUrl: 'future://host/item' }, future).formatId, 'future-test');
assert.equal(detectSourceFormat({ sourceUrl: 'future://host/item' }).formatId, 'unknown');

assert.equal(isHls('https://x/a.m3u8?token=1'), true);
assert.equal(isDash('https://x/a.mpd?token=1'), true);
assert.equal(isVideoFile('https://x/a.mp4?token=1'), true);
assert.equal(isVideoFile('https://x/a.webm'), true);
assert.equal(isHls('https://x/page.html'), false);

const utilsSource = fs.readFileSync(new URL('../src/core/utils.js', import.meta.url), 'utf8');
assert.match(utilsSource, /source-format-registry\.js/);
assert.match(utilsSource, /detectSourceFormat/);
assert.doesNotMatch(utilsSource, /export function isHls\([^)]*\)\s*\{\s*return\s+\/\\\.m3u8/);
assert.doesNotMatch(utilsSource, /export function isDash\([^)]*\)\s*\{\s*return\s+\/\\\.mpd/);

console.log('source format registry contract passed');
