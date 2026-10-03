import assert from 'node:assert/strict';
import {
  resolveChannelLogo,
  sanitizeLogoCandidate,
  logoTrustForSourceKind,
  VERIFIED_LOGO_SOURCE_KINDS,
} from '../src/core/channel-logo.js';

assert.ok(VERIFIED_LOGO_SOURCE_KINDS.includes('official-broadcaster'));
assert.ok(VERIFIED_LOGO_SOURCE_KINDS.includes('wikimedia-commons'));
assert.equal(logoTrustForSourceKind('official-publisher-site'),'verified');
assert.equal(logoTrustForSourceKind('curated-third-party'),'curated');
assert.equal(logoTrustForSourceKind('playlist-tvg-logo'),'unverified');
assert.equal(logoTrustForSourceKind(''),'none');

assert.equal(sanitizeLogoCandidate('javascript:alert(1)'),'');
assert.equal(sanitizeLogoCandidate('https://goo.gl/example'),'');
assert.equal(sanitizeLogoCandidate(' https://example.test/logo.png '),'https://example.test/logo.png');

const official=resolveChannelLogo({
  id:'meganews',
  providedLogo:'https://playlist.example.test/meganews.png',
  providedSourceKind:'playlist-tvg-logo',
});
assert.equal(official.verified,true,'official profile logo must be verified');
assert.equal(official.trust,'verified');
assert.equal(official.sourceKind,'official-publisher-site');
assert.match(official.url,/alteregomedia\.org/);
assert.equal(official.origin,'channel-profile');

const commons=resolveChannelLogo({
  id:'ert2',
  providedLogo:'https://playlist.example.test/ert2.png',
  providedSourceKind:'playlist-tvg-logo',
});
assert.equal(commons.verified,true,'Wikimedia Commons profile logo must be verified fallback provenance');
assert.equal(commons.sourceKind,'wikimedia-commons');
assert.match(commons.url,/wikimedia\.org/);

const curated=resolveChannelLogo({
  id:'skai',
  providedLogo:'https://playlist.example.test/skai.png',
  providedSourceKind:'playlist-tvg-logo',
});
assert.equal(curated.verified,false,'legacy curated third-party image host must not be mislabeled verified');
assert.equal(curated.trust,'curated');
assert.equal(curated.sourceKind,'curated-third-party');
assert.match(curated.url,/imgur\.com/);

const future=resolveChannelLogo({
  id:'future-channel-42',
  name:'Future Channel 42',
  providedLogo:'https://provider.example.test/future.png',
  providedSourceKind:'playlist-tvg-logo',
});
assert.equal(future.status,'available','unknown future channel must be usable immediately when it carries a valid logo');
assert.equal(future.url,'https://provider.example.test/future.png');
assert.equal(future.verified,false,'playlist logo must remain explicitly unverified');
assert.equal(future.trust,'unverified');
assert.equal(future.origin,'channel-provided');

const promoted=resolveChannelLogo({
  id:'skai',
  providedLogo:'https://official.example.test/skai.svg',
  providedSourceKind:'registry-verified',
  providedSourceUrl:'https://official.example.test/brand',
});
assert.equal(promoted.verified,true,'future verified Registry metadata must outrank curated third-party profile data');
assert.equal(promoted.url,'https://official.example.test/skai.svg');
assert.equal(promoted.sourceKind,'registry-verified');

const missing=resolveChannelLogo({id:'future-channel-no-logo',name:'Future Channel'});
assert.deepEqual(
  {...missing},
  {status:'pending',url:'',sourceKind:'',sourceUrl:'',origin:'none',profileId:'',trust:'none',verified:false},
  'missing logos must fail closed to placeholder state'
);

console.log('channel logo resolution contract PASS');
