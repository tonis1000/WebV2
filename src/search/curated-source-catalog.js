export const CURATED_SOURCE_FEEDS=Object.freeze([
  Object.freeze({id:'hitnickgr-iptv',name:'hitnickgr/iptv',label:'hitnickgr/iptv',url:'https://raw.githubusercontent.com/hitnickgr/iptv/refs/heads/main/GreekChannels',format:'m3u',tier:'primary',enabled:true,priority:'high'}),
  Object.freeze({id:'jimgate07-grtv',name:'jimgate07/grtv',label:'jimgate07/grtv',url:'https://raw.githubusercontent.com/jimgate07/grtv/refs/heads/master/android.m3u',format:'m3u',tier:'primary',enabled:true,priority:'high'}),
  Object.freeze({id:'michatec-greek-iptv',name:'Michatec/Greek-IPTV',label:'Michatec/Greek-IPTV',url:'https://raw.githubusercontent.com/Michatec/Greek-IPTV/refs/heads/main/greek-iptv.m3u8',format:'m3u',tier:'primary',enabled:true,priority:'high'}),
  Object.freeze({id:'don24crk',name:'Don24crk',label:'Don24crk',url:'https://raw.githubusercontent.com/don24crk/Don24crk-Repository/refs/heads/master/android.m3u',format:'m3u',tier:'primary',enabled:true,priority:'high'}),
  Object.freeze({id:'iptv-org-gr',name:'iptv-org Greece',label:'iptv-org Greece',url:'https://iptv-org.github.io/iptv/countries/gr.m3u',format:'m3u',tier:'primary',enabled:true,priority:'high'}),
  Object.freeze({id:'iptv-nexus-gr',name:'IPTV Nexus Greece',label:'IPTV Nexus Greece',url:'https://dearbulut.github.io/iptv/playlists/country/gr.m3u',format:'m3u',tier:'primary',enabled:true,priority:'high'}),
  Object.freeze({id:'free-tv-iptv-gr',name:'Free-TV/IPTV Greece',label:'Free-TV/IPTV Greece',url:'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_greece.m3u8',format:'m3u',tier:'primary',enabled:true,priority:'high'}),
  Object.freeze({id:'hanssettings-gr',name:'HansSettings Greece',label:'HansSettings Greece',url:'https://gitlab.openpli.org/openpli/hanssettings/-/raw/master/e2_hanssettings_9e_13e_19e_23e_28e_AND_rotating/userbouquet.stream_griekenland__gr_.tv?ref_type=heads',format:'enigma2',tier:'primary',enabled:true,priority:'high'}),
  Object.freeze({id:'hanssettings-sport',name:'HansSettings Sport',label:'HansSettings Sport',url:'https://gitlab.openpli.org/openpli/hanssettings/-/raw/master/e2_hanssettings_9e_13e_19e_23e_28e_AND_rotating/userbouquet.stream_sport.tv?ref_type=heads',format:'enigma2',tier:'primary',enabled:true,priority:'normal'}),
  Object.freeze({id:'musics300-total',name:'musics300/total',label:'musics300/total',url:'https://raw.githubusercontent.com/musics300/total/refs/heads/main/TOTAL.m3u',format:'m3u',tier:'fallback',enabled:true,priority:'normal'}),
  Object.freeze({id:'gdiolitsis-greek-iptv',name:'gdiolitsis/greek-iptv',label:'gdiolitsis/greek-iptv',url:'https://raw.githubusercontent.com/gdiolitsis/greek-iptv/refs/heads/master/ForestRock_GR',format:'m3u',tier:'fallback',enabled:true,priority:'normal'}),
  Object.freeze({id:'ciefp-iptv-mix',name:'Ciefp IPTV Mix',label:'Ciefp IPTV Mix',url:'https://raw.githubusercontent.com/ciefp/ciefpsettings-enigma2/master/ciefp-E2-1sat-19E/userbouquet.ciefpsettings_iptv_mix.tv',format:'enigma2',tier:'fallback',enabled:true,priority:'normal'}),
  Object.freeze({id:'b2og-iptv-org-all',name:'b2og iptv-org All',label:'b2og iptv-org All',url:'https://iptv.b2og.com/o_all.m3u',format:'m3u',tier:'fallback',enabled:true,priority:'normal'}),
]);

export function listCuratedSourceFeeds({enabledOnly=false}={}){
  const rows=enabledOnly?CURATED_SOURCE_FEEDS.filter(item=>item.enabled!==false):CURATED_SOURCE_FEEDS;
  return rows.map(item=>Object.freeze({...item}));
}
