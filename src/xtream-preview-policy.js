function clean(value=''){return String(value??'').trim();}
function normalize(value=''){
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω]+/gi,'-').replace(/^-+|-+$/g,'');
}
function sameChannel(a={},b={}){
  const left=new Set([a.id,a.originalId,a.tvgId,a.name].map(normalize).filter(Boolean));
  const right=[b.id,b.originalId,b.tvgId,b.name].map(normalize).filter(Boolean);
  return right.some(value=>left.has(value));
}
function expiredAt(candidate={},now=Date.now()){
  const raw=clean(candidate.xtreamPreviewExpiresAt);
  if(!raw)return false;
  const stamp=Date.parse(raw);
  return Number.isFinite(stamp)&&stamp<=Number(now);
}

export function previewChoiceBlockReason(candidate={},options={}){
  const {expectedChannel=null,currentChannel=null,now=Date.now()}=options||{};
  if(!candidate||typeof candidate!=='object')return 'Candidate is required';
  if(String(candidate.sourceType||'')!=='xtream-preview')return 'Xtream preview candidate required';
  if(candidate.verificationStatus!=='VERIFIED'||candidate.verified!==true)return 'Only VERIFIED Xtream previews can be saved';
  if(!clean(candidate.xtreamPreviewToken))return 'Xtream preview token is missing';
  if(!clean(candidate.xtreamStreamId))return 'Xtream stream ID is missing';
  if(expiredAt(candidate,now))return 'Xtream preview expired. Test the account again';
  if(expectedChannel&&currentChannel&&!sameChannel(expectedChannel,currentChannel))return 'Selected channel changed. Re-open Discovery for the current channel before saving';
  return '';
}

export function assertPreviewChoice(candidate,options={}){
  const reason=previewChoiceBlockReason(candidate,options);
  if(reason)throw new Error(reason);
  return candidate;
}

export async function materializePreviewChannel(candidate,{
  expectedChannel=null,
  currentChannel=null,
  now=Date.now(),
  saveChannel,
  writeDestination,
  deleteChannelSource=async()=>{},
}={}){
  assertPreviewChoice(candidate,{expectedChannel,currentChannel,now});
  if(typeof saveChannel!=='function')throw new Error('Xtream channel save function is required');
  const source=await saveChannel(candidate.xtreamPreviewToken,candidate.xtreamStreamId,{name:clean(candidate.channelName)});
  const id=clean(source?.id);
  const playbackUrl=clean(source?.playbackUrl);
  if(!id)throw new Error('Xtream bridge did not return a permanent channel source ID');
  if(!/^https?:\/\//i.test(playbackUrl)){
    try{await deleteChannelSource(id);}catch{}
    throw new Error('Xtream bridge did not return a permanent channel playback URL');
  }
  if(typeof writeDestination!=='function')return{source,result:null};
  try{
    const result=await writeDestination(source);
    return{source,result};
  }catch(error){
    try{await deleteChannelSource(id);}catch{}
    throw error;
  }
}

export async function materializePreviewAccount(candidate,{
  expectedChannel=null,
  currentChannel=null,
  now=Date.now(),
  saveAccount,
  writeLibraryEntry=null,
  deleteAccount=async()=>{},
  name='',
}={}){
  assertPreviewChoice(candidate,{expectedChannel,currentChannel,now});
  if(typeof saveAccount!=='function')throw new Error('Xtream account save function is required');
  const account=await saveAccount(candidate.xtreamPreviewToken,{name});
  const id=clean(account?.id);
  if(!id)throw new Error('Xtream bridge did not return a saved account ID');
  if(typeof writeLibraryEntry!=='function')return{account,result:null};
  try{
    const result=await writeLibraryEntry(account);
    return{account,result};
  }catch(error){
    try{await deleteAccount(id);}catch{}
    throw error;
  }
}

export { sameChannel as samePreviewChannel };
