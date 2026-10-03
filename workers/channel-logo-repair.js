const TV_LOGO_COUNTRIES = Object.freeze({
  AL:'albania', AT:'austria', BE:'belgium', BG:'bulgaria', CH:'switzerland', CY:'cyprus',
  CZ:'czech-republic', DE:'germany', DK:'denmark', EE:'estonia', ES:'spain', FI:'finland',
  FR:'france', GR:'greece', HR:'croatia', HU:'hungary', IE:'ireland', IS:'iceland',
  IT:'italy', LT:'lithuania', LU:'luxembourg', LV:'latvia', NL:'netherlands', NO:'norway',
  PL:'poland', PT:'portugal', RO:'romania', RS:'serbia', SE:'sweden', SI:'slovenia',
  SK:'slovakia', TR:'turkey', GB:'united-kingdom', UK:'united-kingdom'
});

const GENERIC_TOKENS = new Set(['tv','hd','uhd','4k','channel','live','gr','de','greece','germany']);
const MAX_PICON_CANDIDATES = 8;
const PROVIDER_TIMEOUT_MS = 5500;

function safeHttps(value=''){
  try{
    const url=new URL(String(value||'').trim());
    return url.protocol==='https:'?url.href:'';
  }catch{return'';}
}

export function normalizeLogoMatchKey(value=''){
  return String(value||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/&amp;|&/g,' and ')
    .replace(/\b(?:full\s*hd|fhd)\b/g,' hd ')
    .replace(/[^a-z0-9α-ω]+/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function significantTokens(value=''){
  return normalizeLogoMatchKey(value).split(' ').filter(Boolean).filter(token=>!GENERIC_TOKENS.has(token));
}
function compact(value=''){return normalizeLogoMatchKey(value).replace(/\s+/g,'');}

export function scoreLogoCandidate(query='',candidate=''){
  const q=normalizeLogoMatchKey(query),c=normalizeLogoMatchKey(candidate);
  if(!q||!c)return 0;
  if(q===c)return 1;
  if(compact(q)===compact(c))return .98;
  const qt=significantTokens(q),ct=significantTokens(c);
  if(qt.length&&ct.length){
    const qs=new Set(qt),cs=new Set(ct);
    const same=qt.length===ct.length&&qt.every(token=>cs.has(token));
    if(same)return .96;
    let overlap=0;for(const token of qs)if(cs.has(token))overlap+=1;
    const union=new Set([...qs,...cs]).size;
    const jaccard=union?overlap/union:0;
    if(jaccard>=.8)return .9;
    if(jaccard>=.66)return .8;
  }
  return 0;
}

async function providerFetch(fetchImpl,url,options={}){
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),PROVIDER_TIMEOUT_MS):null;
  try{
    const init={...options};
    if(controller&&!init.signal)init.signal=controller.signal;
    if(!init.headers)init.headers={};
    init.headers={Accept:'*/*','User-Agent':'WebV2-logo-repair/1.0',...init.headers};
    if(!Object.prototype.hasOwnProperty.call(init,'cf'))init.cf={cacheEverything:true,cacheTtl:21600};
    return await fetchImpl(url,init);
  }finally{if(timer)clearTimeout(timer);}
}

function tvLogoCountries(country=''){
  const code=String(country||'').trim().toUpperCase();
  if(code&&TV_LOGO_COUNTRIES[code])return[{code,folder:TV_LOGO_COUNTRIES[code]}];
  return[{code:'GR',folder:'greece'},{code:'DE',folder:'germany'}];
}
function parseTvLogoMosaic(text=''){
  const rows=[];
  for(const line of String(text||'').split(/\r?\n/)){
    const match=line.match(/^\[([^\]]+)\]:\s*([^\s]+\.(?:png|svg|webp))\s*$/i);
    if(match)rows.push({key:match[1],file:match[2]});
  }
  return rows;
}
function bestNamedMatch(query,entries,keyOf){
  let best=null;
  for(const entry of entries){
    const score=scoreLogoCandidate(query,keyOf(entry));
    if(!best||score>best.score)best={entry,score};
  }
  return best&&best.score>=.8?best:null;
}

async function lookupTvLogo(query,fetchImpl){
  const target=query.id||query.name||query.tvgId||'';
  for(const {code,folder} of tvLogoCountries(query.country)){
    const mosaic=`https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/${folder}/0_all_logos_mosaic.md`;
    let response;
    try{response=await providerFetch(fetchImpl,mosaic);}catch{continue;}
    if(!response.ok)continue;
    const rows=parseTvLogoMosaic(await response.text());
    const best=bestNamedMatch(target,rows,row=>row.key)||bestNamedMatch(query.name||'',rows,row=>row.key);
    if(!best)continue;
    const url=safeHttps(`https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/${folder}/${best.entry.file}`);
    if(!url)continue;
    return{
      found:true,url,provider:'tv-logo',trust:'curated',sourceKind:'curated-third-party',
      sourceUrl:`https://github.com/tv-logo/tv-logos/tree/main/countries/${folder}`,
      country:code,matchScore:best.score
    };
  }
  return null;
}

function piconSlugs(query={}){
  const raw=[query.id,query.tvgId&&String(query.tvgId).split('.')[0],query.name];
  const out=[];
  for(const value of raw){
    const key=normalizeLogoMatchKey(value);
    if(!key)continue;
    const compactAll=key.replace(/\s+/g,'');
    const compactSignificant=significantTokens(key).join('');
    for(const slug of [compactAll,compactSignificant]){
      if(slug&&/^[a-z0-9]+$/i.test(slug)&&!out.includes(slug))out.push(slug);
    }
  }
  return out.slice(0,3);
}

export function piconCandidateUrls(query={}){
  const urls=[];
  for(const slug of piconSlugs(query)){
    for(const suffix of ['default.svg','default.png','light.svg']){
      urls.push(`https://raw.githubusercontent.com/picons/picons/master/build-source/logos/${slug}.${suffix}`);
      if(urls.length>=MAX_PICON_CANDIDATES)return urls;
    }
  }
  return urls;
}
async function lookupPicons(query,fetchImpl){
  for(const url of piconCandidateUrls(query)){
    let response;
    try{response=await providerFetch(fetchImpl,url);}catch{continue;}
    if(!response.ok)continue;
    return{
      found:true,url:safeHttps(url),provider:'picons',trust:'curated',sourceKind:'curated-third-party',
      sourceUrl:'https://github.com/picons/picons/tree/master/build-source/logos',
      country:String(query.country||'').toUpperCase(),matchScore:.88
    };
  }
  return null;
}

async function lookupIptvOrg(query,fetchImpl){
  const tvgId=String(query.tvgId||'').trim();
  if(!tvgId)return null;
  let response;
  try{response=await providerFetch(fetchImpl,'https://iptv-org.github.io/api/logos.json',{headers:{Accept:'application/json'}});}catch{return null;}
  if(!response.ok)return null;
  let rows=[];try{rows=await response.json();}catch{return null;}
  const wanted=tvgId.toLowerCase();
  const row=(Array.isArray(rows)?rows:[]).find(item=>String(item?.channel||'').toLowerCase()===wanted&&item?.in_use!==false&&safeHttps(item?.url));
  if(!row)return null;
  return{
    found:true,url:safeHttps(row.url),provider:'iptv-org',trust:'curated',sourceKind:'curated-third-party',
    sourceUrl:'https://github.com/iptv-org/database',country:String(query.country||'').toUpperCase(),matchScore:1
  };
}

function parseGrtvLogos(text=''){
  const rows=[];
  for(const line of String(text||'').split(/\r?\n/)){
    if(!/^#EXTINF\s*:/i.test(line))continue;
    const logo=line.match(/\btvg-logo=(?:"([^"]*)"|'([^']*)'|([^\s,]+))/i);
    const name=line.match(/\btvg-name=(?:"([^"]*)"|'([^']*)'|([^\s,]+))/i);
    const comma=line.indexOf(',');
    const title=comma>=0?line.slice(comma+1).trim():'';
    const url=safeHttps(logo?.[1]||logo?.[2]||logo?.[3]||'');
    if(url)rows.push({name:name?.[1]||name?.[2]||name?.[3]||'',title,url});
  }
  return rows;
}
async function lookupGrtv(query,fetchImpl){
  const country=String(query.country||'').trim().toUpperCase();
  if(country&&country!=='GR')return null;
  let response;
  try{response=await providerFetch(fetchImpl,'https://raw.githubusercontent.com/jimgate07/grtv/master/griptv.m3u');}catch{return null;}
  if(!response.ok)return null;
  const rows=parseGrtvLogos(await response.text());
  const target=query.id||query.name||query.tvgId||'';
  let best=null;
  for(const row of rows){
    const score=Math.max(scoreLogoCandidate(target,row.name),scoreLogoCandidate(target,row.title),scoreLogoCandidate(query.name||'',row.name),scoreLogoCandidate(query.name||'',row.title));
    if(!best||score>best.score)best={row,score};
  }
  if(!best||best.score<.8)return null;
  return{
    found:true,url:best.row.url,provider:'grtv',trust:'curated',sourceKind:'curated-third-party',
    sourceUrl:'https://github.com/jimgate07/grtv',country:'GR',matchScore:best.score
  };
}

export async function lookupChannelLogo(query={},options={}){
  const fetchImpl=options.fetchImpl||globalThis.fetch;
  if(typeof fetchImpl!=='function')throw new Error('fetch implementation is required');
  const normalized={
    id:String(query.id||'').trim(),name:String(query.name||'').trim(),tvgId:String(query.tvgId||'').trim(),
    country:String(query.country||'').trim().toUpperCase()
  };
  if(!normalized.id&&!normalized.name&&!normalized.tvgId)return{found:false,provider:'',trust:'none',sourceKind:'',url:'',sourceUrl:'',country:normalized.country,matchScore:0};
  const providers=[lookupTvLogo,lookupPicons,lookupIptvOrg,lookupGrtv];
  for(const provider of providers){
    const result=await provider(normalized,fetchImpl);
    if(result?.found&&safeHttps(result.url))return result;
  }
  return{found:false,provider:'',trust:'none',sourceKind:'',url:'',sourceUrl:'',country:normalized.country,matchScore:0};
}
