const SEARCH_SOURCES = Object.freeze([
  Object.freeze({
    id:'hitnickgr-iptv',
    label:'hitnickgr/iptv',
    type:'m3u',
    location:'https://raw.githubusercontent.com/hitnickgr/iptv/refs/heads/main/GreekChannels',
    enabled:true,
    priority:'high',
  }),
  Object.freeze({
    id:'iptv-org-gr',
    label:'iptv-org Greece',
    type:'m3u',
    location:'https://iptv-org.github.io/iptv/countries/gr.m3u',
    enabled:true,
    priority:'high',
  }),
  Object.freeze({
    id:'free-tv-iptv',
    label:'Free-TV/IPTV',
    type:'m3u',
    location:'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    enabled:true,
    priority:'normal',
  }),
  Object.freeze({
    id:'hanssettings-gr',
    label:'HansSettings Greece',
    type:'enigma2',
    location:'https://gitlab.openpli.org/openpli/hanssettings/-/raw/master/e2_hanssettings_9e_13e_19e_23e_28e_AND_rotating/userbouquet.stream_griekenland__gr_.tv?ref_type=heads',
    enabled:true,
    priority:'high',
  }),
  Object.freeze({
    id:'hanssettings-sport',
    label:'HansSettings Sport',
    type:'enigma2',
    location:'https://gitlab.openpli.org/openpli/hanssettings/-/raw/master/e2_hanssettings_9e_13e_19e_23e_28e_AND_rotating/userbouquet.stream_sport.tv?ref_type=heads',
    enabled:true,
    priority:'normal',
  }),
  Object.freeze({
    id:'strm-specific-discovery',
    label:'STRM Discovery',
    type:'strm',
    location:Object.freeze({ provider:'strm-specific-discovery' }),
    enabled:true,
    priority:'normal',
  }),
  Object.freeze({
    id:'authorized-xtream',
    label:'Authorized Xtream',
    type:'xtream',
    location:Object.freeze({ provider:'authorized-xtream' }),
    enabled:true,
    priority:'normal',
  }),
]);

export function listSearchSources({ enabledOnly = false } = {}) {
  const rows = enabledOnly ? SEARCH_SOURCES.filter(item => item.enabled) : SEARCH_SOURCES;
  return rows.map(item => Object.freeze({
    ...item,
    location:item.location && typeof item.location === 'object' ? Object.freeze({ ...item.location }) : item.location,
  }));
}

export function getSearchSource(id = '') {
  const key = String(id || '').trim().toLowerCase();
  if (!key) return null;
  const item = SEARCH_SOURCES.find(source => source.id.toLowerCase() === key);
  if (!item) return null;
  return Object.freeze({
    ...item,
    location:item.location && typeof item.location === 'object' ? Object.freeze({ ...item.location }) : item.location,
  });
}
