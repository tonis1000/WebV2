import { createCandidate } from '../../discovery/candidate-model.js';

const DEFAULT_ENDPOINT='https://source-huntatonisworkersdev.atonis.workers.dev';

function cleanEndpoint(value=''){
  return String(value||DEFAULT_ENDPOINT).trim().replace(/\/$/,'');
}

function safeOriginUrl(value=''){
  try{
    const url=new URL(String(value||'').trim());
    if(!/^https?:$/.test(url.protocol)||url.username||url.password)return '';
    return url.href;
  }catch{return '';}
}

function normalizedLead(item={},kind='lead'){
  const url=safeOriginUrl(item.url||item.source||'');
  if(!url)return null;
  return Object.freeze({
    leadId:String(item.leadId||`${kind}:${url}`),
    sourceUrl:url,
    sourceOriginUrl:url,
    sourceOriginLabel:String(item.origin||item.title||kind),
    title:String(item.title||''),
    snippet:String(item.snippet||item.description||''),
    updatedAt:item.updatedAt||null,
    leadStatus:String(item.leadStatus||''),
    leadType:String(item.leadType||''),
    xtreamTrial:item.xtreamTrial===true,
    xtreamEvidence:item.xtreamEvidence&&typeof item.xtreamEvidence==='object'?Object.freeze({...item.xtreamEvidence}):null,
    discoveryProvider:'hunt-exploration',
  });
}

function forumCandidate(item={},target={}){
  const sourceUrl=String(item.url||item.sourceUrl||'').trim();
  if(!sourceUrl)return null;
  const originUrl=safeOriginUrl(item.source||item.permalink||item.sourceOriginUrl||'');
  return createCandidate({
    channelName:String(item.channelName||target.name||target.query||''),
    sourceUrl,
    sourceType:item.sourceType||'',
    sourceOrigin:String(item.origin||'Forum / Reddit'),
    sourceOriginLabel:String(item.origin||item.title||'Forum / Reddit'),
    sourceOriginUrl:originUrl,
    inputFormatId:String(item.inputFormatId||item.sourceType||''),
    discoveryProvider:'hunt-exploration',
    freshness:item.updatedAt||null,
    requiredHeaders:item.requiredHeaders||{},
    verificationStatus:item.verificationStatus||'UNVERIFIED',
    matchConfidence:item.matchConfidence||'MEDIUM',
  });
}

export function createHuntExplorationAdapter({endpoint=DEFAULT_ENDPOINT,fetchImpl=globalThis.fetch}={}){
  const base=cleanEndpoint(endpoint);
  if(typeof fetchImpl!=='function')throw new Error('Hunt Exploration fetch implementation is required');
  return Object.freeze({
    async search({target={},source={},signal}={}){
      if(signal?.aborted)throw signal.reason||new DOMException('Hunt exploration cancelled','AbortError');
      const channel=String(target.name||target.query||target.id||'').trim();
      const url=new URL(`${base}/hunt`);
      url.searchParams.set('channel',channel);
      url.searchParams.set('days',String(source.days||30));
      if(source.paidFallback===true)url.searchParams.set('paid','1');
      const response=await fetchImpl(url.href,{cache:'no-store',signal});
      if(!response.ok){
        let detail='';
        try{detail=String((await response.json())?.error||'');}catch{}
        throw new Error(`Hunt Exploration HTTP ${response.status}${detail?` · ${detail}`:''}`);
      }
      const payload=await response.json();
      if(signal?.aborted)throw signal.reason||new DOMException('Hunt exploration cancelled','AbortError');
      const groups=payload?.groups||{};
      const candidates=[];
      const seenCandidates=new Set();
      for(const item of Array.isArray(groups.forums)?groups.forums:[]){
        const candidate=forumCandidate(item,target);
        if(!candidate||seenCandidates.has(candidate.sourceUrl))continue;
        seenCandidates.add(candidate.sourceUrl);
        candidates.push(candidate);
      }
      const leads=[];
      const seenLeads=new Set();
      for(const [kind,rows] of [['web',groups.webLeads],['forum',groups.forumLeads]]){
        for(const item of Array.isArray(rows)?rows:[]){
          const lead=normalizedLead(item,kind);
          if(!lead||seenLeads.has(lead.sourceUrl))continue;
          seenLeads.add(lead.sourceUrl);
          leads.push(lead);
        }
      }
      const reports=Array.isArray(payload?.debug)?payload.debug:[];
      return {candidates,leads,reports};
    },
  });
}

export const huntExplorationAdapter=createHuntExplorationAdapter();
