import assert from 'node:assert/strict';
import {
  canonicalizeStrmReference,
  isStrmReference,
  parseKodiHeaderSuffix,
  parseStrmDocument,
} from '../src/core/strm-core.js';

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  throw new Error('shared STRM core must not fetch');
};

try {
  assert.equal(canonicalizeStrmReference(''), '');
  assert.equal(canonicalizeStrmReference('not a url'), '');
  assert.equal(
    canonicalizeStrmReference('https://github.com/acme/repo/blob/main/live/ert1.strm'),
    'https://raw.githubusercontent.com/acme/repo/main/live/ert1.strm',
  );
  assert.equal(
    canonicalizeStrmReference('https://github.com/acme/repo/blob/main/live/ert1.strm|User-Agent=UA'),
    'https://raw.githubusercontent.com/acme/repo/main/live/ert1.strm',
  );

  assert.equal(isStrmReference('https://example.test/live.strm'), true);
  assert.equal(isStrmReference('https://example.test/live.strm?token=1'), true);
  assert.equal(isStrmReference('https://example.test/live.m3u8'), false);

  assert.deepEqual(
    parseKodiHeaderSuffix('https://media.test/live.m3u8|User-Agent=FixtureUA&Referer=https%3A%2F%2Fexample.test%2Fwatch&Origin=https%3A%2F%2Fexample.test'),
    {
      'User-Agent': 'FixtureUA',
      Referer: 'https://example.test/watch',
      Origin: 'https://example.test',
    },
  );
  assert.deepEqual(
    parseKodiHeaderSuffix('https://media.test/live.m3u8|Referrer=https%3A%2F%2Fexample.test%2F'),
    { Referer: 'https://example.test/' },
  );

  const parsed = parseStrmDocument(`\n# comment\n#KODIPROP:inputstream.adaptive.license_type=com.widevine.alpha\n#KODIPROP:INPUTSTREAM.ADAPTIVE.LICENSE_KEY=https://license.test/key\nhttps://media.test/live.mpd|User-Agent=FixtureUA&Referer=https%3A%2F%2Fexample.test%2F\nhttps://ignored.test/second.m3u8\n`);
  assert.equal(parsed.mediaUrl, 'https://media.test/live.mpd|User-Agent=FixtureUA&Referer=https%3A%2F%2Fexample.test%2F');
  assert.deepEqual(parsed.requiredHeaders, {
    'User-Agent': 'FixtureUA',
    Referer: 'https://example.test/',
  });
  assert.deepEqual(parsed.drm, {
    detected: true,
    licenseType: 'com.widevine.alpha',
    licenseKey: 'https://license.test/key',
  });
  assert.ok(parsed.directives.includes('#KODIPROP:inputstream.adaptive.license_type=com.widevine.alpha'));
  assert.deepEqual(parsed.valueLines, [
    'https://media.test/live.mpd|User-Agent=FixtureUA&Referer=https%3A%2F%2Fexample.test%2F',
    'https://ignored.test/second.m3u8',
  ]);

  const nested = parseStrmDocument('https://example.test/nested.strm\n');
  assert.equal(nested.mediaUrl, 'https://example.test/nested.strm');
  assert.equal(isStrmReference(nested.mediaUrl), true);

  assert.equal(fetchCalls, 0, 'shared STRM core must be pure and never perform network fetches');
  console.log('shared STRM core tests PASS');
} finally {
  globalThis.fetch = originalFetch;
}
