import { greekChannelAliases, normalizeChannelText } from '../../src/core/channel-identity-gr.js';

export const GITHUB_PUBLIC_PLAYLISTS_PROVIDER='github-public-playlists';
export const GITHUB_SEARCH_TIMEOUT_MS=6000;
export const GITHUB_MAX_SEARCHES=4;
export const GITHUB_MAX_REPOS=5;
export const GITHUB_MAX_FILES_PER_REPO=2;
export const GITHUB_MAX_RESULTS=12;
export const GITHUB_MAX_SUBREQUESTS=18;

const BASE_SEARCH_TERMS=Object.freeze(['greek iptv','greece m3u']);
const FRESHNESS_DAYS=Object.freeze({'24h':1,'7d':7,'30d':30});
const PLAYLIST_NAME=/(?:\.m3u8?$|playlist|channels|android|iptv|greek.*tv|tv.*greek)/i;
const GREEK_PATH_HINT=/(?:^|[\/_.+ -])(?:greece|greek|hellas|gr)(?:[\/_.+ -]|$)/i;

function sinceDate(freshness='7d'){
  const days=FRESHNESS_DAYS[freshness]||7;
  return new Date(Date.now()-days*86400000).toISOString().slice(0,10);
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
function channelAliases(channel={}){
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
function searchTermsFor(channel={}){
  const aliases=channelAliases(channel);
  const primary=aliases[0]||String(channel.name||'').trim();
  const alternate=aliases.find((value,index)=>index>0&&normalizeChannelText(value)!==normalizeChannelText(primary))||primary;
  return normalizedUnique([
    ...BASE_SEARCH_TERMS,
    `${quoteSearch(primary)} greece iptv in:readme`,
    `${quoteSearch(alternate)} greek tv playlist in:readme`,
  ]).slice(0,GITHUB_MAX_SEARCHES);
}
function treeFileLooksUseful(item={}){
  const path=String(item?.path||'');
  const name=path.split('/').pop()||'';
  const size=Number(item?.size||0);
  return item?.type==='blob'&&size>0&&size<=1200000&&PLAYLIST_NAME.test(name);
}
function treeFileScore(item={}){
  const path=String(item?.path||'');
  const name=path.split('/').pop()||'';
  let score=0;
  if(GREEK_PATH_HINT.test(path))score+=10;
  if(/(?:^|\/)(?:playlists?|streams?|channels?|countries|stable)(?:\/|$)/i.test(path))score+=4;
  if(/\.m3u8?$/i.test(name))score+=3;
  if(/^(?:gr|greece|greek)[^/]*\.m3u8?$/i.test(name))score+=5;
  return score;
}
function rawUrl(repo={},path=''){
  const fullName=String(repo.full_name||'').split('/').map(encodeURIComponent).join('/');
  const ref=encodeURIComponent(String(repo.default_branch||'main'));
  const encodedPath=String(path||'').split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${fullName}/${ref}/${encodedPath}`;
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
  for(const repo of items){
    const key=String(repo?.full_name||'');
    if(!key||seen.has(key)||repo?.archived||repo?.fork)continue;
    seen.add(key);out.push(repo);
    if(out.length>=GITHUB_MAX_REPOS)break;
  }
  return out;
}
function uniqueTreeFiles(items=[]){
  const seen=new Set();const out=[];
  for(const item of items){
    const key=String(item?.path||'');
    if(!key||seen.has(key)||!treeFileLooksUseful(item))continue;
    seen.add(key);out.push(item);
  }
  return out.sort((a,b)=>treeFileScore(b)-treeFileScore(a)).slice(0,GITHUB_MAX_FILES_PER_REPO);
}
function uniqueCandidates(items=[]){
  const seen=new Set();const out=[];
  for(const item of items){const key=String(item?.sourceUrl||'');if(!key||seen.has(key))continue;seen.add(key);out.push(item);if(out.length>=GITHUB_MAX_RESULTS)break;}
  return out;
}

export async function discoverGithubPublicPlaylists({channel,freshness='7d',parseM3u}={}){
  if(typeof parseM3u!=='function')throw new Error('parseM3u dependency is required');
  const budget=new Budget();const pushedSince=sinceDate(freshness);const searchReports=[];const repoPool=[];
  for(const term of searchTermsFor(channel)){
    if(budget.remaining()<=0)break;
    const q=`${term} pushed:>=${pushedSince}`;
    const url=`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=5`;
    const result=await fetchJson(url,budget);
    searchReports.push({query:term,status:result.status,elapsedMs:result.elapsedMs,rateRemaining:result.remaining,error:result.error||''});
    if(result.ok)repoPool.push(...(result.body?.items||[]));
  }

  const repos=uniqueRepos(repoPool);const repoReports=[];const candidates=[];
  for(const repo of repos){
    if(budget.remaining()<=0||candidates.length>=GITHUB_MAX_RESULTS)break;
    const safeRepo=String(repo.full_name||'').split('/').map(encodeURIComponent).join('/');
    const treeUrl=`https://api.github.com/repos/${safeRepo}/git/trees/${encodeURIComponent(repo.default_branch||'main')}?recursive=1`;
    const listing=await fetchJson(treeUrl,budget);
    if(!listing.ok){
      repoReports.push({repo:repo.full_name,pushedAt:repo.pushed_at||null,status:listing.status,recursive:true,truncated:false,files:0,matches:0,error:listing.error||''});
      continue;
    }
    const files=uniqueTreeFiles(Array.isArray(listing.body?.tree)?listing.body.tree:[]);
    let matches=0;let filesFetched=0;
    for(const file of files){
      if(budget.remaining()<=0||candidates.length>=GITHUB_MAX_RESULTS)break;
      const raw=await fetchText(rawUrl(repo,file.path),budget);
      filesFetched++;
      if(!raw.ok)continue;
      const found=parseM3u(raw.text,channel,{name:`github:${repo.full_name}/${file.path}`,provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,freshness:`repo-pushed:${repo.pushed_at||'unknown'}`})
        .map(item=>({...item,discoveryProvider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER}));
      matches+=found.length;candidates.push(...found);
    }
    repoReports.push({repo:repo.full_name,pushedAt:repo.pushed_at||null,status:listing.status,recursive:true,truncated:Boolean(listing.body?.truncated),files:filesFetched,matches,error:''});
  }

  return {
    provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,
    freshnessRequested:freshness,
    freshnessApplied:true,
    freshnessNote:`GitHub repositories are filtered by pushed_at >= ${pushedSince}; up to four repository queries include channel-aware README discovery, and each selected repository is scanned recursively for playlist files before candidate matching.`,
    pushedSince,
    limits:{timeoutMs:GITHUB_SEARCH_TIMEOUT_MS,maxSearches:GITHUB_MAX_SEARCHES,maxRepos:GITHUB_MAX_REPOS,maxFilesPerRepo:GITHUB_MAX_FILES_PER_REPO,maxResults:GITHUB_MAX_RESULTS,maxSubrequests:GITHUB_MAX_SUBREQUESTS},
    candidates:uniqueCandidates(candidates),
    reports:{searches:searchReports,repositories:repoReports,subrequestsUsed:budget.used},
  };
}
