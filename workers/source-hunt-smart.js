import baseWorker from './source-huntatonisworkersdev.js';

const VERSION='1.15';
const MAX_ISSUES_PER_REQUEST=4;
const GITHUB_ISSUE_RE=/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:[/?#].*)?$/i;

function issueRef(raw=''){
  const match=String(raw||'').trim().match(GITHUB_ISSUE_RE);
  if(!match)return null;
  return {owner:match[1],repo:match[2],number:Number(match[3]),htmlUrl:`https://github.com/${match[1]}/${match[2]}/issues/${match[3]}`};
}
function issueUrlForItem(item={}){return issueRef(item.source)?.htmlUrl||issueRef(item.url)?.htmlUrl||'';}
function escapeRegExp(value=''){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function headerValue(body='',heading=''){
  const match=String(body||'').match(new RegExp(`###\\s+${escapeRegExp(heading)}\\s*\\n+([^\\n#]+)`,'i'));
  return String(match?.[1]||'').trim();
}
function requiredHeaders(body=''){
  const out={};
  const userAgent=headerValue(body,'HTTP User Agent');
  const referrer=headerValue(body,'HTTP Referrer')||headerValue(body,'HTTP Referer');
  if(userAgent)out['User-Agent']=userAgent;
  if(referrer)out.Referer=referrer;
  return out;
}
function labelsOf(issue={}){return (issue.labels||[]).map(label=>typeof label==='string'?label:String(label?.name||'')).filter(Boolean);}
function rejectionOf(issue={}){
  const labels=labelsOf(issue);
  if(labels.includes('rejected:broken_link'))return 'rejected-broken-link';
  const rejected=labels.find(label=>/^rejected:/i.test(label));
  return rejected?`rejected-${rejected.slice('rejected:'.length).replace(/[^a-z0-9]+/gi,'-').toLowerCase()}`:'';
}
async function fetchIssueMeta(raw){
  const ref=issueRef(raw);if(!ref)return null;
  const api=`https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}`;
  try{
    const response=await fetch(api,{headers:{Accept:'application/vnd.github+json','User-Agent':`WebTV-SourceHunt/${VERSION}`},redirect:'follow'});
    if(!response.ok)return {url:ref.htmlUrl,status:response.status,labels:[],rejection:'',requiredHeaders:{},available:false};
    const issue=await response.json();
    return {url:ref.htmlUrl,status:response.status,labels:labelsOf(issue),state:String(issue.state||''),stateReason:String(issue.state_reason||''),updatedAt:issue.updated_at||null,rejection:rejectionOf(issue),requiredHeaders:requiredHeaders(issue.body||''),available:true};
  }catch(error){return {url:ref.htmlUrl,status:0,labels:[],rejection:'',requiredHeaders:{},available:false,error:error?.message||String(error)};}
}
function cloneJsonResponse(response,payload){
  const headers=new Headers(response.headers);headers.set('content-type','application/json;charset=utf-8');headers.set('cache-control','no-store');headers.set('x-webtv-source-hunt-smart',VERSION);
  return new Response(JSON.stringify(payload),{status:response.status,headers});
}
async function issueMapForItems(items=[]){
  const urls=[...new Set(items.map(issueUrlForItem).filter(Boolean))].slice(0,MAX_ISSUES_PER_REQUEST);
  const rows=await Promise.all(urls.map(async url=>[url,await fetchIssueMeta(url)]));
  return new Map(rows);
}
function enrich(item,meta){
  if(!meta)return item;
  const broken=meta.rejection==='rejected-broken-link';
  const labels=meta.labels||[];
  const title=broken?`Rejected / broken link · ${item.title||'GitHub issue'}`:(item.title||'GitHub issue');
  const snippetParts=[];
  if(item.snippet)snippetParts.push(item.snippet);
  if(meta.state)snippetParts.push(`GitHub issue ${meta.state}${meta.stateReason?`/${meta.stateReason}`:''}`);
  if(labels.length)snippetParts.push(labels.join(', '));
  if(Object.keys(meta.requiredHeaders||{}).length)snippetParts.push(`headers: ${Object.keys(meta.requiredHeaders).join(' + ')}`);
  return {...item,title,snippet:snippetParts.join(' · ').slice(0,500),issueStatus:meta.state||'',issueLabels:labels,leadStatus:meta.rejection||'github-issue',requiredHeaders:meta.requiredHeaders||{},autoTestEligible:!meta.rejection};
}
function dedupe(items=[]){const seen=new Set();return items.filter(item=>{const key=String(item?.url||'');if(!key||seen.has(key))return false;seen.add(key);return true;});}
async function postProcessHunt(payload={}){
  const groups=payload.groups||{};
  const all=[...(groups.web||[]),...(groups.forums||[]),...(groups.webLeads||[]),...(groups.forumLeads||[])];
  const issueMap=await issueMapForItems(all);
  const web=[],forums=[],webLeads=[...(groups.webLeads||[])],forumLeads=[...(groups.forumLeads||[])];
  const processCandidates=(items,target,leadTarget)=>{
    for(const item of items||[]){
      const issueUrl=issueUrlForItem(item),meta=issueUrl?issueMap.get(issueUrl):null;
      if(meta?.rejection){leadTarget.push(enrich({...item,url:issueUrl,method:'github-issue-rejected'},meta));continue;}
      target.push(enrich(item,meta));
    }
  };
  processCandidates(groups.web,web,webLeads);processCandidates(groups.forums,forums,forumLeads);
  const enrichLeads=items=>items.map(item=>{const issueUrl=issueUrlForItem(item);return enrich(item,issueUrl?issueMap.get(issueUrl):null);});
  const finalGroups={...groups,web:dedupe(web),forums:dedupe(forums),webLeads:dedupe(enrichLeads(webLeads)),forumLeads:dedupe(enrichLeads(forumLeads))};
  const candidates=[...(finalGroups.seed||[]),...finalGroups.web,...finalGroups.forums].slice(0,12);
  const rejected=[...issueMap.values()].filter(meta=>meta?.rejection).length;
  return {...payload,version:VERSION,groups:finalGroups,candidates,counts:{...(payload.counts||{}),seed:(finalGroups.seed||[]).length,web:finalGroups.web.length,forums:finalGroups.forums.length,webLeads:finalGroups.webLeads.length,forumLeads:finalGroups.forumLeads.length,total:candidates.length},issueIntelligence:{checked:issueMap.size,rejected,policy:'GitHub issues labelled rejected:* are retained only as historical leads and never auto-tested.'}};
}
async function postProcessInspect(request,payload={}){
  const url=new URL(request.url);const target=url.searchParams.get('url')||'';const meta=await fetchIssueMeta(target);
  if(meta?.rejection){
    const blocked=enrich({url:meta.url,kind:'web',origin:'GitHub issue',title:'GitHub issue',source:meta.url,snippet:'',updatedAt:meta.updatedAt||null,method:'github-issue-rejected'},meta);
    return {...payload,version:VERSION,candidates:[],leads:[blocked],blockedReason:meta.rejection,issueIntelligence:meta};
  }
  if(!meta)return {...payload,version:VERSION};
  return {...payload,version:VERSION,candidates:(payload.candidates||[]).map(item=>enrich(item,meta)),leads:(payload.leads||[]).map(item=>enrich(item,meta)),issueIntelligence:meta};
}

export default {async fetch(request,env,ctx){
  const response=await baseWorker.fetch(request,env,ctx);
  const url=new URL(request.url);
  if(url.pathname!=='/'&&url.pathname!=='/hunt'&&url.pathname!=='/inspect')return response;
  const type=response.headers.get('content-type')||'';if(!type.includes('application/json'))return response;
  let payload;try{payload=await response.clone().json();}catch{return response;}
  if(url.pathname==='/hunt'&&response.ok)payload=await postProcessHunt(payload);
  else if(url.pathname==='/inspect'&&response.ok)payload=await postProcessInspect(request,payload);
  else if(url.pathname==='/')payload={...payload,version:VERSION,features:[...(payload.features||[]),'GitHub issue labels/state intelligence','rejected issue auto-test block','issue User-Agent/Referrer extraction']};
  return cloneJsonResponse(response,payload);
}};
