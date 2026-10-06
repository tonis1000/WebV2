const SERVICE = "WebTV EPG Proxy";
const VERSION = "multi-v5";
const SOURCE = "multi";
const GREEKTV_URL = "https://ext.greektv.app/epg/epg.xml";
const EPGSHARE_GR_URL = "https://epgshare01.online/epgshare01/epg_ripper_GR1.xml.gz";
const EPGSHARE_DE_URL = "https://epgshare01.online/epgshare01/epg_ripper_DE1.xml.gz";
const DIGEA_CHANNELS_URL = "https://www.digea.gr/el/api/epg/get-channels";
const DIGEA_EVENTS_URL = "https://www.digea.gr/el/api/epg/get-events";
const COSMOTE_CHANNELS_URL = "https://mwapi-prod.cosmotetvott.gr/api/v3.4/epg/channels/all/el";
const COSMOTE_LISTINGS_BASE = "https://mwapi-prod.cosmotetvott.gr/api/v3.4/epg/listings/el";
const MAX_REQUESTED_CHANNELS=80;
const MAX_COSMOTE_CHANNELS=35;

const SOURCES=Object.freeze([
  {id:"digea",label:"Digea official EPG",kind:"official",country:"GR"},
  {id:"cosmote",label:"COSMOTE TV official EPG",kind:"official",country:"GR"},
  {id:"greektv",label:"GreekTVApp aggregate",kind:"aggregate",country:"GR"},
  {id:"epgshare-gr",label:"EPGShare Greece fallback",kind:"fallback",country:"GR"},
  {id:"epgshare-de",label:"EPGShare Germany fallback",kind:"fallback",country:"DE"},
]);

function corsHeaders(contentType = "application/xml; charset=utf-8") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": contentType,
  };
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders("application/json; charset=utf-8"),"Cache-Control":"no-store"}});}
function escapeXml(value=""){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function decodeXml(value=""){return String(value||"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'");}
function normalizeMatch(value=""){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/\.(gr|de|cy)$/i,"")
    .replace(/\b(full\s*hd|fhd|uhd|hd|4k|tv)\b/gi,"")
    .replace(/(?:fullhd|fhd|uhd|hd|4k)$/i,"")
    .replace(/[^a-z0-9\p{L}]+/gu,"");
}
function matchesRequested(value,requested=[]){
  if(!requested.length)return true;
  const n=normalizeMatch(value);if(!n)return false;
  return requested.some(term=>{const q=normalizeMatch(term);return q&&n===q;});
}
function cosmoteRequestedVariants(value=""){
  const q=normalizeMatch(value);if(!q)return[];
  const variants=new Set([q]);
  if(q.startsWith("cosmote")&&q.length>7)variants.add(q.slice(7));
  if(q.startsWith("novasports")&&q.length>10)variants.add("nova"+q.slice(10));
  return [...variants];
}
function matchesCosmoteChannel(channel,requested=[]){
  if(!requested.length)return true;
  const candidates=[channel?.title,channel?.callSign].map(normalizeMatch).filter(Boolean);
  return requested.some(term=>cosmoteRequestedVariants(term).some(q=>candidates.includes(q)));
}
const DIGEA_PRIMARY_TERMS=new Set(["ant1","alpha","skai","mega","open","star","action24","kontra"]);
function planRequestedSources(requested=[]){
  const plan={digea:[],cosmote:[],greektv:[],epgshareDe:[]};
  for(const term of requested){
    const raw=String(term||"").trim();const q=normalizeMatch(raw);if(!q)continue;
    if(/\.de$/i.test(raw)){plan.epgshareDe.push(raw);continue;}
    if(q.startsWith("cosmote")||q.startsWith("novasports")){plan.cosmote.push(raw);continue;}
    if(DIGEA_PRIMARY_TERMS.has(q)){plan.digea.push(raw);continue;}
    plan.greektv.push(raw);
  }
  return plan;
}
function attrValue(attrs="",name=""){
  const m=String(attrs).match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`,"i"));
  return m?.[1]||"";
}
function displayNames(body=""){return [...String(body).matchAll(/<display-name\b[^>]*>([\s\S]*?)<\/display-name>/gi)].map(m=>decodeXml(m[1].replace(/<[^>]+>/g,"").trim())).filter(Boolean);}
function analyzeXmltv(xml=""){
  const text=String(xml||"");const channels=(text.match(/<channel\b/g)||[]).length;const programmes=(text.match(/<programme\b/g)||[]).length;const bytes=new TextEncoder().encode(text).length;
  return{valid:text.includes("<tv")&&channels>0&&programmes>0,channels,programmes,bytes};
}
function requestedChannelTerms(url){
  const raw=url.searchParams.get("channels")||"";
  return [...new Set(raw.split(",").map(v=>v.trim()).filter(Boolean))].slice(0,MAX_REQUESTED_CHANNELS);
}
function requestedWindow(url){
  const from=Number(url.searchParams.get("from")),to=Number(url.searchParams.get("to"));
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to-from>8*86400000)return null;
  return{from,to};
}
function parseXmltv(xml=""){
  const channels=[];const byId=new Map();
  for(const m of String(xml).matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi)){
    const id=attrValue(m[1],"id");if(!id)continue;
    const names=displayNames(m[2]);const row={id,names,body:m[0]};channels.push(row);byId.set(id,row);
  }
  const programmes=[];
  for(const m of String(xml).matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi)){
    const channel=attrValue(m[1],"channel");if(channel)programmes.push({channel,attrs:m[1],inner:m[2],body:m[0]});
  }
  return{channels,programmes,byId};
}
function elementText(body="",tag=""){
  const m=String(body).match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,"i"));
  return decodeXml((m?.[1]||"").replace(/<[^>]+>/g,"").trim());
}
function elementAttr(body="",tag="",name=""){
  const m=String(body).match(new RegExp(`<${tag}\\b([^>]*)>`,"i"));
  return m?attrValue(m[1],name):"";
}
function xmltvTimeMs(value=""){
  const match=String(value).trim().match(/^(\d{14})(?:\s*([+-]\d{2}:?\d{2}|Z))?$/i);if(!match)return NaN;
  const d=match[1];const nums=[d.slice(0,4),d.slice(4,6),d.slice(6,8),d.slice(8,10),d.slice(10,12),d.slice(12,14)].map(Number);
  let ms=Date.UTC(nums[0],nums[1]-1,nums[2],nums[3],nums[4],nums[5]);const tz=(match[2]||"Z").toUpperCase();
  if(tz!=="Z"){const t=tz.match(/^([+-])(\d{2}):?(\d{2})$/);if(!t)return NaN;const sign=t[1]==="-"?-1:1;ms-=sign*(Number(t[2])*60+Number(t[3]))*60000;}
  return ms;
}
function buildNowNextPayload(xml="",{nowMs=Date.now(),maxNext=3}={}){
  const parsed=parseXmltv(xml);const byChannel=new Map();
  for(const p of parsed.programmes){
    const startMs=xmltvTimeMs(attrValue(p.attrs,"start")),stopMs=xmltvTimeMs(attrValue(p.attrs,"stop"));
    const title=elementText(p.inner,"title");if(!Number.isFinite(startMs)||!Number.isFinite(stopMs)||!title)continue;
    const item={start:new Date(startMs).toISOString(),stop:new Date(stopMs).toISOString(),title,description:elementText(p.inner,"desc"),category:elementText(p.inner,"category"),image:elementAttr(p.inner,"icon","src")};
    if(!byChannel.has(p.channel))byChannel.set(p.channel,[]);byChannel.get(p.channel).push(item);
  }
  const channels=[];let programmes=0;
  for(const channel of parsed.channels){
    const list=(byChannel.get(channel.id)||[]).sort((a,b)=>new Date(a.start)-new Date(b.start));
    const current=list.find(item=>nowMs>=new Date(item.start).getTime()&&nowMs<new Date(item.stop).getTime())||null;
    const next=list.filter(item=>new Date(item.start).getTime()>nowMs).slice(0,Math.max(0,Number(maxNext)||0));
    if(!current&&!next.length)continue;
    programmes+=(current?1:0)+next.length;
    channels.push({id:channel.id,names:channel.names,current,next});
  }
  return{generatedAt:new Date(nowMs).toISOString(),channels,programmes};
}
function filterXmltv(xml="",requested=[]){
  if(!requested.length)return String(xml||"");
  const parsed=parseXmltv(xml);const keep=new Set();
  for(const channel of parsed.channels){
    if([channel.id,...channel.names].some(value=>matchesRequested(value,requested)))keep.add(channel.id);
  }
  const channels=parsed.channels.filter(c=>keep.has(c.id)).map(c=>c.body).join("");
  const programmes=parsed.programmes.filter(p=>keep.has(p.channel)).map(p=>p.body).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><tv generator-info-name="WebTV EPG">${channels}${programmes}</tv>`;
}
function filterXmltvWindow(xml="",fromMs=-Infinity,toMs=Infinity){
  if(!Number.isFinite(fromMs)||!Number.isFinite(toMs)||toMs<=fromMs)return String(xml||"");
  const parsed=parseXmltv(xml);const programmes=[];const keepIds=new Set();
  for(const p of parsed.programmes){
    const start=xmltvTimeMs(attrValue(p.attrs,"start")),stop=xmltvTimeMs(attrValue(p.attrs,"stop"));
    if(!Number.isFinite(start)||!Number.isFinite(stop)||stop<=fromMs||start>=toMs)continue;
    programmes.push(p.body);keepIds.add(p.channel);
  }
  const channels=parsed.channels.filter(row=>keepIds.has(row.id)).map(row=>row.body).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><tv generator-info-name="WebTV EPG window">${channels}${programmes.join("")}</tv>`;
}
function coverageNames(xml=""){return parseXmltv(xml).channels.flatMap(c=>c.names.length?c.names:[c.id]);}
function missingTerms(requested=[],xml=""){
  const names=coverageNames(xml);return requested.filter(term=>!names.some(name=>matchesRequested(name,[term])));
}
function prefixXmltv(xml="",sourceId="source"){
  const parsed=parseXmltv(xml);const map=new Map(parsed.channels.map(c=>[c.id,`${sourceId}:${c.id}`]));
  const channels=parsed.channels.map(c=>c.body.replace(/(<channel\b[^>]*\bid\s*=\s*["'])[^"']+(["'])/i,`$1${escapeXml(map.get(c.id))}$2`)).join("");
  const programmes=parsed.programmes.filter(p=>map.has(p.channel)).map(p=>p.body.replace(/(<programme\b[^>]*\bchannel\s*=\s*["'])[^"']+(["'])/i,`$1${escapeXml(map.get(p.channel))}$2`)).join("");
  return{channels,programmes,parsed};
}
function mergeXmltv(sourceRows=[],requested=[]){
  const usedNames=new Set();let channels="";let programmes="";const usedSources=[];
  for(const row of sourceRows){
    const scoped=filterXmltv(row.xml,requested);const prefixed=prefixXmltv(scoped,row.id);const keepIds=new Set();
    for(const channel of prefixed.parsed.channels){
      const names=channel.names.length?channel.names:[channel.id];const key=normalizeMatch(names[0]);
      if(key&&usedNames.has(key))continue;
      if(key)usedNames.add(key);
      keepIds.add(channel.id);
      const mappedId=`${row.id}:${channel.id}`;
      channels+=channel.body.replace(/(<channel\b[^>]*\bid\s*=\s*["'])[^"']+(["'])/i,`$1${escapeXml(mappedId)}$2`);
    }
    for(const p of prefixed.parsed.programmes){
      if(!keepIds.has(p.channel))continue;
      const mappedId=`${row.id}:${p.channel}`;
      programmes+=p.body.replace(/(<programme\b[^>]*\bchannel\s*=\s*["'])[^"']+(["'])/i,`$1${escapeXml(mappedId)}$2`);
    }
    if(keepIds.size)usedSources.push(row.id);
  }
  return{xml:`<?xml version="1.0" encoding="UTF-8"?><tv generator-info-name="WebTV EPG multi-v5">${channels}${programmes}</tv>`,usedSources};
}
async function textMaybeGzip(response,url=""){
  const buffer=await response.arrayBuffer();const bytes=new Uint8Array(buffer);
  const gz=bytes.length>2&&bytes[0]===0x1f&&bytes[1]===0x8b;
  if(gz&&typeof DecompressionStream!=="undefined"){
    const stream=new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }
  return new TextDecoder().decode(bytes);
}
async function fetchXmlSource(id,url,requested=[]){
  const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 WebTV-EPG-Proxy","Accept":"application/xml,text/xml,*/*","Cache-Control":"no-cache"},cf:{cacheEverything:true,cacheTtl:900}});
  if(!response.ok)throw new Error(`${id} HTTP ${response.status}`);
  const xml=await textMaybeGzip(response,url);const scoped=filterXmltv(xml,requested);const analysis=analyzeXmltv(scoped);
  if(!analysis.valid)throw new Error(`${id}: no matching XMLTV`);
  return{id,xml:scoped,analysis};
}
function athensDateParts(dayOffset=0){
  const base=new Date(Date.now()+dayOffset*86400000);
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Athens",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(base);
  const get=t=>parts.find(p=>p.type===t)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function athensDateKey(ms){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Athens",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(ms));
  const get=t=>parts.find(p=>p.type===t)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function dateKeyDayNumber(key=""){
  const m=String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return NaN;
  return Math.floor(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]))/86400000);
}
function dayOffsetsForWindow(fromMs,toMs){
  const base=dateKeyDayNumber(athensDateParts(0)),start=dateKeyDayNumber(athensDateKey(fromMs)),end=dateKeyDayNumber(athensDateKey(Math.max(fromMs,toMs-1)));
  if(!Number.isFinite(base)||!Number.isFinite(start)||!Number.isFinite(end))return[0,1];
  const offsets=[];for(let day=start;day<=end;day+=1){const offset=day-base;if(offset>=0&&offset<=7)offsets.push(offset);}
  return offsets.length?[...new Set(offsets)]:[0,1];
}
function athensOffset(dateText=""){
  const date=new Date(`${dateText.slice(0,10)}T12:00:00Z`);
  const part=new Intl.DateTimeFormat("en-US",{timeZone:"Europe/Athens",timeZoneName:"shortOffset"}).formatToParts(date).find(p=>p.type==="timeZoneName")?.value||"GMT+2";
  const m=part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);if(!m)return"+0200";
  return `${m[1]}${String(m[2]).padStart(2,"0")}${String(m[3]||"00").padStart(2,"0")}`;
}
function xmltvLocal(value=""){
  const digits=String(value).replace(/\D/g,"").slice(0,14);if(digits.length<12)return"";
  const full=digits.padEnd(14,"0");const date=`${full.slice(0,4)}-${full.slice(4,6)}-${full.slice(6,8)}`;
  return `${full} ${athensOffset(date)}`;
}
function xmltvUtc(value){
  const d=new Date(value);if(Number.isNaN(d.getTime()))return"";
  const p=n=>String(n).padStart(2,"0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())} +0000`;
}
function cosmoteDayRange(dayOffset=0){
  const date=athensDateParts(dayOffset);
  const raw=athensOffset(date);
  const offset=`${raw.slice(0,3)}:${raw.slice(3)}`;
  const from=Math.floor(new Date(`${date}T00:00:00${offset}`).getTime()/1000);
  const to=Math.floor(new Date(`${date}T23:59:59${offset}`).getTime()/1000);
  return{from,to};
}
function makeXmltv(channels=[],programmes=[],generator="WebTV"){
  return `<?xml version="1.0" encoding="UTF-8"?><tv generator-info-name="${escapeXml(generator)}">${channels.map(c=>`<channel id="${escapeXml(c.id)}"><display-name>${escapeXml(c.name)}</display-name>${c.logo?`<icon src="${escapeXml(c.logo)}"/>`:""}</channel>`).join("")}${programmes.map(p=>`<programme channel="${escapeXml(p.channel)}" start="${escapeXml(p.start)}" stop="${escapeXml(p.stop)}"><title>${escapeXml(p.title)}</title>${p.description?`<desc>${escapeXml(p.description)}</desc>`:""}${p.category?`<category>${escapeXml(p.category)}</category>`:""}${p.image?`<icon src="${escapeXml(p.image)}"/>`:""}</programme>`).join("")}</tv>`;
}
async function fetchDigea(requested=[],dayOffsets=[0,1]){
  if(!requested.length)throw new Error("digea skipped without channel scope");
  const headers={"content-type":"application/x-www-form-urlencoded; charset=UTF-8"};
  const channelBody=new URLSearchParams({action:"get_chanels",lang:"el"});
  const channelResponse=await fetch(DIGEA_CHANNELS_URL,{method:"POST",headers,body:channelBody});
  if(!channelResponse.ok)throw new Error(`digea channels HTTP ${channelResponse.status}`);
  const all=await channelResponse.json();const channels=(Array.isArray(all)?all:[]).filter(c=>matchesRequested(c.name,requested));
  if(!channels.length)throw new Error("digea no requested channels");
  const ids=new Set(channels.map(c=>String(c.id)));const programmes=[];
  for(const offset of dayOffsets){
    const date=athensDateParts(offset);const body=new URLSearchParams({action:"get_events",date:`${Number(date.slice(0,4))}-${Number(date.slice(5,7))}-${Number(date.slice(8,10))}`});
    const response=await fetch(DIGEA_EVENTS_URL,{method:"POST",headers,body});
    if(!response.ok)continue;
    const items=await response.json();
    for(const item of Array.isArray(items)?items:[]){
      if(!ids.has(String(item.channel_id)))continue;
      const start=xmltvLocal(item.actual_time),stop=xmltvLocal(item.end_time);if(!start||!stop||!item.title)continue;
      programmes.push({channel:`digea.${item.channel_id}`,start,stop,title:item.title,description:item.long_synopsis||""});
    }
  }
  const xml=makeXmltv(channels.map(c=>({id:`digea.${c.id}`,name:c.name})),programmes,"Digea official");
  const analysis=analyzeXmltv(xml);if(!analysis.valid)throw new Error("digea empty");
  return{id:"digea",xml,analysis};
}
const COSMOTE_HEADERS={referer:"https://www.cosmotetv.gr/","User-Agent":"Mozilla/5.0 WebTV-EPG-Proxy",Accept:"*/*",Origin:"https://www.cosmotetv.gr"};
async function fetchCosmote(requested=[],dayOffsets=[0,1]){
  if(!requested.length)throw new Error("cosmote skipped without channel scope");
  const response=await fetch(COSMOTE_CHANNELS_URL,{headers:COSMOTE_HEADERS});
  if(!response.ok)throw new Error(`cosmote channels HTTP ${response.status}`);
  const data=await response.json();const all=Array.isArray(data?.channels)?data.channels:[];
  const channels=all.filter(c=>matchesCosmoteChannel(c,requested)).slice(0,MAX_COSMOTE_CHANNELS);
  if(!channels.length)throw new Error("cosmote no requested channels");
  const programmes=[];
  await Promise.all(channels.flatMap(channel=>dayOffsets.map(async dayOffset=>{
    const {from,to}=cosmoteDayRange(dayOffset);
    const url=`${COSMOTE_LISTINGS_BASE}?from=${from}&to=${to}&callSigns=${encodeURIComponent(channel.callSign)}&endingIncludedInRange=false`;
    try{
      const r=await fetch(url,{headers:COSMOTE_HEADERS});if(!r.ok)return;const j=await r.json();
      for(const group of Array.isArray(j?.channels)?j.channels:[])for(const item of Array.isArray(group?.items)?group.items:[]){
        const start=xmltvUtc(item.startTime),stop=xmltvUtc(item.endTime);if(!start||!stop||!item.title)continue;
        programmes.push({channel:`cosmote.${channel.callSign}`,start,stop,title:item.title,description:item.description||"",category:item.qoe?.genre||"",image:item.thumbnails?.standard||""});
      }
    }catch{}
  })));
  const xml=makeXmltv(channels.map(c=>({id:`cosmote.${c.callSign}`,name:c.title,logo:c.logos?.square||""})),programmes,"COSMOTE TV official");
  const analysis=analyzeXmltv(xml);if(!analysis.valid)throw new Error("cosmote empty");
  return{id:"cosmote",xml,analysis};
}
async function loadScopedMultiSource(requested=[],{dayOffsets=[0,1]}={}){
  if(!requested.length){
    const base=await fetchXmlSource("greektv",GREEKTV_URL,[]);
    return{xml:base.xml,usedSources:["greektv"],results:[base],errors:[]};
  }
  const plan=planRequestedSources(requested);const tasks=[];
  if(plan.digea.length)tasks.push(fetchDigea(plan.digea,dayOffsets));
  if(plan.cosmote.length)tasks.push(fetchCosmote(plan.cosmote,dayOffsets));
  if(plan.greektv.length)tasks.push(fetchXmlSource("greektv",GREEKTV_URL,plan.greektv));
  if(plan.epgshareDe.length)tasks.push(fetchXmlSource("epgshare-de",EPGSHARE_DE_URL,plan.epgshareDe));
  const primary=await Promise.allSettled(tasks);
  const rows=[],errors=[];
  for(const result of primary){if(result.status==="fulfilled")rows.push(result.value);else errors.push(result.reason?.message||String(result.reason));}
  let merged=mergeXmltv(rows,requested);
  const missing=missingTerms(requested,merged.xml);
  if(missing.length){
    const deMissing=missing.filter(term=>/\.de$/i.test(String(term)));
    const grMissing=missing.filter(term=>!deMissing.includes(term));
    const fallbackTasks=[];
    if(grMissing.length)fallbackTasks.push(fetchXmlSource("greektv",GREEKTV_URL,grMissing));
    if(grMissing.length)fallbackTasks.push(fetchXmlSource("epgshare-gr",EPGSHARE_GR_URL,grMissing));
    if(deMissing.length)fallbackTasks.push(fetchXmlSource("epgshare-de",EPGSHARE_DE_URL,deMissing));
    const fallback=await Promise.allSettled(fallbackTasks);
    for(const result of fallback){if(result.status==="fulfilled")rows.push(result.value);else errors.push(result.reason?.message||String(result.reason));}
    merged=mergeXmltv(rows,requested);
  }
  const analysis=analyzeXmltv(merged.xml);
  if(!analysis.valid)throw new Error(errors.join(" · ")||"No usable EPG source for requested channels");
  return{xml:merged.xml,usedSources:merged.usedSources,results:rows,errors,plan};
}
async function withEdgeCache(request,build,ctx){
  const cache=globalThis.caches?.default;
  if(cache){
    const hit=await cache.match(request);if(hit)return hit;
  }
  const response=await build();
  if(cache&&response.ok){
    const put=cache.put(request,response.clone());
    if(ctx?.waitUntil)ctx.waitUntil(put);else await put;
  }
  return response;
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders("text/plain; charset=utf-8")});
    if(request.method!=="GET")return new Response("Method not allowed",{status:405,headers:corsHeaders("text/plain; charset=utf-8")});
    if(!["/epg","/epg.xml","/now-next.json","/status"].includes(url.pathname))return new Response("OK. Use /epg, /epg.xml, /now-next.json or /status",{status:200,headers:corsHeaders("text/plain; charset=utf-8")});
    const requested=requestedChannelTerms(url);const window=requestedWindow(url);
    const build=async()=>{
      try{
        const dayOffsets=window?dayOffsetsForWindow(window.from,window.to):[0,1];
        const loaded=await loadScopedMultiSource(requested,{dayOffsets});
        const responseXml=window?filterXmltvWindow(loaded.xml,window.from,window.to):loaded.xml;
        const analysis=analyzeXmltv(responseXml);
        if(url.pathname==="/status")return json({ok:true,valid:true,service:SERVICE,version:VERSION,source:SOURCE,channels:analysis.channels,programmes:analysis.programmes,bytes:analysis.bytes,requested:requested.length,sourcesConfigured:SOURCES,sourcesUsed:loaded.usedSources,sourcePlan:loaded.plan||null,sourceResults:(loaded.results||[]).map(row=>({id:row.id,channels:Number(row.analysis?.channels||0),programmes:Number(row.analysis?.programmes||0),ok:true})),warnings:loaded.errors});
        if(url.pathname==="/now-next.json"){
          const compact=buildNowNextPayload(responseXml,{maxNext:3});
          return new Response(JSON.stringify({...compact,service:SERVICE,version:VERSION,source:SOURCE,requested:requested.length,sourcesUsed:loaded.usedSources}),{status:200,headers:{...corsHeaders("application/json; charset=utf-8"),"Cache-Control":"public, max-age=120, stale-while-revalidate=300","X-EPG-Source":SOURCE,"X-EPG-Sources-Used":loaded.usedSources.join(","),"X-EPG-Proxy-Version":VERSION}});
        }
        return new Response(responseXml,{status:200,headers:{...corsHeaders(),"Cache-Control":"public, max-age=300, stale-while-revalidate=900","X-EPG-Source":SOURCE,"X-EPG-Sources-Used":loaded.usedSources.join(","),"X-EPG-Proxy-Version":VERSION}});
      }catch(error){
        const message=error?.message||"unknown error";
        if(url.pathname==="/status")return json({ok:false,valid:false,service:SERVICE,version:VERSION,source:SOURCE,channels:0,programmes:0,bytes:0,requested:requested.length,sourcesConfigured:SOURCES,error:`EPG proxy error: ${message}`},502);
        return new Response(`EPG proxy error: ${message}`,{status:502,headers:corsHeaders("text/plain; charset=utf-8")});
      }
    };
    return url.pathname==="/status"?build():withEdgeCache(request,build,ctx);
  }
};

export{analyzeXmltv,requestedChannelTerms,requestedWindow,filterXmltv,filterXmltvWindow,mergeXmltv,normalizeMatch,matchesCosmoteChannel,cosmoteDayRange,dayOffsetsForWindow,planRequestedSources,buildNowNextPayload};
