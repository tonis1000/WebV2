const DASHBOARD_URL='https://free-tv.github.io/IPTV/';
const PLAYLIST_URL='https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
const CACHE_TTL_MS=5*60*1000;

let cachedSnapshot=null;
let cachedAt=0;
let inFlight=null;

function decodeHtml(value=''){
  return String(value)
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
function stripTags(value=''){return decodeHtml(String(value).replace(/<[^>]*>/g,'')).trim();}
function normalizeUrl(value=''){
  const clean=decodeHtml(String(value||'').trim()).split('|')[0].trim();
  if(!/^https?:\/\//i.test(clean))return'';
  try{return new URL(clean).href;}catch{return'';}
}
function parseExtinfMeta(line=''){
  const group=/group-title="([^"]*)"/i.exec(line)?.[1]||'';
  const comma=line.lastIndexOf(',');
  const channel=comma>=0?line.slice(comma+1).trim():'';
  return{group:decodeHtml(group),channel:decodeHtml(channel)};
}

export function parseChannelSignalSnapshot({dashboardHtml='',playlistText=''}={}){
  const problems=new Map();
  const lastSwept=/last swept\s+([0-9T:\-]+Z)/i.exec(dashboardHtml)?.[1]||'';
  const rowRe=/<tr\s+data-state="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while((match=rowRe.exec(dashboardHtml))){
    const state=String(match[1]||'').trim().toLowerCase();
    const body=match[2]||'';
    const cells=[...body.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(item=>item[1]);
    const href=/<a\s+[^>]*href="([^"]+)"/i.exec(body)?.[1]||'';
    const url=normalizeUrl(href||stripTags(cells[3]||''));
    if(!url)continue;
    problems.set(url,{
      state,
      list:stripTags(cells[0]||''),
      channel:stripTags(cells[1]||''),
      checkedAt:stripTags(cells[4]||''),
      confirmDead:state==='disputed'?true:null,
    });
  }

  const tracked=new Map();
  let meta={group:'',channel:''};
  for(const rawLine of String(playlistText||'').split(/\r?\n/)){
    const line=rawLine.trim();
    if(!line)continue;
    if(line.startsWith('#EXTINF')){meta=parseExtinfMeta(line);continue;}
    if(line.startsWith('#'))continue;
    const url=normalizeUrl(line);
    if(url)tracked.set(url,{list:meta.group,channel:meta.channel});
  }
  return{lastSwept,problems,tracked};
}

export function lookupChannelSignalUrl(snapshot={},sourceUrl=''){
  const url=normalizeUrl(sourceUrl);
  const base={source:'channel-signal',advisory:true,url,state:'not-found',channel:'',list:'',checkedAt:'',lastSwept:String(snapshot.lastSwept||''),detail:'Exact URL is not in the current Free-TV/IPTV Channel Signal snapshot.'};
  if(!url)return{...base,state:'invalid'};
  const problem=snapshot.problems?.get?.(url);
  if(problem){
    return{...base,...problem,url,detail:'External exact-URL verdict from Channel Signal; advisory only and dependent on checker location.'};
  }
  const tracked=snapshot.tracked?.get?.(url);
  if(tracked){
    return{...base,...tracked,url,state:'alive',checkedAt:String(snapshot.lastSwept||'').slice(0,10),detail:'Exact URL is tracked and absent from the current Needs attention set; Channel Signal classifies it as alive.'};
  }
  return base;
}

export async function loadChannelSignalSnapshot({fetchImpl=fetch,force=false}={}){
  const now=Date.now();
  if(!force&&cachedSnapshot&&(now-cachedAt)<CACHE_TTL_MS)return cachedSnapshot;
  if(!force&&inFlight)return inFlight;
  inFlight=(async()=>{
    const options={headers:{'User-Agent':'WebV2-Channel-Signal/1.0'},cf:{cacheTtl:300,cacheEverything:true}};
    const [dashboardResponse,playlistResponse]=await Promise.all([
      fetchImpl(DASHBOARD_URL,options),
      fetchImpl(PLAYLIST_URL,options),
    ]);
    if(!dashboardResponse.ok)throw new Error(`Channel Signal dashboard HTTP ${dashboardResponse.status}`);
    if(!playlistResponse.ok)throw new Error(`Channel Signal playlist HTTP ${playlistResponse.status}`);
    const snapshot=parseChannelSignalSnapshot({
      dashboardHtml:await dashboardResponse.text(),
      playlistText:await playlistResponse.text(),
    });
    cachedSnapshot=snapshot;cachedAt=Date.now();
    return snapshot;
  })();
  try{return await inFlight;}finally{inFlight=null;}
}

export async function lookupChannelSignalHealth(sourceUrl,options={}){
  const snapshot=await loadChannelSignalSnapshot(options);
  return lookupChannelSignalUrl(snapshot,sourceUrl);
}

export const CHANNEL_SIGNAL_DASHBOARD_URL=DASHBOARD_URL;
export const CHANNEL_SIGNAL_PLAYLIST_URL=PLAYLIST_URL;
export const CHANNEL_SIGNAL_CACHE_TTL_MS=CACHE_TTL_MS;
