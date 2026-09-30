import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listChannelProfiles } from '../src/core/channel-profile-gr.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const expectedLogos = new Map([
  ['ert1','https://i.imgur.com/slE8U5m.png'],
  ['ert2','https://upload.wikimedia.org/wikipedia/commons/5/50/%CE%95%CE%A1%CE%A42.png'],
  ['ert3','https://i.imgur.com/f2l9bDR.png'],
  ['ertnews','https://i.imgur.com/XwLTzaF.jpg'],
  ['ant1','https://i.imgur.com/V1w22Or.png'],
  ['alpha','https://i.imgur.com/6twzd38.png'],
  ['skai','https://i.imgur.com/mrKRFnf.png'],
  ['mega','https://i.ibb.co/f2rCKjh/mega.jpg'],
  ['open','https://i.imgur.com/M6XG03v.png'],
  ['meganews','https://www.alteregomedia.org/wp-content/uploads/2025/04/MEGA-IDENT.png'],
  ['star','https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/STAR_Channel.png/250px-STAR_Channel.png'],
  ['action24','https://i.imgur.com/Fsnz8GK.png'],
  ['tv100','https://i.imgur.com/Qx5MEbl.png'],
  ['baraza-greek-hits','https://i.imgur.com/gjf9q2g.png'],
  ['baraza-laika','https://i.imgur.com/NlN4lmc.png'],
  ['madtv','https://upload.wikimedia.org/wikipedia/commons/2/23/MADtv_logo.png'],
  ['madworld','https://i.imgur.com/zoS5RWU.png'],
]);

const pendingLogoIds = new Set(['kontra','paniktv','realmusictv','ertsports1','ertsports2','ertsports3','ertsports4']);
const profiles = listChannelProfiles();
assert.equal(profiles.length, 24, 'Phase B still covers exactly the 24 promoted My Playlist channels');

for (const row of profiles) {
  if (expectedLogos.has(row.id)) {
    assert.equal(row.logo.status, 'available', `${row.id}: current valid My Playlist logo must become canonical`);
    assert.equal(row.logo.preferredUrl, expectedLogos.get(row.id), `${row.id}: canonical logo must preserve current valid rendering`);
    assert.ok(String(row.logo.sourceKind || '').trim(), `${row.id}: canonical logo requires provenance kind`);
  } else {
    assert.ok(pendingLogoIds.has(row.id), `${row.id}: unexpected missing Phase B logo fixture`);
    assert.equal(row.logo.status, 'pending', `${row.id}: invalid or missing current logo must remain pending`);
    assert.equal(row.logo.preferredUrl, '', `${row.id}: pending logo must not claim a canonical URL`);
  }
}

const kontra = profiles.find(row => row.id === 'kontra');
assert.equal(kontra.logo.status, 'pending', 'Kontra goo.gl logo must not be promoted to canonical metadata');

const main = read('src/main.js');
const logoUtils = read('src/logo-utils.js');
const epg = read('src/core/epg.js');
const channelCatalog = read('src/core/channel-catalog.js');
assert.match(main, /channel-profile-gr\.js/, 'Phase B My Playlist runtime must consume Channel Profiles');
assert.match(main, /resolveChannelProfile/, 'Phase B runtime must resolve canonical metadata through Channel Profiles');
assert.match(main, /profile\?\.category\?\.primary/, 'cloud My Playlist category must prefer the canonical Channel Profile category');
assert.match(main, /profile\?\.logo\?\.status\s*===\s*['"]available['"]/, 'cloud My Playlist logo must prefer canonical available profile logo');
assert.match(main, /safeLogo\(c\.logo\|\|['"]{2}\)/, 'cloud My Playlist must retain sanitized D1 logo as transition fallback for pending profiles');
assert.match(channelCatalog, /sourceTrust:\s*['"]temporary['"]/, 'imported M3U metadata must remain temporary in Phase B');
assert.doesNotMatch(logoUtils, /channel-profile-gr\.js/, 'logo-utils must remain sanitation/rendering only');
assert.doesNotMatch(epg, /channel-profile-gr\.js/, 'Phase B must not start EPG ownership migration');

console.log('channel profile Phase B RED/GREEN contract PASS');
