import { normalizeChannelName } from '../discovery/candidate-model.js';

function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  for(const child of Object.values(value))deepFreeze(child);
  return Object.freeze(value);
}

function normalizedHeaders(headers={}){
  return Object.entries(headers||{})
    .map(([key,value])=>[String(key).trim().toLowerCase(),String(value||'').trim()])
    .filter(([key,value])=>key&&value)
    .sort(([a],[b])=>a.localeCompare(b));
}

function playbackKey(candidate={}){
  return `${String(candidate.sourceUrl||'').trim()}|${JSON.stringify(normalizedHeaders(candidate.requiredHeaders))}`;
}

function provenanceOf(candidate={}){
  const label=String(candidate.sourceOriginLabel||candidate.sourceOrigin||candidate.discoveryProvider||'').trim();
  const url=String(candidate.sourceOriginUrl||'').trim();
  const provider=String(candidate.discoveryProvider||'').trim();
  if(!label&&!url&&!provider)return null;
  return Object.freeze({label,url,provider});
}

function mergeProvenance(current=[],candidate={}){
  const next=[...(current||[])];
  const item=provenanceOf(candidate);
  if(item){
    const key=`${item.label}|${item.url}|${item.provider}`;
    if(!next.some(existing=>`${existing.label}|${existing.url}|${existing.provider}`===key))next.push(item);
  }
  return next;
}

function targetMap(intent={}){
  const map=new Map();
  for(const target of intent?.targets||[]){
    const id=String(target?.id||'').trim();
    const name=String(target?.name||target?.originalId||id).trim();
    if(!id&&!name)continue;
    for(const key of [id,name].map(normalizeChannelName).filter(Boolean))map.set(key,{id:id||key,name:name||id||key});
  }
  return map;
}

function channelIdentity(candidate={},intent={}){
  const targets=targetMap(intent);
  const explicitKey=normalizeChannelName(candidate.channelId||candidate.normalizedChannelName||'');
  const nameKey=normalizeChannelName(candidate.channelName||'');
  const matched=targets.get(explicitKey)||targets.get(nameKey)||null;
  if(matched)return {key:String(matched.id),name:String(matched.name)};
  const conservative=explicitKey||nameKey||normalizeChannelName(candidate.candidateId||'unknown');
  return {key:conservative||'unknown',name:String(candidate.channelName||conservative||'Unknown')};
}

export function groupCandidatesByChannel(candidates=[],intent={}){
  const groups=new Map();
  const targetOrder=new Map((intent?.targets||[]).map((target,index)=>[String(target?.id||''),index]));

  for(const raw of candidates||[]){
    if(!raw||typeof raw!=='object')continue;
    const identity=channelIdentity(raw,intent);
    if(!groups.has(identity.key))groups.set(identity.key,{channelKey:identity.key,channelName:identity.name,candidates:[],candidateIndex:new Map()});
    const group=groups.get(identity.key);
    const key=playbackKey(raw)||String(raw.candidateId||'');
    const existingIndex=group.candidateIndex.get(key);
    if(existingIndex===undefined){
      const provenanceSources=mergeProvenance([],raw);
      group.candidateIndex.set(key,group.candidates.length);
      group.candidates.push({...raw,provenanceSources});
    }else{
      const current=group.candidates[existingIndex];
      group.candidates[existingIndex]={...current,provenanceSources:mergeProvenance(current.provenanceSources,raw)};
    }
  }

  const result=[...groups.values()].map(group=>({
    channelKey:group.channelKey,
    channelName:group.channelName,
    candidates:group.candidates,
  }));
  result.sort((a,b)=>{
    const ai=targetOrder.has(a.channelKey)?targetOrder.get(a.channelKey):Number.MAX_SAFE_INTEGER;
    const bi=targetOrder.has(b.channelKey)?targetOrder.get(b.channelKey):Number.MAX_SAFE_INTEGER;
    return ai-bi||a.channelName.localeCompare(b.channelName);
  });
  return deepFreeze(result);
}
