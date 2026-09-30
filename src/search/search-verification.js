import { detectSourceFormat } from '../core/source-format-registry.js';
import { withVerification } from '../discovery/candidate-model.js';
import { verifyWithConcurrency } from '../discovery/verifier-client.js';

function verifierEligible(candidate={}){
  const classification=detectSourceFormat({sourceUrl:candidate.sourceUrl,explicitType:candidate.sourceType});
  return Boolean(classification.capabilities?.verifierProbe);
}

export async function verifySearchCandidates(candidates=[],{
  signal,
  onStart=()=>{},
  onResult=()=>{},
  verifyImpl=verifyWithConcurrency,
  concurrency=2,
  ...options
}={}){
  const eligible=(candidates||[]).filter(verifierEligible);
  if(!eligible.length)return[];
  for(const candidate of eligible)onStart(candidate);
  const updated=[];
  await verifyImpl(eligible,{
    ...options,
    signal,
    concurrency,
    onResult:(result,index,original)=>{
      const candidate=withVerification(original||eligible[index],result||{status:'FAILED',detail:'Verifier returned no result'});
      updated[index]=candidate;
      onResult(candidate,result||null,index);
    },
  });
  return updated.filter(Boolean);
}
