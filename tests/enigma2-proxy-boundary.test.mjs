import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../workers/source-hunt-bouquet-proxy.js',import.meta.url),'utf8');

assert.match(source,/url\.protocol!==['"]https:['"]/,'bouquet proxy remains HTTPS-only');
assert.match(source,/ALLOWED_HOSTS/,'bouquet proxy retains upstream host allowlist ownership');
assert.match(source,/MAX_BYTES/,'bouquet proxy retains response-size ownership');
assert.match(source,/TIMEOUT_MS/,'bouquet proxy retains timeout ownership');
assert.match(source,/AbortController/,'bouquet proxy retains network cancellation ownership');
assert.match(source,/Upstream response is not an Enigma2 bouquet/,'bouquet proxy retains shallow format sanity rejection');
assert.doesNotMatch(source,/parseEnigma2Bouquet|enigma2-core\.js/,'bouquet proxy must not become a structural Enigma2 parser consumer');
assert.doesNotMatch(source,/channelMatchScore|saveEligible|verificationStatus/,'bouquet proxy must not absorb candidate/product policy');

console.log('Enigma2 bouquet proxy boundary PASS');
