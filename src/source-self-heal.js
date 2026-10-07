const SELF_HEAL_PREFIX='self-heal:';
const CURATED_PROVIDER='curated-remote-feeds';
const ALLOWED_HEADERS=['User-Agent','Referer','Origin','X-Roku-Reserved-Dev-Id'];

function cleanToken(value=''){
  return String(value||'').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g,'-').replace(/^-+|-+$/g,'');
}
function unique(values=[]){
  return [...new Set((Array.isArray(values)?values:[]).map(value=>String(value||'').trim()).filter(Boolean))];
}

export function buildRefreshOrigin(candidate={}){
  const provider=cleanToken(candidate.discoveryProvider||candidate.provider||CURATED_PROVIDER)||CURATED_PROVIDER;
  const familyIds=unique([
    candidate.sourceFamilyId,
    ...(Array.isArray(candidate.sourceObservations)?candidate.sourceObservations.map(item=>item?.sourceFamilyId):[]),
  ]).map(cleanToken).filter(Boolean).sort();
  return `${SELF_HEAL_PREFIX}${provider}:${familyIds.join(',')}`;
}

export function parseRefreshOrigin(origin=''){
  const text=String(origin||'').trim();
  if(!text||text==='curated'||text==='playlist')return{provider:CURATED_PROVIDER,familyIds:[]};
  if(text.startsWith(SELF_HEAL_PREFIX)){
    const rest=text.slice(SELF_HEAL_PREFIX.length);
    const split=rest.indexOf(':');
    const provider=cleanToken(split>=0?rest.slice(0,split):rest)||CURATED_PROVIDER;
    const familyIds=split>=0?unique(rest.slice(split+1).split(',').map(cleanToken).filter(Boolean)).sort():[];
    return{provider,familyIds};
  }
  const best=text.match(/^best-source:([^:]+)(?::(.+))?$/i);
  if(best){
    return{
      provider:cleanToken(best[1])||CURATED_PROVIDER,
      familyIds:best[2]?unique(best[2].split(',').map(cleanToken).filter(Boolean)).sort():[],
    };
  }
  return{provider:CURATED_PROVIDER,familyIds:[]};
}

export function candidatePlaybackReference(candidate={}){
  const base=String(candidate.sourceUrl||'').split('|')[0].trim();
  if(!/^https?:\/\//i.test(base))return'';
  const headers=candidate.requiredHeaders&&typeof candidate.requiredHeaders==='object'?candidate.requiredHeaders:{};
  const options=new URLSearchParams();
  for(const canonical of ALLOWED_HEADERS){
    const key=Object.keys(headers).find(item=>String(item).toLowerCase()===canonical.toLowerCase());
    const value=key?String(headers[key]??'').trim():'';
    if(value&&!/[\r\n\0]/.test(value))options.set(canonical,value);
  }
  return base+(options.size?`|${options.toString()}`:'');
}

function familySet(candidate={}){
  return new Set(unique([
    candidate.sourceFamilyId,
    ...(Array.isArray(candidate.sourceObservations)?candidate.sourceObservations.map(item=>item?.sourceFamilyId):[]),
  ]).map(cleanToken).filter(Boolean));
}

export function selectRefreshCandidates(candidates=[],refreshRef={}){
  const provider=cleanToken(refreshRef?.provider||CURATED_PROVIDER)||CURATED_PROVIDER;
  const wanted=new Set(unique(refreshRef?.familyIds||[]).map(cleanToken).filter(Boolean));
  return (Array.isArray(candidates)?candidates:[]).filter(candidate=>{
    const candidateProvider=cleanToken(candidate?.discoveryProvider||candidate?.provider||CURATED_PROVIDER)||CURATED_PROVIDER;
    if(candidateProvider!==provider)return false;
    if(!wanted.size)return true;
    const families=familySet(candidate);
    return [...wanted].some(id=>families.has(id));
  });
}

export function selfHealSaveEligibility({candidate={},playbackConfirmed=false,existingSavedChannel=false}={}){
  if(!existingSavedChannel)return{enabled:false,reason:'existing-saved-channel-required'};
  if(candidate.verified!==true||String(candidate.verificationStatus||'').toUpperCase()!=='VERIFIED')return{enabled:false,reason:'verified-media-required'};
  if(String(candidate.streamKind||'unknown').toLowerCase()!=='live')return{enabled:false,reason:'live-media-required'};
  if(candidate.drmDetected===true)return{enabled:false,reason:'drm-blocked'};
  if(candidate.browserPlayable!==true)return{enabled:false,reason:'browser-playable-required'};
  if(!playbackConfirmed)return{enabled:false,reason:'playback-confirmation-required'};
  if(!candidatePlaybackReference(candidate))return{enabled:false,reason:'playback-reference-required'};
  return{enabled:true,reason:'verified-playback-confirmed-refresh'};
}

export function refreshReferencesForSourceRows(sourceRows=[]){
  const refs=[];
  for(const row of Array.isArray(sourceRows)?sourceRows:[]){
    const parsed=parseRefreshOrigin(row?.origin||'');
    refs.push({url:String(row?.url||'').trim(),origin:String(row?.origin||''),provider:parsed.provider,familyIds:parsed.familyIds});
  }
  return refs;
}

export { CURATED_PROVIDER as SELF_HEAL_CURATED_PROVIDER };
