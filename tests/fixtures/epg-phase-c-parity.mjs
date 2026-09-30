export const EPG_PHASE_C_BASELINE_COMMIT = 'baab84c6998f6b1b81dc964b097e8c7308737bf3';
export const EPG_PARITY_NOW_ISO = '2026-09-30T18:15:00.000Z';

export const EPG_FEED_INDEX_FIXTURE = Object.freeze([
  { id:'ERT1.gr', keys:['ert1'] },
  { id:'ERT2.gr', keys:['ert2'] },
  { id:'ERT3.gr', keys:['ert3'] },
  { id:'ERTNEWS.gr', keys:['ertnews'] },
  { id:'ANT1.gr', keys:['ant1'] },
  { id:'ALPHA.gr', keys:['alpha'] },
  { id:'SKAI.gr', keys:['skai'] },
  { id:'MEGA.gr', keys:['mega'] },
  { id:'OPEN.gr', keys:['open'] },
  { id:'MEGA.News.gr', keys:['meganews'] },
  { id:'STAR.gr', keys:['star'] },
  { id:'ACTION24.gr', keys:['action24'] },
  { id:'KONTRA.gr', keys:['kontra'] },
  { id:'TV100.gr', keys:['tv100'] },
  { id:'BARAZA.GreekHits.gr', keys:['barazagreekhits'] },
  { id:'BARAZA.Laika.gr', keys:['barazalaika'] },
  { id:'MAD.TV.gr', keys:['mad','madtv'] },
  { id:'MAD.World.gr', keys:['madworld'] },
  { id:'PANIK.TV.gr', keys:['panik','paniktv'] },
  { id:'REAL.MUSIC.TV.gr', keys:['realmusic','realmusictv'] },
  { id:'ERT.SPORTS.1.gr', keys:['ertsports1'] },
  { id:'ERT.SPORTS.2.gr', keys:['ertsports2'] },
  { id:'ERT.SPORTS.3.gr', keys:['ertsports3'] },
  { id:'ERT.SPORTS.4.gr', keys:['ertsports4'] },
]);

// These rows freeze the observable legacy resolver result before Phase C ownership migration.
// MEGA News is intentionally recorded as unsafe legacy behavior: canonicalChannelKey('meganews')
// collapses to `mega` before the exact `meganews` index is checked.
export const EPG_MY_PLAYLIST_LEGACY_PARITY = Object.freeze([
  { channel:{id:'ert1',originalId:'ERT1.gr',name:'ERT1'}, legacyResolvedId:'ERT1.gr' },
  { channel:{id:'ert2',originalId:'ERT2.gr',name:'ERT2'}, legacyResolvedId:'ERT2.gr' },
  { channel:{id:'ert3',originalId:'ERT3.gr',name:'ERT3'}, legacyResolvedId:'ERT3.gr' },
  { channel:{id:'ertnews',originalId:'ERTNEWS.gr',name:'ERT News'}, legacyResolvedId:'ERTNEWS.gr' },
  { channel:{id:'ant1',originalId:'ANT1.gr',name:'ANT1'}, legacyResolvedId:'ANT1.gr' },
  { channel:{id:'alpha',originalId:'ALPHA.gr',name:'Alpha TV'}, legacyResolvedId:'ALPHA.gr' },
  { channel:{id:'skai',originalId:'SKAI.gr',name:'SKAI'}, legacyResolvedId:'SKAI.gr' },
  { channel:{id:'mega',originalId:'MEGA.gr',name:'MEGA'}, legacyResolvedId:'MEGA.gr' },
  { channel:{id:'open',originalId:'OPEN.gr',name:'Open TV'}, legacyResolvedId:'OPEN.gr' },
  { channel:{id:'meganews',originalId:'MEGA.News.gr',name:'MEGA News'}, legacyResolvedId:'MEGA.gr', phaseCExpectedResolvedId:'MEGA.News.gr', unsafeLegacy:true },
  { channel:{id:'star',originalId:'STAR.gr',name:'Star TV'}, legacyResolvedId:'STAR.gr' },
  { channel:{id:'action24',originalId:'ACTION24.gr',name:'Action 24'}, legacyResolvedId:'ACTION24.gr' },
  { channel:{id:'kontra',originalId:'KONTRA.gr',name:'Kontra'}, legacyResolvedId:'KONTRA.gr' },
  { channel:{id:'tv100',originalId:'TV100.gr',name:'tv100'}, legacyResolvedId:'TV100.gr' },
  { channel:{id:'baraza-greek-hits',originalId:'BARAZA.GreekHits.gr',name:'BARAZA TV HD Greek Hits'}, legacyResolvedId:'BARAZA.GreekHits.gr' },
  { channel:{id:'baraza-laika',originalId:'BARAZA.Laika.gr',name:'Baraza TV Laika'}, legacyResolvedId:'BARAZA.Laika.gr' },
  { channel:{id:'madtv',originalId:'MAD.TV.gr',name:'MADTV'}, legacyResolvedId:'MAD.TV.gr' },
  { channel:{id:'madworld',originalId:'MAD.World.gr',name:'MAD World'}, legacyResolvedId:'MAD.World.gr' },
  { channel:{id:'paniktv',originalId:'PANIK.TV.gr',name:'Panik TV'}, legacyResolvedId:'PANIK.TV.gr' },
  { channel:{id:'realmusictv',originalId:'REAL.MUSIC.TV.gr',name:'Real Music TV'}, legacyResolvedId:'REAL.MUSIC.TV.gr' },
  { channel:{id:'ertsports1',originalId:'ERT.SPORTS.1.gr',name:'ΕΡΤ SPORTS 1'}, legacyResolvedId:'ERT.SPORTS.1.gr' },
  { channel:{id:'ertsports2',originalId:'ERT.SPORTS.2.gr',name:'ΕΡΤ SPORTS 2'}, legacyResolvedId:'ERT.SPORTS.2.gr' },
  { channel:{id:'ertsports3',originalId:'ERT.SPORTS.3.gr',name:'ΕΡΤ SPORTS 3'}, legacyResolvedId:'ERT.SPORTS.3.gr' },
  { channel:{id:'ertsports4',originalId:'ERT.SPORTS.4.gr',name:'ΕΡΤ SPORTS 4'}, legacyResolvedId:'ERT.SPORTS.4.gr' },
]);

// These are explicit Phase C safety requirements. They are documented now but are not
// required to pass against the legacy matcher until the separate ownership migration.
export const EPG_PHASE_C_FAILURE_CLOSED = Object.freeze([
  { channel:{id:'ant1-comedy',originalId:'ANT1Comedy',name:'ANT1 Comedy'}, legacyResolvedId:'ANT1.gr', phaseCExpectedResolvedId:null, reason:'ANT1 sibling must not borrow ANT1 guide' },
  { channel:{id:'ant1-sports-1',originalId:'ANT1 Sports 1',name:'ANT1+ Sports 1'}, legacyResolvedId:'ANT1.gr', phaseCExpectedResolvedId:null, reason:'ANT1 sports sibling must not borrow ANT1 guide' },
  { channel:{id:'star-central-greece',originalId:'STAR CENTRAL GREECE',name:'STAR ΚΕΝΤΡΙΚΗΣ ΕΛΛΑΔΑΣ'}, legacyResolvedId:'STAR.gr', phaseCExpectedResolvedId:null, reason:'regional STAR must not borrow national STAR guide' },
  { channel:{id:'omega-tv',originalId:'OMEGA TV',name:'Omega TV'}, legacyResolvedId:null, phaseCExpectedResolvedId:null, reason:'OMEGA must remain distinct from MEGA' },
  { channel:{id:'unknown-station',originalId:'UNKNOWN.STATION',name:'Unknown Station'}, legacyResolvedId:null, phaseCExpectedResolvedId:null, reason:'unknown identities fail closed' },
]);

export const EPG_OUTPUT_PARITY = Object.freeze({
  channel:{id:'ert1',originalId:'ERT1.gr',name:'ERT1'},
  resolvedId:'ERT1.gr',
  now:EPG_PARITY_NOW_ISO,
  programmes:Object.freeze([
    { start:'2026-09-30T17:00:00.000Z', stop:'2026-09-30T18:00:00.000Z', title:'Previous', description:'past' },
    { start:'2026-09-30T18:00:00.000Z', stop:'2026-09-30T19:00:00.000Z', title:'Current', description:'current description' },
    { start:'2026-09-30T19:00:00.000Z', stop:'2026-09-30T20:00:00.000Z', title:'Next 1', description:'' },
    { start:'2026-09-30T20:00:00.000Z', stop:'2026-09-30T21:00:00.000Z', title:'Next 2', description:'' },
    { start:'2026-09-30T21:00:00.000Z', stop:'2026-09-30T22:00:00.000Z', title:'Next 3', description:'' },
    { start:'2026-09-30T22:00:00.000Z', stop:'2026-09-30T23:00:00.000Z', title:'Next 4', description:'' },
  ]),
  expected:Object.freeze({ currentTitle:'Current', currentDescription:'current description', progress:25, nextTitles:Object.freeze(['Next 1','Next 2','Next 3']) }),
});
