export const GITHUB_PUBLIC_PLAYLISTS_PROVIDER='github-public-playlists';
export const GITHUB_SEARCH_TIMEOUT_MS=6000;
export const GITHUB_MAX_REPOS=4;
export const GITHUB_MAX_FILES_PER_REPO=2;
export const GITHUB_MAX_RESULTS=12;
export const GITHUB_MAX_SUBREQUESTS=10;

const SEARCH_TERMS=Object.freeze(['greek iptv','greece m3u']);
const FRESHNESS_DAYS=Object.freeze({'24h':1,'7d':7,'30d':30});
const PLAYLIST_NAME=/(?:\.m3u8?$|playlist|channels|android|iptv|greek.*tv|tv.*greek)/i;

function sinceDate(freshness='7d'){
  const days=FRESHNESS_DAYS[freshness]||7;
  return new Date(Date.now()-days*86400000).toISOString().slice(0,10);
}
function rawFileLooksUseful(file={}){
  return file?.type==='file' && Number(file.size||0)>0 && Number(file.size||0)<=1200000 && PLAYLIST_NAME.test(String(file.name||'')) && /^https:\/\//i.test(String(file.download_url||''));
}
class Budget{
  constructor(limit=GITHUB_MAX_SUBREQUESTS){this.limit=limit;this.used=0;}
  take(){if(this.used>=this.limit)throw new Error('GitHub provider subrequest budget exhausted');this.used++;}
  remaining(){return Math.max(0,this.limit-this.used);}
}
async function timedFetch(url,{headers={},accept='application/vnd.github+json'}={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(new DOMException('timeout','AbortError')),GITHUB_SEARCH_TIMEOUT_MS);
  try{return await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':'WebTV-Discovery/1.1','accept':accept,'x-github-api-version':'2022-11-28',...headers}});}finally{clearTimeout(timer);}
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
function uniqueCandidates(items=[]){
  const seen=new Set();const out=[];
  for(const item of items){const key=String(item?.sourceUrl||'');if(!key||seen.has(key))continue;seen.add(key);out.push(item);if(out.length>=GITHUB_MAX_RESULTS)break;}
  return out;
}

export async function discoverGithubPublicPlaylists({channel,freshness='7d',parseM3u}={}){
  if(typeof parseM3u!=='function')throw new Error('parseM3u dependency is required');
  const budget=new Budget();const pushedSince=sinceDate(freshness);const searchReports=[];const repoPool=[];
  for(const term of SEARCH_TERMS){
    const q=`${term} pushed:>=${pushedSince} fork:false`;
    const url=`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=5`;
    const result=await fetchJson(url,budget);
    searchReports.push({query:term,status:result.status,elapsedMs:result.elapsedMs,rateRemaining:result.remaining,error:result.error||''});
    if(result.ok)repoPool.push(...(result.body?.items||[]));
  }
  const repos=uniqueRepos(repoPool);const repoReports=[];const candidates=[];
  for(const repo of repos){
    if(budget.remaining()<=0)break;
    const contentsUrl=`https://api.github.com/repos/${repo.full_name}/contents?ref=${encodeURIComponent(repo.default_branch||'main')}`;
    const listing=await fetchJson(contentsUrl,budget);
    if(!listing.ok){repoReports.push({repo:repo.full_name,pushedAt:repo.pushed_at||null,status:listing.status,files:0,matches:0,error:listing.error||''});continue;}
    const files=(Array.isArray(listing.body)?listing.body:[]).filter(rawFileLooksUseful).slice(0,GITHUB_MAX_FILES_PER_REPO);
    let matches=0;
    for(const file of files){
      if(budget.remaining()<=0)break;
      const raw=await fetchText(file.download_url,budget);
      if(!raw.ok)continue;
      const found=parseM3u(raw.text,channel,{name:`github:${repo.full_name}/${file.name}`,provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,freshness:`repo-pushed:${repo.pushed_at||'unknown'}`});
      matches+=found.length;candidates.push(...found);
      if(candidates.length>=GITHUB_MAX_RESULTS)break;
    }
    repoReports.push({repo:repo.full_name,pushedAt:repo.pushed_at||null,status:listing.status,files:files.length,matches,error:''});
    if(candidates.length>=GITHUB_MAX_RESULTS)break;
  }
  return {
    provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER,
    freshnessRequested:freshness,
    freshnessApplied:true,
    freshnessNote:`GitHub repositories filtered by pushed_at >= ${pushedSince}; individual playlist entries may be older than the repository push.`,
    pushedSince,
    limits:{timeoutMs:GITHUB_SEARCH_TIMEOUT_MS,maxRepos:GITHUB_MAX_REPOS,maxFilesPerRepo:GITHUB_MAX_FILES_PER_REPO,maxResults:GITHUB_MAX_RESULTS,maxSubrequests:GITHUB_MAX_SUBREQUESTS},
    candidates:uniqueCandidates(candidates),
    reports:{searches:searchReports,repositories:repoReports,subrequestsUsed:budget.used},
  };
}
