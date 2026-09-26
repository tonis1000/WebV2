import puppeteer from '@cloudflare/puppeteer';

const VERSION='1.1';
const DEFAULT_TIMEOUT_MS=10000;
const MAX_TIMEOUT_MS=12000;
const MAX_OBSERVATIONS=24;
const ALLOWED_PAGE_HOSTS=new Set(['live.ertflix.gr','www.antenna.gr']);
const APPROVED_HEADER_NAMES=new Set(['user-agent','referer','origin']);
const MEDIA_RE=/\.(?:m3u8|mpd|mp4|webm)(?:[?#]|$)/i;

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});}
function authorized(request,env){
  const expected=String(env.RESOLVER_SHARED_TOKEN||'');
  if(!expected)return false;
  return request.headers.get('authorization')===`Bearer ${expected}`;
}
function safePageUrl(raw=''){
  const url=new URL(String(raw||'').trim());
  if(url.protocol!=='https:')throw new Error('Only HTTPS pages are allowed');
  if(!ALLOWED_PAGE_HOSTS.has(url.hostname.toLowerCase()))throw new Error('Page host is not allowlisted');
  return url;
}
function sanitizeHeaders(headers={}){
  const out={};
  for(const [key,value] of Object.entries(headers||{})){
    const name=String(key||'').toLowerCase();
    if(!APPROVED_HEADER_NAMES.has(name))continue;
    const text=String(value||'').trim();
    if(!text||text.length>2048)continue;
    const canonical=name==='user-agent'?'User-Agent':name[0].toUpperCase()+name.slice(1);
    out[canonical]=text;
  }
  return out;
}
function timeoutFrom(body={}){
  const requested=Number(body?.capture?.timeoutMs)||DEFAULT_TIMEOUT_MS;
  return Math.max(2500,Math.min(MAX_TIMEOUT_MS,requested));
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function cleanLabel(value=''){return String(value||'').replace(/\s+/g,' ').trim().slice(0,80);}

async function pageDiagnostics(page){
  try{
    return await page.evaluate(()=>{
      const safeHost=value=>{try{return new URL(value,location.href).hostname}catch{return''}};
      const label=el=>String(el.getAttribute('aria-label')||el.textContent||el.title||'').replace(/\s+/g,' ').trim().slice(0,80);
      return{
        title:String(document.title||'').slice(0,120),
        pathname:location.pathname,
        videoCount:document.querySelectorAll('video').length,
        iframeCount:document.querySelectorAll('iframe').length,
        buttonCount:document.querySelectorAll('button').length,
        iframeHosts:[...new Set([...document.querySelectorAll('iframe[src]')].map(el=>safeHost(el.src)).filter(Boolean))].slice(0,8),
        buttonLabels:[...new Set([...document.querySelectorAll('button,[role="button"]')].map(label).filter(Boolean))].slice(0,12),
      };
    });
  }catch{return{title:'',pathname:'',videoCount:0,iframeCount:0,buttonCount:0,iframeHosts:[],buttonLabels:[]};}
}

async function nudgePlayback(page){
  try{
    await page.evaluate(async()=>{
      const videos=[...document.querySelectorAll('video')];
      for(const video of videos){
        try{video.muted=true;await video.play();}catch{}
      }
      const selectors=[
        'button.vjs-play-control',
        '.brid-overlay-play-button',
        '[aria-label="Play"]',
        '[aria-label*="play" i]',
        '.play-button',
        '.player-play',
      ];
      for(const selector of selectors){
        const el=document.querySelector(selector);
        if(el){try{el.click();}catch{}}
      }
    });
  }catch{}
}

async function resolve(body,env){
  if(!env.BROWSER)throw new Error('Browser binding is not configured');
  const pageUrl=safePageUrl(body?.url);
  const timeoutMs=timeoutFrom(body);
  const observations=[];
  const seen=new Set();
  let browser;
  const started=Date.now();
  try{
    browser=await puppeteer.launch(env.BROWSER);
    const page=await browser.newPage();
    page.setDefaultNavigationTimeout(timeoutMs);
    page.setDefaultTimeout(timeoutMs);
    page.on('request',request=>{
      try{
        const url=request.url();
        if(!MEDIA_RE.test(url)||seen.has(url))return;
        seen.add(url);
        observations.push({
          url,
          method:request.method(),
          resourceType:request.resourceType(),
          headers:sanitizeHeaders(request.headers()),
        });
      }catch{}
    });
    await page.goto(pageUrl.href,{waitUntil:'domcontentloaded',timeout:timeoutMs});
    await sleep(700);
    const before=await pageDiagnostics(page);
    await nudgePlayback(page);
    const remaining=Math.max(0,Math.min(5000,timeoutMs-(Date.now()-started)));
    if(remaining)await sleep(remaining);
    const after=await pageDiagnostics(page);
    return{
      service:'WebTV Browser Resolver',version:VERSION,url:pageUrl.href,
      elapsedMs:Date.now()-started,
      observations:observations.slice(0,MAX_OBSERVATIONS),
      diagnostics:{before,after},
      limits:{timeoutMs,maxObservations:MAX_OBSERVATIONS},
    };
  }finally{
    if(browser){try{await browser.close();}catch{}}
  }
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/')return json({service:'WebTV Browser Resolver',version:VERSION,ready:Boolean(env.BROWSER&&env.RESOLVER_SHARED_TOKEN),browserReady:Boolean(env.BROWSER),authConfigured:Boolean(env.RESOLVER_SHARED_TOKEN),allowedPageHosts:[...ALLOWED_PAGE_HOSTS]});
    if(request.method!=='POST'||url.pathname!=='/resolve')return json({error:'Not found'},404);
    if(!env.RESOLVER_SHARED_TOKEN)return json({error:'Resolver authentication is not configured'},503);
    if(!authorized(request,env))return json({error:'Unauthorized'},401);
    let body={};
    try{body=await request.json();}catch{return json({error:'Invalid JSON'},400);}
    try{return json(await resolve(body,env));}
    catch(error){
      const message=error?.message||String(error);
      const status=/allowlisted|HTTPS/.test(message)?400:/timeout/i.test(message)?408:502;
      return json({error:message,service:'WebTV Browser Resolver',version:VERSION},status);
    }
  }
};

export { ALLOWED_PAGE_HOSTS, APPROVED_HEADER_NAMES, MEDIA_RE, sanitizeHeaders, safePageUrl, timeoutFrom, pageDiagnostics };
