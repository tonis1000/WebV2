import assert from 'node:assert/strict';

const profile = await import('../src/core/channel-profile-gr.js');
const identity = await import('../src/core/channel-identity-gr.js');

const ACTIVE_IDS = [
  'ert1','ert2','ert3','ertnews','ant1','alpha','skai','mega','open','meganews','star','action24','kontra','tv100',
  'baraza-greek-hits','baraza-laika','madtv','madworld','paniktv','realmusictv','ertsports1','ertsports2','ertsports3','ertsports4'
];

const EXPECTED_CATEGORIES = ['Γενικά','Ειδήσεις','Αθλητικά','Μουσική','Περιφερειακά'];
const STATUS = new Set(['available','pending','unavailable']);

assert.equal(profile.CHANNEL_PROFILE_SCHEMA_VERSION, 1);
assert.deepEqual([...profile.CHANNEL_PROFILE_CATEGORIES], EXPECTED_CATEGORIES);
assert.equal(typeof profile.validateChannelProfileDefinition, 'function');
assert.equal(typeof profile.getChannelProfileById, 'function');
assert.equal(typeof profile.resolveChannelProfile, 'function');
assert.equal(typeof profile.listChannelProfiles, 'function');

const rows = profile.listChannelProfiles();
assert.equal(rows.length, 24, 'exactly the 24 active My Playlist channels must have canonical profiles in Phase A');
assert.deepEqual(new Set(rows.map(row => row.id)), new Set(ACTIVE_IDS), 'profile ids must be the strict identity ids');

const expectedCategories = new Map([
  ['ert1','Γενικά'],['ert2','Αθλητικά'],['ert3','Γενικά'],['ant1','Γενικά'],['alpha','Γενικά'],['skai','Γενικά'],['mega','Γενικά'],['open','Γενικά'],['star','Γενικά'],
  ['ertnews','Ειδήσεις'],['meganews','Ειδήσεις'],['action24','Ειδήσεις'],['kontra','Ειδήσεις'],
  ['tv100','Περιφερειακά'],
  ['baraza-greek-hits','Μουσική'],['baraza-laika','Μουσική'],['madtv','Μουσική'],['madworld','Μουσική'],['paniktv','Μουσική'],['realmusictv','Μουσική'],
  ['ertsports1','Αθλητικά'],['ertsports2','Αθλητικά'],['ertsports3','Αθλητικά'],['ertsports4','Αθλητικά'],
]);

const expectedPhaseBLogos = new Map([
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
const expectedPendingLogos = new Set(['kontra','paniktv','realmusictv','ertsports1','ertsports2','ertsports3','ertsports4']);

for (const row of rows) {
  const resolvedIdentity = identity.resolveGreekIdentity(row.id);
  assert.ok(resolvedIdentity && !resolvedIdentity.legacy, `${row.id}: profile id must resolve to an active strict identity`);
  assert.equal(resolvedIdentity.id, row.id, `${row.id}: profile id must equal strict identity id`);
  assert.equal(row.country, 'GR');
  assert.equal(row.language, 'el');
  assert.equal(row.category?.primary, expectedCategories.get(row.id), `${row.id}: canonical category must match approved Phase A mapping`);
  assert.ok(EXPECTED_CATEGORIES.includes(row.category?.primary), `${row.id}: unknown canonical category`);
  assert.ok(STATUS.has(row.logo?.status), `${row.id}: explicit logo status required`);
  assert.ok(STATUS.has(row.epg?.status), `${row.id}: explicit EPG status required`);
  assert.ok(Object.isFrozen(row), `${row.id}: returned profile must be frozen`);
  assert.ok(Object.isFrozen(row.category), `${row.id}: returned category must be frozen`);
  assert.ok(Object.isFrozen(row.logo), `${row.id}: returned logo metadata must be frozen`);
  assert.ok(Object.isFrozen(row.logo.fallbacks), `${row.id}: returned logo fallback list must be frozen`);
  assert.ok(Object.isFrozen(row.epg), `${row.id}: returned EPG metadata must be frozen`);
  assert.ok(Object.isFrozen(row.epg.aliases), `${row.id}: returned EPG aliases must be frozen`);
  if (row.logo.status === 'available') {
    assert.match(String(row.logo.preferredUrl || ''), /^https:\/\//i, `${row.id}: available logo requires HTTPS URL`);
    assert.ok(String(row.logo.sourceKind || '').trim(), `${row.id}: available logo requires provenance kind`);
  }
  if (row.logo.status === 'pending') assert.equal(String(row.logo.preferredUrl || ''), '', `${row.id}: pending logo must not claim a preferred URL`);
  if (expectedPhaseBLogos.has(row.id)) {
    assert.equal(row.logo.status, 'available', `${row.id}: current valid My Playlist logo must become canonical in Phase B`);
    assert.equal(row.logo.preferredUrl, expectedPhaseBLogos.get(row.id), `${row.id}: Phase B must preserve the current valid logo`);
    assert.ok(String(row.logo.sourceKind || '').trim(), `${row.id}: canonical Phase B logo requires provenance`);
  } else {
    assert.ok(expectedPendingLogos.has(row.id), `${row.id}: unexpected missing Phase B logo fixture`);
    assert.equal(row.logo.status, 'pending', `${row.id}: invalid or missing current logo must remain pending`);
  }
  if (row.epg.status === 'available') {
    assert.ok(String(row.epg.sourceId || '').trim(), `${row.id}: available EPG requires sourceId`);
    assert.ok(String(row.epg.preferredId || '').trim(), `${row.id}: available EPG requires preferredId`);
  }
  assert.ok(Array.isArray(row.epg.aliases), `${row.id}: EPG aliases must be explicit array`);
  for (const forbidden of ['sources','directUrls','sourceUrl','playbackUrl']) assert.equal(Object.prototype.hasOwnProperty.call(row, forbidden), false, `${row.id}: Channel Profile root must not own ${forbidden}`);
  assert.ok(!/\.(?:m3u8|mpd|mp4|webm|ts)(?:[?"\\]|$)/i.test(JSON.stringify(row)), `${row.id}: Channel Profile must not contain stream URLs`);
  assert.deepEqual(profile.validateChannelProfileDefinition(row), { ok: true }, `${row.id}: current profile must satisfy the future-channel validator`);
}

assert.equal(profile.getChannelProfileById('kontra')?.logo.status, 'pending', 'Kontra goo.gl logo must not be promoted to canonical metadata');

const badBase = {
  id:'ert1',country:'GR',language:'el',category:{primary:'Γενικά'},
  logo:{status:'pending',preferredUrl:'',sourceKind:'',sourceUrl:'',fallbacks:[]},
  epg:{status:'pending',sourceId:null,preferredId:null,aliases:[]},
};
assert.equal(profile.validateChannelProfileDefinition({...badBase, category:{primary:'Lifestyle'}}).ok, false, 'unknown category must fail');
assert.equal(profile.validateChannelProfileDefinition({...badBase, country:''}).ok, false, 'country is required');
assert.equal(profile.validateChannelProfileDefinition({...badBase, language:''}).ok, false, 'language is required');
assert.equal(profile.validateChannelProfileDefinition({...badBase, logo:{preferredUrl:'',sourceKind:'',sourceUrl:'',fallbacks:[]}}).ok, false, 'logo status is required');
assert.equal(profile.validateChannelProfileDefinition({...badBase, logo:{status:'available',preferredUrl:'http://example.test/logo.png',sourceKind:'official-site',sourceUrl:'',fallbacks:[]}}).ok, false, 'available logo must be HTTPS');
assert.equal(profile.validateChannelProfileDefinition({...badBase, epg:{...badBase.epg,playbackUrl:'https://example.test/live.m3u8'}}).ok, false, 'nested EPG playback fields must fail');
assert.equal(profile.validateChannelProfileDefinition({...badBase, logo:{...badBase.logo,sourceUrl:'https://example.test/live.mpd'}}).ok, false, 'logo provenance must not be a media stream URL');
assert.equal(profile.validateChannelProfileDefinition({...badBase, logo:{...badBase.logo,sourceUrl:'rtmp://example.test/live'}}).ok, false, 'non-http media stream schemes must fail');

const compatibility = [
  ['ert1','ert1'],['ERT1','ert1'],['meganews','meganews'],['MEGA News','meganews'],
  ['barazatvhdgreekhits','baraza-greek-hits'],['BARAZA TV HD Greek Hits','baraza-greek-hits'],
  ['barazatvlaika','baraza-laika'],['Baraza TV Laika','baraza-laika'],
  ['panik-tv','paniktv'],['Panik TV','paniktv'],['Real Music TV','realmusictv'],['ertsports4','ertsports4'],['ΕΡΤ SPORTS 4','ertsports4']
];
for (const [value, expectedId] of compatibility) {
  assert.equal(profile.resolveChannelProfile(value)?.id, expectedId, `profile lookup compatibility failed for ${value}`);
}

console.log(`channel profile core contract PASS · ${rows.length} active profiles covered`);
