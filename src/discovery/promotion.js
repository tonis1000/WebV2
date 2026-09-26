import { saveBestSourceToCurrent } from '../source-save-policy.js';
import { listXtreamAccounts } from '../xtream-client.js';

function clean(value=''){return String(value??'').trim();}
function normalize(value=''){
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω]+/gi,'-').replace(/^-+|-+$/g,'');
}
function sameChannel(a={},b={}){
  const left=new Set([a.id,a.originalId,a.tvgId,a.name].map(normalize).filter(Boolean));
  const right=[b.id,b.originalId,b.tvgId,b.name].map(normalize).filter(Boolean);
  return right.some(value=>left.has(value));
}
function headerCount(candidate={}){return Object.keys(candidate.requiredHeaders||{}).length;}

export function promotionBlockReason(candidate={},expectedChannel=null,currentChannel=null){
  if(!candidate||typeof candidate!=='object')return 'Candidate is required';
  if(candidate.verificationStatus!=='VERIFIED'||candidate.verified!==true)return 'Only VERIFIED candidates can be added';
  if(candidate.saveEligible===false)return 'This candidate is not eligible for My Playlist';
  if(['official-page','official-embed'].includes(String(candidate.candidateKind||'')))return 'Official fallback pages cannot be saved as media sources';
  if(!/^https?:\/\//i.test(clean(candidate.sourceUrl)))return 'A valid http/https source URL is required';
  if(headerCount(candidate)>0)return 'Persistent request-header metadata is not supported yet';
  if(expectedChannel&&currentChannel&&!sameChannel(expectedChannel,currentChannel))return 'Selected channel changed. Re-open Discovery for the current channel before saving';
  return '';
}

export async function promoteCandidate(candidate,{expectedChannel=null,getCurrentChannel=()=>window.WebTVPlaylistAPI?.getSelectedChannel?.()||null,saveSource=saveBestSourceToCurrent}={}){
  const current=getCurrentChannel?.()||null;
  const reason=promotionBlockReason(candidate,expectedChannel,current);
  if(reason)throw new Error(reason);
  const result=await saveSource(candidate.sourceUrl,{maxSources:3});
  return {kind:'source',candidateId:String(candidate.candidateId||''),sourceUrl:String(candidate.sourceUrl||''),result};
}

export async function keepXtreamAccount(candidate,{listAccounts=listXtreamAccounts}={}){
  if(String(candidate?.sourceType||'')!=='xtream')throw new Error('Xtream candidate required');
  const accountRef=clean(candidate.xtreamAccountRef||candidate.xtreamContext?.accountRef);
  if(!accountRef)throw new Error('Xtream account reference is missing');
  const accounts=await listAccounts();
  const account=(accounts||[]).find(item=>clean(item?.id)===accountRef);
  if(!account)throw new Error('This Xtream account is no longer stored in the secure bridge');
  return {kind:'xtream-account',state:'already-saved',account:{id:clean(account.id),name:clean(account.name),server:clean(account.server)}};
}

export function canPromoteCandidate(candidate={},expectedChannel=null,currentChannel=null){return !promotionBlockReason(candidate,expectedChannel,currentChannel);}
