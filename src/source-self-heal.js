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

export async function runSourceSelfHeal({
  channel={},
  refs=[],
  failedSavedUrls=[],
  discoverProvider=()=>null,
  verifyCandidates=async candidates=>candidates,
  playCandidate=async()=>{throw new Error('playCandidate is required');},
  persistCandidate=async()=>null,
  onEvent=()=>{},
  isCurrent=()=>true,
  maxVerifyCandidates=12,
}={}){
  const failed=new Set((Array.isArray(failedSavedUrls)?failedSavedUrls:[]).map(value=>String(value||'').trim()).filter(Boolean));
  const seenPlaybackRefs=new Set();
  let verifiedBudget=0;
  const emit=(type,detail={})=>{try{onEvent(type,detail);}catch{}};
  emit('started',{providerCount:Array.isArray(refs)?refs.length:0,failedSourceCount:failed.size});

  for(const rawRef of Array.isArray(refs)?refs:[]){
    if(!isCurrent())return{ok:false,cancelled:true,saved:false};
    const ref={provider:cleanToken(rawRef?.provider||CURATED_PROVIDER)||CURATED_PROVIDER,familyIds:unique(rawRef?.familyIds||[]).map(cleanToken).filter(Boolean),urls:unique(rawRef?.urls||[])};
    const discover=discoverProvider(ref.provider);
    if(typeof discover!=='function'){emit('provider.skipped',{provider:ref.provider,familyIds:ref.familyIds});continue;}
    emit('discovery.started',{provider:ref.provider,familyIds:ref.familyIds});
    let payload;
    try{payload=await discover(channel,ref);}
    catch(error){emit('discovery.failed',{provider:ref.provider,familyIds:ref.familyIds,message:error?.message||String(error)});continue;}
    if(!isCurrent())return{ok:false,cancelled:true,saved:false};
    for(const report of Array.isArray(payload?.reports)?payload.reports:[])if(report&&typeof report==='object')emit('feed.checked',{provider:ref.provider,familyIds:ref.familyIds,feed:report.feed||report.provider||'',status:report.status??null,count:report.count??null,elapsedMs:report.elapsedMs??null,error:report.error||''});
    const discovered=selectRefreshCandidates(payload?.candidates||[],ref).filter(candidate=>{
      const playbackRef=candidatePlaybackReference(candidate);
      return playbackRef&&!failed.has(playbackRef)&&!seenPlaybackRefs.has(playbackRef);
    });
    emit('discovery.completed',{provider:ref.provider,familyIds:ref.familyIds,candidateCount:discovered.length,strategy:payload?.planning?.strategy||''});
    if(!discovered.length)continue;

    const remaining=Math.max(0,Number(maxVerifyCandidates)||12)-verifiedBudget;
    if(!remaining)break;
    const batch=discovered.slice(0,remaining);
    verifiedBudget+=batch.length;
    let verified=[];
    try{verified=await verifyCandidates(batch,ref);}
    catch(error){emit('verification.failed',{provider:ref.provider,familyIds:ref.familyIds,message:error?.message||String(error)});if(verifiedBudget>=maxVerifyCandidates)break;continue;}

    for(const candidate of Array.isArray(verified)?verified:[]){
      const playbackRef=candidatePlaybackReference(candidate);
      if(!playbackRef||seenPlaybackRefs.has(playbackRef))continue;
      seenPlaybackRefs.add(playbackRef);
      emit('verification.completed',{provider:ref.provider,familyIds:ref.familyIds,candidateId:candidate.candidateId||'',status:candidate.verificationStatus||'',streamKind:candidate.streamKind||'',browserPlayable:candidate.browserPlayable===true,sourceFamilyId:candidate.sourceFamilyId||''});
      if(!(candidate.verified===true&&String(candidate.verificationStatus||'').toUpperCase()==='VERIFIED'&&String(candidate.streamKind||'').toLowerCase()==='live'&&candidate.browserPlayable===true&&!candidate.drmDetected))continue;
      if(!isCurrent())return{ok:false,cancelled:true,saved:false};
      emit('playback.started',{provider:ref.provider,familyIds:ref.familyIds,candidateId:candidate.candidateId||'',sourceFamilyId:candidate.sourceFamilyId||''});
      let playbackResult;
      try{playbackResult=await playCandidate(candidate,playbackRef,ref);}
      catch(error){emit('playback.failed',{provider:ref.provider,familyIds:ref.familyIds,candidateId:candidate.candidateId||'',message:error?.message||String(error)});continue;}
      if(!playbackResult||playbackResult.fallback){emit('playback.failed',{provider:ref.provider,familyIds:ref.familyIds,candidateId:candidate.candidateId||'',message:'Refreshed candidate did not confirm direct media playback'});continue;}
      const eligibility=selfHealSaveEligibility({candidate,playbackConfirmed:true,existingSavedChannel:true});
      if(!eligibility.enabled){emit('persistence.skipped',{provider:ref.provider,familyIds:ref.familyIds,candidateId:candidate.candidateId||'',message:eligibility.reason});return{ok:true,saved:false,candidate,playbackResult,ref};}
      try{
        await persistCandidate(candidate,playbackRef,ref);
        emit('persistence.saved',{provider:ref.provider,familyIds:ref.familyIds,candidateId:candidate.candidateId||'',url:playbackRef});
        return{ok:true,saved:true,candidate,playbackResult,ref};
      }catch(error){
        emit('persistence.failed',{provider:ref.provider,familyIds:ref.familyIds,candidateId:candidate.candidateId||'',url:playbackRef,message:error?.message||String(error)});
        return{ok:true,saved:false,candidate,playbackResult,ref,persistenceError:error};
      }
    }
    if(verifiedBudget>=Math.max(0,Number(maxVerifyCandidates)||12))break;
  }
  emit('exhausted',{verifiedBudget});
  return{ok:false,saved:false,verifiedBudget};
}

export { CURATED_PROVIDER as SELF_HEAL_CURATED_PROVIDER };
