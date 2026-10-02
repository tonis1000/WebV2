import { greekChannelAliases, normalizeChannelText } from '../../src/core/channel-identity-gr.js';

export const GITHUB_PUBLIC_PLAYLISTS_PROVIDER='github-public-playlists';
export const GITHUB_SEARCH_TIMEOUT_MS=6000;
export const GITHUB_MAX_REPOS=4;
export const GITHUB_MAX_FILES_PER_REPO=2;
export const GITHUB_MAX_CODE_SEARCHES=2;
export const GITHUB_MAX_CODE_FILES=3;
export const GITHUB_MAX_RESULTS=12;
export const GITHUB_MAX_SUBREQUESTS=16;

const SEARCH_TERMS=Object.freeze(['greek iptv','greece m3u']);
const FRESHNESS_DAYS=Object.freeze({'24h':1,'7d':7,'30d':30});
const PLAYLIST_NAME=/(?:\.m3u8?$|playlist|channels|android|iptv|greek.*tv|tv.*greek)/i;
const CODE_PLAYLIST_PATH=/\.m3u8?$/i;
const GREEK_PATH_HINT=/(?:^|[\/_.+ -])(?:greece|greek|hellas|gr)(?:[\/_.+ -]|$)/i;

function sinceDate(freshness='7d'){
  const days=FRESHNESS_DAYS[freshness]||7;
  return new Date(Date.now()-days*86400000).toISOString().slice(0,10);
}
function rawFileLooksUseful(file={}){
  return file?.type==='file' && Number(file.size||0)>0 && Number(file.size||0)<=1200000 && PLAYLIST_NAME.test(String(file.name||'')) && /^https:\/\//i.test(String(file.download_url||''));
}
function normalizedUnique(values=[]){
  const seen=new Set();const out=[];
  for(const value of values){
    const text=String(value||'').trim();
    const key=normalizeChannelText(text);
    if(!text||!key||seen.has(key))continue;
    seen.add(key);out.push(text);
  }
  return out;
}
function codeSearchAliases(channel={}){
  const seed=String(channel.name||channel.originalId||channel.tvgId||channel.id||'').trim();
  const aliases=normalizedUnique([
    seed,
    ...greekChannelAliases(seed),
    channel.originalId,
    channel.tvgId,
    channel.id,
  ]).filter(value=>/[a-z0-9]/i.test(value));
  return aliases.length?aliases:[seed].filter(Boolean);
}
function quoteSearch(value=''){
  return `"${String(value||'').replace(/[\\"]/g,' ').replace(/\s+/g,' ').trim()}"`;
}
function codeSearchSpecs(channel={}){
  const aliases=codeSearchAliases(channel);
  const primary=aliases[0]||String(channel.name||'').trim();
  const alternate=aliases.find((value,index)=>index>0&&normalizeChannelText(value)!==normalizeChannelText(primary))||primary;
  return [
    {alias:primary,context:'Greece',extension:'m3u'},
    {alias:alternate,context:'Greek',extension:'m3u8'},
  ].slice(0,GITHUB_MAX_CODE_SEARCHES);
}
function codeItemKey(item={}){
  return `${String(item?.repository?.full_name||'')}|${String(item?.path||item?.name||'')}`;
}
function codeItemScore(item={}){
  const text=`${item?.repository?.full_name||''}/${item?.path||item?.name||''}`;
  let score=0;
  if(GREEK_PATH_HINT.test(text))score+=8;
  if(/(?:playlist|channels|iptv|streams?)/i.test(text))score+=3;
  if(/\.m3u8?$/i.test(String(item?.path||item?.name||'')))score+=2;
  return score;
}
function recentEnough(repo={},pushedSince=''){
  const pushed=Date.parse(String(repo?.pushed_at||''));
  const since=Date.parse(`${pushedSince}T00:00:00Z`);
  return Number.isFinite(pushed)&&Number.isFinite(since)&&pushed>=since;
}
function decodeGithubContent(body={}){
  const encoded=String(body?.content||'').replace(/\s+/g,'');
  if(String(body?.encoding||'').toLowerCase()!=='base64'||!encoded)return '';
  try{
    const binary=atob(encoded);
    const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }catch{return '';}
}
class Budget{
  constructor(limit=GITHUB_MAX_SUBREQUESTS){this.limit=limit;this.used=0;}
  take(){if(this.used>=this.limit)throw new Error('GitHub provider subrequest budget exhausted');this.used++;}
  remaining(){return Math.max(0,this.limit-this.used);}
}
async function timedFetch(url,{headers={},accept='application/vnd.github+json'}={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(new DOMException('timeout','AbortError')),GITHUB_SEARCH_TIMEOUT_MS);
  try{return await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':'WebTV-Discovery/1.2','accept':accept,'x-github-api-version':'2022-11-28',...headers}});}finally{clearTimeout(timer);}
}
async function fetchJson(url,budget){
  budget.take();
  const started=Date.now();
  try{
    const response=await timedFetch(url);
    const body=await response.json().catch(()=>({}));
    return {ok:response.ok,status:response.status,body,elapsedMs:Date.now()-started,remaining:response.headers.get('x-ratelimit-remaining')};
  }catch(error){return {ok:false,status:error?.name==='AbortError'?408:0,body:{},elapsedMs:Date.now()-started,error:error?.message||String(error),remaining:null};}
}
async function fetchText(url,budget){
  budget.take();const started=Date.now();
  try{
    const response=await timedFetch(url,{accept:'text/plain,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'});
    if(!response.ok)return {ok:false,status:response.status,text:'',elapsedMs:Date.now()-started};
    return {ok:true,status:response.status,text:(await response.text()).slice(0,1200000),elapsedMs:Date.now()-started};
  }catch(error){return {ok:false,status:error?.name==='AbortError'?408:0,text:'',elapsedMs:Date.now()-started,error:error?.message||String(error)};}
}
function uniqueRepos(items=[]){
  const seen=new Set();const out=[];
  for(const repo of items){const key=String(repo?.full_name||'');if(!key||seen.has(key)||repo?.archived||repo?.fork)continue;seen.add(key);out.push(repo);if(out.length>=GITHUB_MAX_REPOS)break;}
  return out;
}
function uniqueCodeItems(items=[]){
  const seen=new Set();const out=[];
  for(const item of items){
    const key=codeItemKey(item);
    const path=String(item?.path||item?.name||'');
    if(!key||key==='|'||seen.has(key)||!CODE_PLAYLIST_PATH.test(path)||!String(item?.repository?.full_name||''))continue;
    seen.add(key);out.push(item);
  }
  return out.sort((a,b)=>codeItemScore(b)-codeItemScore(a));
}
function uniqueCandidates(items=[]){
  const seen=new Set();const out=[];
  for(const item of items){const key=String(item?.sourceUrl||'');if(!key||seen.has(key))continue;seen.add(key);out.push(item);if(out.length>=GITHUB_MAX_RESULTS)break;}
  return out;
}
async function fetchRepoMeta(fullName,budget,cache){
  const key=String(fullName||'').trim();
  if(!key)return {ok:false,status:0,body:{},error:'Missing repository name'};
  if(cache.has(key))return cache.get(key);
  if(budget.remaining()<=0)return {ok:false,status:0,body:{},error:'No request budget remaining'};
  const safe=key.split('/').map(encodeURIComponent).join('/');
  const result=await fetchJson(`https://api.github.com/repos/${safe}`,budget);
  cache.set(key,result);
  return result;
}

export async function discoverGithubPublicPlaylists({channel,freshness='7d',parseM3u}={}){
  if(typeof parseM3u!=='function')throw new Error('parseM3u dependency is required');
  const budget=new Budget();const pushedSince=sinceDate(freshness);const searchReports=[];const repoPool=[];
  for(const term of SEARCH_TERMS){
    const q=`${term} pushed:>=${pushedSince}`;
    const url=`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=5`;
    const result=await fetchJson(url,budget);
    searchReports.push({query:term,status:result.status,elapsedMs:result.elapsedMs,rateRemaining:result.remaining,error:result.error||''});
    if(result.ok)repoPool.push(...(result.body?.items||[]));
  }

  const codeSearchReports=[];const codePool=[];
  for(const spec of codeSearchSpecs(channel)){
    if(budget.remaining()<=0)break;
    const q=`${quoteSearch(spec.alias)} ${spec.context} extension:${spec.extension}`;
    const url=`https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=10`;
    const result=await fetchJson(url,budget);
    codeSearchReports.push({query:q,status:result.status,elapsedMs:result.elapsedMs,rateRemaining:result.remaining,error:result.error||'',count:Array.isArray(result.body?.items)?result.body.items.length:0});
    if(result.ok)codePool.push(...(result.body?.items||[]));
  }

  const candidates=[];const codeFiles=[];const repoMetaCache=new Map();
  let inspectedCodeFiles=0;
  for(const item of uniqueCodeItems(codePool)){
    if(inspectedCodeFiles>=GITHUB_MAX_CODE_FILES||budget.remaining()<2||candidates.length>=GITHUB_MAX_RESULTS)break;
    const repoName=String(item?.repository?.full_name||'');
    const repoMeta=await fetchRepoMeta(repoName,budget,repoMetaCache);
    if(!repoMeta.ok){
      codeFiles.push({repo:repoName,path:String(item?.path||''),status:repoMeta.status||0,matches:0,rejected:'repo-metadata',error:repoMeta.error||''});
      continue;
    }
    const repo=repoMeta.body||{};
    if(repo.archived||repo.fork||!recentEnough(repo,pushedSince)){
      codeFiles.push({repo:repoName,path:String(item?.path||''),status:repoMeta.status||0,matches:0,rejected:repo.archived?'archived':repo.fork?'fork':'stale',pushedAt:repo.pushed_at||null,error:''});
      continue;
    }
    inspectedCodeFiles++;
    const file=await fetchJson(String(item.url||''),budget);
    if(!file.ok){
      codeFiles.push({repo:repoName,path:String(item?.path||''),status:file.status||0,matches:0,rejected:'file-fetch',pushedAt:repo.pushed_at||null,error:file.error||''});
      continue;
    }
    const body=file.body||{};
    if(body.type!=='file'||Number(body.size||0)>1200000){
      codeFiles.push({repo:repoName,path:String(item?.path||''),status:file.status||0,matches:0,rejected:'not-usable-file',pushedAt:repo.pushed_at||null,error:''});
      continue;
    }
    const text=decodeGithubContent(body).slice(0,1200000);
    if(!text){
      codeFiles.push({repo:repoName,path:String(item?.path||''),status:file.status||0,matches:0,rejected:'empty-content',pushedAt:repo.pushed_at||null,error:''});
      continue;
    }
    const path=String(item?.path||body.path||body.name||'playlist.m3u');
    const found=parseM3u(text,channel,{name:`github-code:${repoName}/${path}`,provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,freshness:`repo-pushed:${repo.pushed_at||'unknown'}`})
      .map(row=>({...row,discoveryProvider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER}));
    candidates.push(...found);
    codeFiles.push({repo:repoName,path,status:file.status||0,matches:found.length,pushedAt:repo.pushed_at||null,rejected:'',error:''});
  }

  const repos=uniqueRepos(repoPool);const repoReports=[];
  for(const repo of repos){
    if(budget.remaining()<=0||candidates.length>=GITHUB_MAX_RESULTS)break;
    const contentsUrl=`https://api.github.com/repos/${repo.full_name}/contents?ref=${encodeURIComponent(repo.default_branch||'main')}`;
    const listing=await fetchJson(contentsUrl,budget);
    if(!listing.ok){repoReports.push({repo:repo.full_name,pushedAt:repo.pushed_at||null,status:listing.status,files:0,matches:0,error:listing.error||''});continue;}
    const files=(Array.isArray(listing.body)?listing.body:[]).filter(rawFileLooksUseful).slice(0,GITHUB_MAX_FILES_PER_REPO);
    let matches=0;let filesFetched=0;
    for(const file of files){
      if(budget.remaining()<=0||candidates.length>=GITHUB_MAX_RESULTS)break;
      const raw=await fetchText(file.download_url,budget);
      filesFetched++;
      if(!raw.ok)continue;
      const found=parseM3u(raw.text,channel,{name:`github:${repo.full_name}/${file.name}`,provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,freshness:`repo-pushed:${repo.pushed_at||'unknown'}`})
        .map(item=>({...item,discoveryProvider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER}));
      matches+=found.length;candidates.push(...found);
    }
    repoReports.push({repo:repo.full_name,pushedAt:repo.pushed_at||null,status:listing.status,files:filesFetched,matches,error:''});
  }
  return {
    provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,
    freshnessRequested:freshness,
    freshnessApplied:true,
    freshnessNote:`Repository discovery and channel-aware code-search hits are accepted only from repositories pushed at or after ${pushedSince}; code search adds subfolder coverage without bypassing freshness.`,
    pushedSince,
    limits:{timeoutMs:GITHUB_SEARCH_TIMEOUT_MS,maxRepos:GITHUB_MAX_REPOS,maxFilesPerRepo:GITHUB_MAX_FILES_PER_REPO,maxCodeSearches:GITHUB_MAX_CODE_SEARCHES,maxCodeFiles:GITHUB_MAX_CODE_FILES,maxResults:GITHUB_MAX_RESULTS,maxSubrequests:GITHUB_MAX_SUBREQUESTS},
    candidates:uniqueCandidates(candidates),
    reports:{searches:searchReports,codeSearches:codeSearchReports,codeFiles,repositories:repoReports,subrequestsUsed:budget.used},
  };
}
