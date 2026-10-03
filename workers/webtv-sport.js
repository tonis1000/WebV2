const SERVICE='WebTV SPORT Feed';
const VERSION='1.1';
const SOURCE_TZ='Europe/Athens';
const SPORTFM_ORIGIN='https://www.sportfmtv.gr';
const SPORTFM_MAX_EVENTS=10;
const SEEDS=Object.freeze([
  'https://foothubhd.st',
  'https://foothublive.top',
]);
const DISCOVERY_PAGES=Object.freeze([
  'https://beacons.ai/foothubhd',
]);
const MAX_BYTES=900000;
const FETCH_TIMEOUT_MS=9000;

function corsHeaders(type='application/json; charset=utf-8'){
  return {
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'GET, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Content-Type':type,
  };
}
function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{...corsHeaders(),'Cache-Control':'no-store'}});
}
function safeHttpsUrl(value=''){
  try{
    const u=new URL(String(value||'').trim());
    return u.protocol==='https:'?u:null;
  }catch{return null;}
}
function isFoothubHost(host=''){
  return /^foothub[a-z0-9-]*\.[a-z]{2,15}$/i.test(String(host||''));
}
function normalizeOrigin(value=''){
  const u=safeHttpsUrl(value);
  if(!u||!isFoothubHost(u.hostname))return'';
  return u.origin;
}
function extractFoothubOrigins(text=''){
  const out=new Set();
  const raw=String(text||'');
  for(const m of raw.matchAll(/(?:https?:\/\/)?(foothub[a-z0-9-]*\.[a-z]{2,15})(?:[\/:?#][^\s"'<>]*)?/gi)){
    const origin=normalizeOrigin('https://'+m[1]);
    if(origin)out.add(origin);
  }
  return [...out];
}
function stripTags(value=''){
  return String(value||'')
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&quot;/gi,'"')
    .replace(/\s+/g,' ')
    .trim();
}
function uniqLinks(values=[]){
  const out=[];const seen=new Set();
  for(const value of values){
    const u=safeHttpsUrl(value);
    if(!u)continue;
    const href=u.href.replace(/[),.;]+$/,'');
    if(seen.has(href))continue;
    seen.add(href);
    out.push({label:`Link ${out.length+1}`,url:href});
  }
  return out;
}
function zonedParts(date,tz){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
function toUtcIsoFromAthens(year,month,day,hour,minute){
  let ms=Date.UTC(year,month-1,day,hour,minute,0);
  for(let i=0;i<3;i++){
    const p=zonedParts(new Date(ms),SOURCE_TZ);
    const represented=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second||0);
    const wanted=Date.UTC(year,month-1,day,hour,minute,0);
    ms+=wanted-represented;
  }
  return new Date(ms).toISOString();
}
function eventId(date,time,title,index){
  return `${date||'unknown'}|${time||'--:--'}|${String(title||'').toLowerCase()}|${index}`;
}
function parseProgramText(text='',baseOrigin=''){
  const lines=String(text||'').replace(/\r/g,'').split('\n');
  const events=[];let currentDate='';
  for(const rawLine of lines){
    const line=rawLine.trim();
    if(!line)continue;
    const header=line.match(/ΠΡΟΓΡΑΜΜΑ\s+[^\d\n]*?(\d{1,2})\/(\d{1,2})\/(\d{4})/iu);
    if(header){
      currentDate=`${String(header[1]).padStart(2,'0')}/${String(header[2]).padStart(2,'0')}/${header[3]}`;
      continue;
    }
    const urls=[...line.matchAll(/https:\/\/[^\s]+/gi)].map(m=>m[0].replace(/[),.;]+$/,''));
    if(!urls.length)continue;
    const firstUrl=line.search(/https:\/\//i);
    const scheduleText=(firstUrl>=0?line.slice(0,firstUrl):line).trim();
    const games=[...scheduleText.matchAll(/(\d{1,2}:\d{2})\s+(.+?)(?=(?:\s*\/\s*\d{1,2}:\d{2})|$)/gu)];
    const links=uniqLinks(urls);
    if(!games.length||!links.length)continue;
    for(const [idx,g] of games.entries()){
      const time=g[1].padStart(5,'0');
      const title=String(g[2]||'').replace(/\s+η\s*$/u,'').trim();
      let startUtc='';
      const dm=currentDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      const tm=time.match(/(\d{2}):(\d{2})/);
      if(dm&&tm)startUtc=toUtcIsoFromAthens(Number(dm[3]),Number(dm[2]),Number(dm[1]),Number(tm[1]),Number(tm[2]));
      events.push({
        id:eventId(currentDate,time,title,events.length),
        date:currentDate,time,title,startUtc,links,
        source:'program.txt',provider:'foothub',slotIndex:events.length+1,
      });
    }
  }
  return{events,origins:extractFoothubOrigins(text),baseOrigin};
}
function parseHomepageHtml(html='',baseOrigin=''){
  const raw=String(html||'');
  const anchors=[...raw.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m,index)=>{
    const href=(m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)||[])[1]||'';
    const dataUrl=(m[1].match(/\bdata-url\s*=\s*["']([^"']+)["']/i)||[])[1]||'';
    return{index,start:m.index||0,end:(m.index||0)+m[0].length,href,dataUrl,text:stripTags(m[2])};
  });
  const groups=[];let current=null;
  for(const a of anchors){
    const n=(a.text.match(/Link\s*#?\s*(\d+)/i)||[])[1];
    if(!n)continue;
    const num=Number(n);
    let url='';
    try{url=new URL(a.dataUrl||a.href,baseOrigin||undefined).href;}catch{}
    if(!safeHttpsUrl(url))continue;
    if(num===1||!current){current={start:a.start,links:[]};groups.push(current);}
    current.links.push(url);
  }
  const events=[];
  for(let gi=0;gi<groups.length;gi++){
    const group=groups[gi];
    const prevEnd=gi?groups[gi-1].start:0;
    const before=stripTags(raw.slice(Math.max(prevEnd,group.start-2200),group.start));
    const matches=[...before.matchAll(/(\d{1,2}:\d{2})\s+([^\d]{3,100}?)(?=(?:\s+\d{1,2}:\d{2})|UEFA|Live|Not Live|Τα Links|$)/gu)];
    const picked=matches.slice(-3);
    const links=uniqLinks(group.links);
    for(const m of picked){
      const time=m[1].padStart(5,'0');
      const title=String(m[2]||'').replace(/\s+/g,' ').replace(/[-–—\s]+$/,'').trim();
      if(!title||!/\s[-–—]\s/u.test(title))continue;
      const nowAthens=zonedParts(new Date(),SOURCE_TZ);
      const startUtc=toUtcIsoFromAthens(nowAthens.year,nowAthens.month,nowAthens.day,Number(time.slice(0,2)),Number(time.slice(3,5)));
      events.push({
        id:eventId('today',time,title,events.length),
        date:'',time,title,startUtc,links,
        source:'homepage',provider:'foothub',slotIndex:gi+1,
      });
    }
  }
  const dedup=[];const seen=new Set();
  for(const e of events){
    const key=`${e.time}|${e.title}`;
    if(seen.has(key))continue;seen.add(key);dedup.push(e);
  }
  return{events:dedup,origins:extractFoothubOrigins(raw),baseOrigin};
}
function localDateKey(year,month,day){
  return year*10000+month*100+day;
}
function parseSportFmDate(context='',now=new Date()){
  const text=String(context||'');
  const nowAthens=zonedParts(now,SOURCE_TZ);
  const short=[...text.matchAll(/(\d{1,2})\/(\d{1,2})\s*,\s*(\d{1,2}):(\d{2})/g)].pop();
  if(short){
    return{
      year:nowAthens.year,month:Number(short[2]),day:Number(short[1]),
      hour:Number(short[3]),minute:Number(short[4]),
      label:short[0],
    };
  }
  const full=[...text.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*,?\s*(\d{1,2}):(\d{2}))?/g)].pop();
  if(full){
    return{
      year:Number(full[3]),month:Number(full[2]),day:Number(full[1]),
      hour:full[4]?Number(full[4]):null,minute:full[5]?Number(full[5]):null,
      label:full[0],
    };
  }
  return null;
}
function sportFmTitleFromContext(context=''){
  let text=stripTags(context)
    .replace(/Παίζει τώρα/giu,' ')
    .replace(/ΣΠΟΡFM TV(?:\s+ΚΑΝΑΛΙ\s+\d+)?/giu,' ')
    .replace(/ΔΕΙΤΕ ΤΩΡΑ|ΔΕΙΤΕ ΖΩΝΤΑΝΑ/giu,' ')
    .replace(/\s+/g,' ')
    .trim();
  const datePos=text.search(/(?:Δευτέρα|Τρίτη|Τετάρτη|Πέμπτη|Παρασκευή|Σάββατο|Κυριακή)?\s*\d{1,2}\/\d{1,2}(?:\/\d{4})?/iu);
  if(datePos>=0)text=text.slice(0,datePos).trim();
  const dotPos=text.indexOf('·');
  if(dotPos>=0)text=text.slice(0,dotPos).trim();
  const dash=[...text.matchAll(/([^|]{2,110}\s[-–—]\s[^|]{2,110})/gu)].pop();
  if(!dash)return'';
  let title=dash[1].trim();
  const competition=title.match(/^(.+?\s[-–—]\s.+?)(?:\s+(?:Stoiximan|Allwyn|EuroLeague|UEFA|Superbet)\b.*)$/iu);
  if(competition)title=competition[1].trim();
  return title;
}
function parseSportFmHomepage(html='',{baseOrigin=SPORTFM_ORIGIN,now=new Date()}={}){
  const raw=String(html||'');
  const anchors=[...raw.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map(m=>{
      const href=(m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)||[])[1]||'';
      return{start:m.index||0,end:(m.index||0)+m[0].length,href,text:stripTags(m[2])};
    })
    .filter(a=>/\/media-video\//i.test(a.href)&&!/sport-fm-linear-channel-/i.test(a.href));
  const nowAthens=zonedParts(now,SOURCE_TZ);
  const todayKey=localDateKey(nowAthens.year,nowAthens.month,nowAthens.day);
  const events=[];
  let previousEnd=0;
  for(const anchor of anchors){
    const context=raw.slice(Math.max(previousEnd,anchor.start-6000),anchor.start);
    previousEnd=anchor.end;
    const date=parseSportFmDate(context,now);
    if(!date)continue;
    const dateKey=localDateKey(date.year,date.month,date.day);
    if(dateKey<todayKey)continue;
    if(dateKey>todayKey+14)continue;
    let url='';
    try{url=new URL(anchor.href,baseOrigin).href;}catch{}
    if(!safeHttpsUrl(url)||new URL(url).hostname!=='www.sportfmtv.gr')continue;
    const title=sportFmTitleFromContext(context)||anchor.text||'SPORTFM TV';
    const startUtc=date.hour===null?'':toUtcIsoFromAthens(date.year,date.month,date.day,date.hour,date.minute||0);
    events.push({
      id:eventId(`${String(date.day).padStart(2,'0')}/${String(date.month).padStart(2,'0')}/${date.year}`,date.hour===null?'':`${String(date.hour).padStart(2,'0')}:${String(date.minute||0).padStart(2,'0')}`,title,events.length),
      date:`${String(date.day).padStart(2,'0')}/${String(date.month).padStart(2,'0')}/${date.year}`,
      time:date.hour===null?'':`${String(date.hour).padStart(2,'0')}:${String(date.minute||0).padStart(2,'0')}`,
      title,startUtc,
      links:[{label:'Official',url}],
      source:'sportfmtv-homepage',provider:'sportfmtv',
      liveLabel:/Ζωντανά|Παίζει τώρα/iu.test(stripTags(context)),
      official:true,
    });
    if(events.length>=SPORTFM_MAX_EVENTS)break;
  }
  const dedup=[];const seen=new Set();
  for(const event of events){
    const key=event.links[0]?.url||event.id;
    if(seen.has(key))continue;
    seen.add(key);dedup.push(event);
  }
  return{events:dedup,origin:baseOrigin,source:'sportfmtv-homepage'};
}
function extractOgTitle(html=''){
  return ((String(html||'').match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)||[])[1]
    ||(String(html||'').match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i)||[])[1]
    ||'').trim();
}
async function loadSportFmSchedule(){
  const reports=[];
  try{
    const home=await fetchText(SPORTFM_ORIGIN+'/el');
    const parsed=parseSportFmHomepage(home.text,{baseOrigin:SPORTFM_ORIGIN,now:new Date()});
    for(const event of parsed.events.slice(0,SPORTFM_MAX_EVENTS)){
      try{
        const page=await fetchText(event.links[0].url);
        const title=extractOgTitle(page.text);
        if(title)event.title=title;
      }catch(error){
        reports.push({url:event.links[0].url,titleFetch:false,error:error?.message||String(error)});
      }
    }
    reports.unshift({origin:SPORTFM_ORIGIN,ok:true,events:parsed.events.length});
    return{...parsed,reports};
  }catch(error){
    reports.push({origin:SPORTFM_ORIGIN,ok:false,error:error?.message||String(error)});
    return{origin:SPORTFM_ORIGIN,events:[],source:'sportfmtv-homepage',reports};
  }
}

function eventFreshness(events=[]){
  const now=Date.now();
  const dated=events.map(e=>Date.parse(e.startUtc||'')).filter(Number.isFinite);
  if(!dated.length)return{fresh:false,minHours:null};
  const diffs=dated.map(ms=>(ms-now)/3600000);
  const usable=diffs.some(h=>h>=-8&&h<=192);
  return{fresh:usable,minHours:Math.min(...diffs.map(Math.abs))};
}
async function fetchText(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{
    const response=await fetch(url,{
      headers:{'accept':'text/html,text/plain;q=0.9,*/*;q=0.5','user-agent':'Mozilla/5.0 WebTV-Sport/1.0'},
      redirect:'follow',signal:controller.signal,cf:{cacheTtl:60,cacheEverything:false}
    });
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const len=Number(response.headers.get('content-length')||0);
    if(len>MAX_BYTES)throw new Error('response too large');
    const text=await response.text();
    if(new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('response too large');
    return{text,url:response.url||url,status:response.status};
  }finally{clearTimeout(timer);}
}
async function discoverOrigins(){
  const out=new Set(SEEDS);
  for(const page of DISCOVERY_PAGES){
    try{
      const r=await fetchText(page);
      for(const origin of extractFoothubOrigins(r.text))out.add(origin);
    }catch{}
  }
  return [...out];
}
async function loadFoothubSchedule(){
  const candidates=await discoverOrigins();
  const reports=[];
  for(const origin of candidates.slice(0,10)){
    if(!normalizeOrigin(origin))continue;
    let homepage=null;
    try{
      homepage=await fetchText(origin+'/');
      for(const found of extractFoothubOrigins(homepage.text)){
        if(!candidates.includes(found))candidates.push(found);
      }
    }catch(error){
      reports.push({origin,ok:false,error:error?.message||String(error)});
      continue;
    }
    let program=null;
    try{
      program=await fetchText(origin+'/program.txt');
      const parsed=parseProgramText(program.text,origin);
      const freshness=eventFreshness(parsed.events);
      reports.push({origin,program:true,events:parsed.events.length,fresh:freshness.fresh});
      if(parsed.events.length&&freshness.fresh){
        return{origin,events:parsed.events,source:'program.txt',fresh:true,reports};
      }
    }catch(error){
      reports.push({origin,program:false,error:error?.message||String(error)});
    }
    const homeParsed=parseHomepageHtml(homepage.text,origin);
    if(homeParsed.events.length){
      return{origin,events:homeParsed.events,source:'homepage',fresh:true,reports};
    }
  }
  return{origin:'',events:[],source:'none',fresh:false,reports};
}
async function loadSchedule(){
  const [foothub,sportfmtv]=await Promise.all([
    loadFoothubSchedule(),
    loadSportFmSchedule(),
  ]);
  const events=[
    ...(foothub.events||[]),
    ...(sportfmtv.events||[]),
  ];
  return{
    origin:foothub.origin||'',
    events,
    source:'multi',
    fresh:foothub.fresh!==false||sportfmtv.events.length>0,
    providers:{
      foothub:{origin:foothub.origin||'',source:foothub.source||'none',events:(foothub.events||[]).length,reports:foothub.reports||[]},
      sportfmtv:{origin:SPORTFM_ORIGIN,source:'sportfmtv-homepage',events:(sportfmtv.events||[]).length,reports:sportfmtv.reports||[]},
    },
    reports:[...(foothub.reports||[]),...(sportfmtv.reports||[])],
  };
}

export default {
  async fetch(request,env={}){
    const url=new URL(request.url);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders()});
    if(request.method!=='GET')return json({error:'Method not allowed'},405);
    if(url.pathname==='/status')return json({ok:true,service:SERVICE,version:VERSION,deploySha:String(env.DEPLOY_SHA||''),seeds:SEEDS,sportfmOrigin:SPORTFM_ORIGIN,sourceTimezone:SOURCE_TZ});
    if(url.pathname!=='/api/schedule')return json({error:'Not found'},404);
    try{
      const schedule=await loadSchedule();
      return json({
        ok:true,service:SERVICE,version:VERSION,deploySha:String(env.DEPLOY_SHA||''),
        sourceTimezone:SOURCE_TZ,displayTimezone:'Europe/Berlin',
        generatedAt:new Date().toISOString(),...schedule,
      });
    }catch(error){
      return json({ok:false,service:SERVICE,version:VERSION,error:error?.message||String(error)},502);
    }
  }
};

export { extractFoothubOrigins, parseProgramText, parseHomepageHtml, parseSportFmHomepage, toUtcIsoFromAthens, eventFreshness };
