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
  ['ert1','Γενικά'],['ert2','Γενικά'],['ert3','Γενικά'],['ant1','Γενικά'],['alpha','Γενικά'],['skai','Γενικά'],['mega','Γενικά'],['open','Γενικά'],['star','Γενικά'],
  ['ertnews','Ειδήσεις'],['meganews','Ειδήσεις'],['action24','Ειδήσεις'],['kontra','Ειδήσεις'],
  ['tv100','Περιφερειακά'],
  ['baraza-greek-hits','Μουσική'],['baraza-laika','Μουσική'],['madtv','Μουσική'],['madworld','Μουσική'],['paniktv','Μουσική'],['realmusictv','Μουσική'],
  ['ertsports1','Αθλητικά'],['ertsports2','Αθλητικά'],['ertsports3','Αθλητικά'],['ertsports4','Αθλητικά'],
]);

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
  if (row.logo.status === 'available') {
    assert.match(String(row.logo.preferredUrl || ''), /^https:\/\//i, `${row.id}: available logo requires HTTPS URL`);
    assert.ok(String(row.logo.sourceKind || '').trim(), `${row.id}: available logo requires provenance kind`);
  }
  if (row.logo.status === 'pending') assert.equal(String(row.logo.preferredUrl || ''), '', `${row.id}: pending logo must not claim a preferred URL`);
  if (row.epg.status === 'available') {
    assert.ok(String(row.epg.sourceId || '').trim(), `${row.id}: available EPG requires sourceId`);
    assert.ok(String(row.epg.preferredId || '').trim(), `${row.id}: available EPG requires preferredId`);
  }
  assert.ok(Array.isArray(row.epg.aliases), `${row.id}: EPG aliases must be explicit array`);
  const serialized = JSON.stringify(row);
  for (const forbidden of ['"sources"','"directUrls"','"sourceUrl"','"playbackUrl"']) assert.ok(!serialized.includes(forbidden), `${row.id}: Channel Profile must not own stream state`);
  assert.ok(!/\.m3u8(?:[?"\\]|$)/i.test(serialized), `${row.id}: Channel Profile must not contain stream URLs`);
  assert.deepEqual(profile.validateChannelProfileDefinition(row), { ok: true }, `${row.id}: current profile must satisfy the future-channel validator`);
}

const badBase = {
  id:'new-tv',country:'GR',language:'el',category:{primary:'Γενικά'},
  logo:{status:'pending',preferredUrl:'',sourceKind:'',sourceUrl:'',fallbacks:[]},
  epg:{status:'pending',sourceId:null,preferredId:null,aliases:[]},
};
assert.equal(profile.validateChannelProfileDefinition({...badBase, category:{primary:'Lifestyle'}}).ok, false, 'unknown category must fail');
assert.equal(profile.validateChannelProfileDefinition({...badBase, country:''}).ok, false, 'country is required');
assert.equal(profile.validateChannelProfileDefinition({...badBase, language:''}).ok, false, 'language is required');
assert.equal(profile.validateChannelProfileDefinition({...badBase, logo:{preferredUrl:'',sourceKind:'',sourceUrl:'',fallbacks:[]}}).ok, false, 'logo status is required');
assert.equal(profile.validateChannelProfileDefinition({...badBase, logo:{status:'available',preferredUrl:'http://example.test/logo.png',sourceKind:'official-site',sourceUrl:'',fallbacks:[]}}).ok, false, 'available logo must be HTTPS');

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
