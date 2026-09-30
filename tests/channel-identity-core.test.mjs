import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.window = globalThis.window || {};
const identity = await import('../src/channel-identity-gr.js');

const ACTIVE_PLAYLIST_CHANNELS = [
  'ERT1','ERT2','ERT3','ERT News','ANT1','Alpha TV','SKAI','MEGA','Open TV','MEGA News','Star TV','Action 24','Kontra','tv100',
  'BARAZA TV HD Greek Hits','Baraza TV Laika','MADTV','MAD World','Panik TV','Real Music TV','ΕΡΤ SPORTS 1','ΕΡΤ SPORTS 2','ΕΡΤ SPORTS 3','ΕΡΤ SPORTS 4'
];

assert.equal(typeof identity.validateGreekChannelIdentityDefinition, 'function', 'identity core must expose a schema validator for future channels');
assert.equal(typeof identity.listGreekChannelIdentities, 'function');
assert.equal(typeof identity.resolveGreekIdentity, 'function');
assert.equal(typeof identity.channelMatchScore, 'function');

const rows = identity.listGreekChannelIdentities();
assert.ok(rows.length >= ACTIVE_PLAYLIST_CHANNELS.length, 'identity registry must cover at least the active D1 playlist');

for (const channelName of ACTIVE_PLAYLIST_CHANNELS) {
  const row = identity.resolveGreekIdentity(channelName);
  assert.ok(row, `active channel is missing from identity registry: ${channelName}`);
  assert.ok(String(row.id || '').trim(), `${channelName}: stable identity id is required`);
  assert.ok(String(row.canonicalName || row.name || '').trim(), `${channelName}: canonical name is required`);
  assert.ok(Array.isArray(row.aliases) && row.aliases.length >= 1, `${channelName}: aliases are required`);
  assert.ok(Array.isArray(row.officialNames) && row.officialNames.length >= 1, `${channelName}: at least one official name is required`);
  assert.ok(Array.isArray(row.officialRefs) && row.officialRefs.length >= 1, `${channelName}: at least one official reference is required`);
  for (const ref of row.officialRefs) {
    assert.ok(/^https:\/\//i.test(String(ref?.url || '')), `${channelName}: official reference must be HTTPS`);
    assert.ok(String(ref?.kind || '').startsWith('official-'), `${channelName}: official reference kind must be explicit`);
  }
  assert.deepEqual(identity.validateGreekChannelIdentityDefinition(row), { ok: true }, `${channelName}: current record must satisfy the same schema used for future channels`);
}

const expectedOfficialHosts = new Map([
  ['ERT1',['ert.gr']],['ERT2',['ert.gr']],['ERT News',['ertnews.gr','ert.gr']],['ΕΡΤ SPORTS 4',['ertflix.gr']],
  ['ANT1',['antenna.gr']],['Alpha TV',['alphatv.gr']],['SKAI',['skai.gr']],['MEGA',['megatv.com']],['MEGA News',['mega-news.gr','megatv.com']],
  ['Open TV',['tvopen.gr']],['Star TV',['star.gr']],['Action 24',['action24.gr']],['Kontra',['kontrachannel.gr']],['tv100',['tv100.gr']],
  ['BARAZA TV HD Greek Hits',['barazaradio.com']],['Baraza TV Laika',['barazaradio.com']],['MADTV',['mad.gr']],['MAD World',['mad.gr']],
  ['Panik TV',['panikmusic.gr']],['Real Music TV',['youtube.com','facebook.com']]
]);
for (const [channelName, hosts] of expectedOfficialHosts) {
  const row = identity.resolveGreekIdentity(channelName);
  const refHosts = new Set((row.officialRefs || []).map(ref => new URL(ref.url).hostname.replace(/^www\./,'').toLowerCase()));
  assert.ok(hosts.some(host => [...refHosts].some(actual => actual === host || actual.endsWith(`.${host}`))), `${channelName}: expected an authoritative official reference host`);
}

const variants = [
  ['ΕΡΤ 1','ERT1'],['EPT1','ERT1'],['ΕΡΤ2 ΣΠΟΡ','ERT2'],['ERT2 SPORT','ERT2'],['ERTNEWS','ERT News'],
  ['ANTENNA TV','ANT1'],['ΑΝΤ1','ANT1'],['ALPHA','Alpha TV'],['ΣΚΑΪ','SKAI'],['Mega Channel','MEGA'],['MEGA HD','MEGA'],
  ['OPEN BEYOND','Open TV'],['Star Channel','Star TV'],['ACTION24','Action 24'],['Kontra Channel','Kontra'],['TV 100','tv100'],
  ['Baraza HD Music TV Greek Hits','BARAZA TV HD Greek Hits'],['Greek Laika Baraza','Baraza TV Laika'],['MAD TV','MADTV'],['MADWORLD','MAD World'],
  ['PANIKTV','Panik TV'],['Real Music Greece TV','Real Music TV'],['ERT Sports 1','ΕΡΤ SPORTS 1'],['ERTSPORTS4','ΕΡΤ SPORTS 4']
];
for (const [variant, channelName] of variants) {
  const target = identity.resolveGreekIdentity(channelName);
  assert.ok(target, `target identity missing for ${channelName}`);
  assert.ok(identity.channelMatchScore(variant, channelName, 'exact') > 0, `variant should match ${channelName}: ${variant}`);
}

assert.equal(identity.channelMatchScore('OMEGA TV HD','MEGA','exact'), 0, 'MEGA must not match OMEGA');
assert.equal(identity.channelMatchScore('MEGA TV','MEGA News','exact'), 0, 'MEGA News must not collapse into MEGA TV');
assert.equal(identity.channelMatchScore('MAD World','MADTV','exact'), 0, 'MAD TV must not match MAD World');
assert.equal(identity.channelMatchScore('ERT Sports 4','ERT2','exact'), 0, 'ERT2 must not match an ERT Sports numbered channel');
assert.equal(identity.channelMatchScore('Baraza Greek Laika','BARAZA TV HD Greek Hits','exact'), 0, 'Baraza Hits must not match Baraza Laika');

assert.throws(() => identity.validateGreekChannelIdentityDefinition({ id:'new-tv', canonicalName:'New TV', aliases:['New TV'], officialNames:['New TV'], officialRefs:[] }, { throwOnError:true }), /official reference/i);
assert.throws(() => identity.validateGreekChannelIdentityDefinition({ id:'new-tv', canonicalName:'New TV', aliases:[], officialNames:['New TV'], officialRefs:[{kind:'official-site',url:'https://new.example/'}] }, { throwOnError:true }), /alias/i);

// Architecture regression: active matching callers must consume the shared identity core,
// not carry independent alias registries that drift over time.
const huntWorker = fs.readFileSync('workers/source-huntatonisworkersdev.js','utf8');
const discoveryWorker = fs.readFileSync('workers/webtv-source-discovery.js','utf8');
const huntFrontend = fs.readFileSync('src/source-hunt-engine.js','utf8');
assert.match(huntWorker, /src\/core\/channel-identity-gr\.js/, 'Source Hunt Worker must import the shared channel identity core');
assert.doesNotMatch(huntWorker, /aliases:\s*\[/, 'Source Hunt Worker must not keep its own alias registry');
assert.match(discoveryWorker, /src\/core\/channel-identity-gr\.js/, 'Source Discovery Worker must import the shared channel identity core');
assert.doesNotMatch(discoveryWorker, /function\s+identitySet\s*\(/, 'Source Discovery Worker must not keep a second identitySet implementation');
assert.doesNotMatch(discoveryWorker, /function\s+matchesSignals\s*\(/, 'Source Discovery Worker must use shared signal matching');
assert.match(huntFrontend, /channel-identity-gr\.js/, 'frontend Source Hunt must consume shared channel identity helpers');
assert.doesNotMatch(huntFrontend, /const\s+CHANNEL_FINGERPRINTS\s*=/, 'frontend Source Hunt must not keep a separate channel fingerprint registry');

console.log(`channel identity core contract PASS · ${ACTIVE_PLAYLIST_CHANNELS.length} active channels covered`);
