import assert from 'node:assert/strict';
import { parseM3U } from '../src/core/channel-catalog.js';
import { parseIptvUrl } from '../src/core/utils.js';

const identitySafe = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="Dummy" group-title="GREEK PERIFEREIAKA", ALERT TV
https://cdn.test/alert-primary.m3u8
#EXTINF:-1 tvg-id="Dummy" group-title="GREEK PERIFEREIAKA", ALERT TV github
https://raw.githubusercontent.com/example/alert.m3u8
#EXTINF:-1 tvg-id="Dummy" group-title="GREEK PERIFEREIAKA", BHMA TV
https://cdn.test/bhma.m3u8
#EXTINF:-1 tvg-id="HLS STREAM AUTO [LIVE] - 📺 HLS [AUTO] [Generic CDN] VERIFIED" group-title="GREEK PERIFEREIAKA", EGNATIA TV
https://cdn.test/egnatia.m3u8
#EXTINF:-1 tvg-id="HLS STREAM AUTO [LIVE] - 📺 HLS [AUTO] [Generic CDN] VERIFIED" group-title="GREEK PERIFEREIAKA", ENA CHANNEL
https://cdn.test/ena.m3u8
`);

assert.equal(identitySafe.length, 4, 'placeholder/diagnostic tvg-id values must not collapse unrelated channels');
const alert = identitySafe.find(row => /alert/i.test(row.name));
assert.ok(alert, 'ALERT TV must remain present');
assert.equal(alert.directUrls.length, 2, 'ALERT primary + github wrapper must merge as one channel with two sources');
assert.equal(alert.identitySource, 'name-fallback');
assert.equal(alert.originalId, 'Dummy');
assert.equal(alert.sourceMeta.length, 2);
assert.equal(alert.sourceMeta[1].wrapperHint, 'github');

const titleHintWithTvgName = parseM3U(`#EXTM3U\n#EXTINF:-1 tvg-id="Dummy" tvg-name="ALERT TV",ALERT TV github\nhttps://raw.githubusercontent.com/example/alert-title-hint.m3u8\n`)[0];
assert.equal(titleHintWithTvgName.id, 'alerttv');
assert.equal(titleHintWithTvgName.sourceMeta[0].wrapperHint, 'github', 'source hint must come from the EXTINF title even when tvg-name is present');

const bhma = identitySafe.find(row => /bhma/i.test(row.name));
const egnatia = identitySafe.find(row => /egnatia/i.test(row.name));
const ena = identitySafe.find(row => /ena channel/i.test(row.name));
assert.ok(bhma && egnatia && ena, 'unrelated placeholder-id channels must survive independently');
assert.notEqual(egnatia.id, ena.id);

const canonical = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="ert3" group-title="GREEK PANELLADIKA", GR: ERT3
https://cdn.test/ert3-primary.m3u8
#EXTINF:-1 tvg-id="ert3" group-title="GREEK PANELLADIKA", GR: ERT3 msvdn bup
https://cdn.test/ert3-backup.m3u8
#EXTINF:-1 tvg-id="Dummy" group-title="GREEK PANELLADIKA", GR: ERT3 github
https://raw.githubusercontent.com/example/ert3.m3u8
`);
assert.equal(canonical.length, 1, 'known channel identity must merge trusted and placeholder-id alternates');
assert.equal(canonical[0].id, 'ert3');
assert.equal(canonical[0].directUrls.length, 3);
assert.equal(canonical[0].identitySource, 'canonical');
const backupMeta = canonical[0].sourceMeta.find(item => item.roleHint === 'backup');
assert.ok(backupMeta, 'BUP label must be preserved as a backup hint');
assert.equal(backupMeta.providerHint, 'msvdn');
assert.ok(canonical[0].sourceMeta.some(item => item.wrapperHint === 'github'));

const megaNews = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="mega news",GR: MEGA NEWS
https://cdn.test/meganews.m3u8
#EXTINF:-1 tvg-id="mega",GR: MEGA NEWS github
https://raw.githubusercontent.com/example/mega.m3u8
`);
assert.equal(megaNews.length, 1, 'canonical name identity must beat inconsistent third-party tvg-id values');
assert.equal(megaNews[0].id, 'meganews');
assert.equal(megaNews[0].directUrls.length, 2);

const withDirectives = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="SKAI",SKAI
#EXTVLCOPT:http-user-agent=Mozilla/5.0 Test UA
#EXTVLCOPT:http-referrer=https://player.example/watch
#EXTVLCOPT:http-origin=https://player.example
https://cdn.test/skai.m3u8
`)[0];
assert.equal(withDirectives.directUrls.length, 1);
const parsed = parseIptvUrl(withDirectives.directUrls[0]);
assert.equal(parsed.url, 'https://cdn.test/skai.m3u8');
assert.deepEqual(parsed.headers, {
  'User-Agent': 'Mozilla/5.0 Test UA',
  Referer: 'https://player.example/watch',
  Origin: 'https://player.example',
});
assert.equal(withDirectives.sourceMeta[0].requiredHeaders['User-Agent'], 'Mozilla/5.0 Test UA');

const inlineWins = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="ANT1",ANT1
#EXTVLCOPT:http-user-agent=DirectiveUA
https://cdn.test/ant1.m3u8|User-Agent=InlineUA&Referer=https%3A%2F%2Finline.example%2F
`)[0];
assert.deepEqual(parseIptvUrl(inlineWins.directUrls[0]).headers, {
  'User-Agent': 'InlineUA',
  Referer: 'https://inline.example/',
}, 'inline URL headers must remain the more specific override');

console.log('Channel Catalog identity/directive/source-hint regression PASS');
