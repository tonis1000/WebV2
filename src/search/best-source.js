function finiteScore(value){
  const number=Number(value);
  return Number.isFinite(number)?number:0;
}

function blockedGenericCandidate(candidate={}){
  return Boolean(candidate.xtreamContext)
    || String(candidate.sourceType||'').toLowerCase()==='xtream'
    || String(candidate.discoveryProvider||'').toLowerCase().includes('authorized-xtream');
}

function eligible(candidate={}){
  return candidate.verified===true
    && String(candidate.verificationStatus||'').toUpperCase()==='VERIFIED'
    && String(candidate.streamKind||'unknown').toLowerCase()==='live'
    && candidate.drmDetected!==true
    && candidate.browserPlayable===true
    && /^https?:\/\//i.test(String(candidate.sourceUrl||''))
    && !blockedGenericCandidate(candidate);
}

function confidenceWeight(value=''){
  const normalized=String(value||'').toUpperCase();
  if(normalized==='HIGH')return 3;
  if(normalized==='MEDIUM')return 2;
  if(normalized==='LOW')return 1;
  return 0;
}

export function rankBestSources(candidates=[],{
  playbackConfirmedIds=new Set(),
  scoreHealth=()=>0,
  pageProtocol='https:',
}={}){
  const confirmedSet=playbackConfirmedIds instanceof Set?playbackConfirmedIds:new Set(playbackConfirmedIds||[]);
  return (candidates||[])
    .filter(eligible)
    .map((candidate,index)=>{
      const playbackConfirmed=confirmedSet.has(candidate.candidateId);
      const healthScore=finiteScore(scoreHealth(candidate));
      const secure=/^https:\/\//i.test(String(candidate.sourceUrl||''));
      const browserCompatible=playbackConfirmed||pageProtocol!=='https:'||secure;
      const startupMs=Number.isFinite(Number(candidate.startupMs))?Number(candidate.startupMs):Number.MAX_SAFE_INTEGER;
      return {candidate,playbackConfirmed,healthScore,browserCompatible,startupMs,confidence:confidenceWeight(candidate.matchConfidence),index};
    })
    .sort((a,b)=>
      Number(b.playbackConfirmed)-Number(a.playbackConfirmed)
      || Number(b.browserCompatible)-Number(a.browserCompatible)
      || b.healthScore-a.healthScore
      || b.confidence-a.confidence
      || a.startupMs-b.startupMs
      || a.index-b.index
    );
}

export function selectBestSource(candidates=[],options={}){
  return rankBestSources(candidates,options)[0]?.candidate||null;
}

export function isBestSourceEligible(candidate={}){
  return eligible(candidate);
}
