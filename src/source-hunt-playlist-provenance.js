const $ = id => document.getElementById(id);

const KNOWN_PLAYLISTS = Object.freeze([
  {match:'hitnickgr/iptv',name:'hitnickgr/iptv · GreekChannels',url:'https://raw.githubusercontent.com/hitnickgr/iptv/refs/heads/main/GreekChannels'},
  {match:'jimgate07/grtv',name:'jimgate07/grtv · android.m3u',url:'https://raw.githubusercontent.com/jimgate07/grtv/refs/heads/master/android.m3u'},
  {match:'michatec/greek-iptv',name:'Michatec/Greek-IPTV · greek-iptv.m3u8',url:'https://raw.githubusercontent.com/Michatec/Greek-IPTV/refs/heads/main/greek-iptv.m3u8'},
  {match:'don24crk',name:'Don24crk · android.m3u',url:'https://raw.githubusercontent.com/don24crk/Don24crk-Repository/refs/heads/master/android.m3u'},
  {match:'iptv-org greece',name:'iptv-org · Greece',url:'https://iptv-org.github.io/iptv/countries/gr.m3u'},
  {match:'hanssettings greece',name:'HansSettings · Greece',url:'https://gitlab.openpli.org/openpli/hanssettings/-/raw/master/e2_hanssettings_9e_13e_19e_23e_28e_AND_rotating/userbouquet.stream_griekenland__gr_.tv?ref_type=heads'},
  {match:'hanssettings sport',name:'HansSettings · Sport',url:'https://gitlab.openpli.org/openpli/hanssettings/-/raw/master/e2_hanssettings_9e_13e_19e_23e_28e_AND_rotating/userbouquet.stream_sport.tv?ref_type=heads'},
  {match:'ciefp iptv mix',name:'Ciefp IPTV Mix',url:'https://raw.githubusercontent.com/ciefp/ciefpsettings-enigma2/master/ciefp-E2-1sat-19E/userbouquet.ciefpsettings_iptv_mix.tv'},
  {match:'free-tv/iptv',name:'Free-TV/IPTV · playlist.m3u8',url:'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8'},
  {match:'b2og iptv-org all',name:'b2og · iptv-org All',url:'https://iptv.b2og.com/o_all.m3u'},
]);

let scheduled = false;
let observer = null;
let observedHunt = null;
const observerOptions={childList:true,subtree:true,characterData:true};

function log(message){
  const box=$('diagnostic-log');
  if(!box)return;
  const stamp=new Date().toLocaleTimeString();
  box.textContent=`[${stamp}] ${message}\n${box.textContent}`.slice(0,18000);
}
function cleanUrl(value=''){
  return String(value||'').split('|')[0].trim();
}
function uniqueSources(items=[]){
  const seen=new Set();const out=[];
  for(const item of items){
    const key=String(item?.url||'').trim();
    if(!key||seen.has(key))continue;
    seen.add(key);out.push(item);
  }
  return out;
}
function inferredSource(label=''){
  const text=String(label||'').trim();
  const lower=text.toLowerCase();
  for(const source of KNOWN_PLAYLISTS){if(lower.includes(source.match))return source;}
  const github=text.match(/github:([^\s/]+\/[^\s/]+)\/(.+?\.(?:m3u8?|txt|tv))(?:\s|$)/i);
  if(github){
    const repo=github[1],file=github[2];
    return {name:`GitHub · ${repo}/${file}`,url:`https://raw.githubusercontent.com/${repo}/HEAD/${file}`};
  }
  const raw=text.match(/https?:\/\/[^\s<>"']+\.(?:m3u8?|txt|tv)(?:\?[^\s<>"']*)?/i);
  if(raw)return {name:'Source playlist',url:raw[0]};
  return null;
}
function buildProvenanceMap(){
  const map=new Map();
  const cards=[...document.querySelectorAll('#source-hunt .hunt-result')].filter(card=>!card.closest('#hunt-all-results'));
  for(const card of cards){
    const code=card.querySelector('code');
    const candidate=cleanUrl(code?.textContent||'');
    if(!/^https?:\/\//i.test(candidate))continue;
    const labels=[card.querySelector('strong')?.textContent||'',card.querySelector('span')?.textContent||'',card.textContent||''];
    const sources=uniqueSources(labels.map(inferredSource).filter(Boolean));
    if(!sources.length)continue;
    map.set(candidate,uniqueSources([...(map.get(candidate)||[]),...sources]));
  }
  return map;
}
function openPlaylist(source){
  if(!source?.url)return;
  const manager=$('playlist-manager');
  const toggle=$('playlist-manager-toggle');
  if(manager?.hidden)toggle?.click();
  setTimeout(()=>{
    const urlInput=$('playlist-add-url');
    const nameInput=$('playlist-url-name');
    if(urlInput){urlInput.value=source.url;urlInput.dispatchEvent(new Event('input',{bubbles:true}));}
    if(nameInput&&!nameInput.value)nameInput.value=source.name||'Source Hunt playlist';
    $('playlist-test-url')?.click();
    manager?.scrollIntoView?.({behavior:'smooth',block:'start'});
    log(`SOURCE PLAYLIST OPENED · ${source.name||'playlist'} · ${source.url}`);
  },80);
}
function sourceRow(source){
  const row=document.createElement('div');row.className='hunt-playlist-source-row';
  const text=document.createElement('div');const label=document.createElement('strong');const code=document.createElement('code');
  label.textContent=`Playlist source: ${source.name||'M3U source'}`;code.textContent=source.url;text.append(label,code);
  const open=document.createElement('button');open.type='button';open.className='button ghost';open.textContent='Open source playlist';open.addEventListener('click',()=>openPlaylist(source));
  row.append(text,open);return row;
}
function augmentAdvanced(){
  const root=$('hunt-all-results');if(!root)return;
  const map=buildProvenanceMap();
  for(const card of root.querySelectorAll('.hunt-all-card')){
    card.querySelector('.hunt-playlist-provenance')?.remove();
    const candidate=cleanUrl(card.querySelector('code')?.textContent||'');
    const sources=[...(map.get(candidate)||[])];
    const inferred=inferredSource(card.textContent||'');if(inferred)sources.push(inferred);
    const unique=uniqueSources(sources).slice(0,4);
    if(!unique.length)continue;
    const box=document.createElement('div');box.className='hunt-playlist-provenance';
    for(const source of unique)box.appendChild(sourceRow(source));
    const body=card.firstElementChild;body?.appendChild(box);
  }
}
function observeAgain(){if(observer&&observedHunt)observer.observe(observedHunt,observerOptions);}
function scheduleAugment(){
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    observer?.disconnect();
    try{augmentAdvanced();}finally{observeAgain();}
  });
}
function installStyles(){
  if($('source-hunt-playlist-provenance-styles'))return;
  const style=document.createElement('style');style.id='source-hunt-playlist-provenance-styles';style.textContent=`
    .hunt-playlist-provenance{display:grid;gap:6px;margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)}
    .hunt-playlist-source-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:#0d151d}
    .hunt-playlist-source-row strong{display:block;font-size:.73rem;color:#cfe6ff}
    .hunt-playlist-source-row code{display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted);font-size:.69rem;margin-top:2px}
    .hunt-playlist-source-row .button{font-size:.7rem;white-space:nowrap}
    @media(max-width:760px){.hunt-playlist-source-row{grid-template-columns:1fr}.hunt-playlist-source-row .button{justify-self:start}}
  `;document.head.appendChild(style);
}

export function installSourceHuntPlaylistProvenance(){
  installStyles();
  const hunt=$('source-hunt');if(!hunt)return;
  observedHunt=hunt;
  observer=new MutationObserver(scheduleAugment);
  observeAgain();
  scheduleAugment();
  console.info('[WebTV] Source Hunt playlist provenance loaded · Advanced results can open known source playlists');
}

installSourceHuntPlaylistProvenance();
