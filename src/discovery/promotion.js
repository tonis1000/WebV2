import { saveBestSourceToCurrent } from '../source-save-policy.js';
import { listXtreamAccounts, saveXtreamAccountFromPreview, saveXtreamChannelFromPreview } from '../xtream-client.js';

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
function previewExpired(candidate={}){
  const raw=clean(candidate.xtreamPreviewExpiresAt);
  if(!raw)return false;
  const stamp=Date.parse(raw);
  return Number.isFinite(stamp) && stamp<=Date.now();
}

export function promotionBlockReason(candidate={},expectedChannel=null,currentChannel=null){
  if(!candidate||typeof candidate!=='object')return 'Candidate is required';
  if(candidate.verificationStatus!=='VERIFIED'||candidate.verified!==true)return 'Only VERIFIED candidates can be added';
  if(String(candidate.sourceType||'')==='xtream-preview')return 'Use an explicit Xtream preview choice instead of saving the temporary preview URL';
  if(candidate.saveEligible===false)return 'This candidate is not eligible for My Playlist';
  if(['official-page','official-embed'].includes(String(candidate.candidateKind||'')))return 'Official fallback pages cannot be saved as media sources';
  if(!/^https?:\/\//i.test(clean(candidate.sourceUrl)))return 'A valid http/https source URL is required';
  if(headerCount(candidate)>0)return 'Persistent request-header metadata is not supported yet';
  if(expectedChannel&&currentChannel&&!sameChannel(expectedChannel,currentChannel))return 'Selected channel changed. Re-open Discovery for the current channel before saving';
  return '';
}

export function previewChoiceBlockReason(candidate={},expectedChannel=null,currentChannel=null){
  if(!candidate||typeof candidate!=='object')return 'Candidate is required';
  if(String(candidate.sourceType||'')!=='xtream-preview')return 'Xtream preview candidate required';
  if(candidate.verificationStatus!=='VERIFIED'||candidate.verified!==true)return 'Only VERIFIED Xtream previews can be saved';
  if(!clean(candidate.xtreamPreviewToken))return 'Xtream preview token is missing';
  if(!clean(candidate.xtreamStreamId))return 'Xtream stream ID is missing';
  if(previewExpired(candidate))return 'Xtream preview expired. Test the account again';
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

export async function promotePreviewXtreamChannel(candidate,{
  expectedChannel=null,
  getCurrentChannel=()=>window.WebTVPlaylistAPI?.getSelectedChannel?.()||null,
  saveChannel=saveXtreamChannelFromPreview,
  saveSource=saveBestSourceToCurrent,
}={}){
  const current=getCurrentChannel?.()||null;
  const reason=previewChoiceBlockReason(candidate,expectedChannel,current);
  if(reason)throw new Error(reason);
  const source=await saveChannel(candidate.xtreamPreviewToken,candidate.xtreamStreamId,{name:candidate.channelName||''});
  const playbackUrl=clean(source?.playbackUrl);
  if(!/^https?:\/\//i.test(playbackUrl))throw new Error('Xtream bridge did not return a permanent channel playback URL');
  const result=await saveSource(playbackUrl,{maxSources:3});
  return {kind:'xtream-channel',candidateId:String(candidate.candidateId||''),source:{id:clean(source?.id),streamId:clean(source?.streamId),server:clean(source?.server),playbackUrl},result};
}

export async function saveFullXtreamAccountFromCandidate(candidate,{
  expectedChannel=null,
  getCurrentChannel=()=>window.WebTVPlaylistAPI?.getSelectedChannel?.()||null,
  saveAccount=saveXtreamAccountFromPreview,
}={}){
  const current=getCurrentChannel?.()||null;
  const reason=previewChoiceBlockReason(candidate,expectedChannel,current);
  if(reason)throw new Error(reason);
  const account=await saveAccount(candidate.xtreamPreviewToken,{name:''});
  return {kind:'xtream-account',state:'saved',account:{id:clean(account?.id),name:clean(account?.name),server:clean(account?.server)}};
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
export function canChoosePreviewXtream(candidate={},expectedChannel=null,currentChannel=null){return !previewChoiceBlockReason(candidate,expectedChannel,currentChannel);}
