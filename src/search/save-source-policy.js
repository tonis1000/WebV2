import { normalizeChannelName } from '../discovery/candidate-model.js';

export function normalizedSelectedChannelKeys(selectedChannel={}){
  return new Set([selectedChannel?.id,selectedChannel?.originalId,selectedChannel?.name]
    .map(value=>normalizeChannelName(value||''))
    .filter(Boolean));
}

export function candidateMatchesSelectedChannel(candidate={},channelName='',selectedChannel={}){
  const selected=normalizedSelectedChannelKeys(selectedChannel);
  if(!selected.size)return false;
  const candidateKeys=[candidate.normalizedChannelName,candidate.channelName,channelName]
    .map(value=>normalizeChannelName(value||''))
    .filter(Boolean);
  return candidateKeys.some(key=>selected.has(key));
}

export function genericSaveBlocked(candidate={}){
  return Boolean(candidate.xtreamContext)
    || String(candidate.sourceType||'').toLowerCase()==='xtream'
    || String(candidate.discoveryProvider||'').toLowerCase().includes('authorized-xtream');
}

export function bestSourceSaveEligibility({candidate={},playbackConfirmed=false}={}){
  if(genericSaveBlocked(candidate))return{enabled:false,label:'Use Xtream Preview',title:'Authorized Xtream sources keep their existing Preview → Verify → Save boundary'};
  if(String(candidate.verificationStatus||'').toUpperCase()!=='VERIFIED')return{enabled:false,label:'Use Best Source',title:'Best Source must reach VERIFIED_MEDIA first'};
  if(String(candidate.streamKind||'unknown').toLowerCase()!=='live')return{enabled:false,label:'Use Best Source',title:'Best Source must be verifier-confirmed live media'};
  if(Boolean(candidate.drmDetected))return{enabled:false,label:'Use Best Source',title:'DRM-marked candidates are not promoted by the generic Best Source flow'};
  if(candidate.browserPlayable!==true)return{enabled:false,label:'Use Best Source',title:'This candidate is not playable by the current browser Player'};
  if(!playbackConfirmed)return{enabled:false,label:'Use Best Source',title:'Play the Best Source successfully once before adding/updating My Playlist'};
  return{enabled:true,label:'Use Best Source',title:'Add or promote this playback-confirmed live source through Playlist Manager'};
}

export function saveSourceEligibility({
  candidate={},
  channelName='',
  selectedChannel=null,
  playbackConfirmed=false,
  alreadySaved=false,
}={}){
  if(alreadySaved)return{enabled:false,label:'Saved ✓',title:'This source is already saved in this search session'};
  if(genericSaveBlocked(candidate))return{enabled:false,label:'Save via Xtream Preview',title:'Authorized Xtream sources must use Xtream Preview → Verify → Save Channel…'};
  if(String(candidate.verificationStatus||'').toUpperCase()!=='VERIFIED')return{enabled:false,label:'Save source',title:'Wait for this source to reach VERIFIED_MEDIA first'};
  if(String(candidate.streamKind||'unknown').toLowerCase()!=='live')return{enabled:false,label:'Save source',title:'Only verifier-confirmed live media can be saved to a linear channel; on-demand or unknown media stays temporary'};
  if(!playbackConfirmed)return{enabled:false,label:'Save source',title:'Play this source successfully before saving it'};
  if(!candidateMatchesSelectedChannel(candidate,channelName,selectedChannel||{}))return{enabled:false,label:'Save source',title:`Select ${channelName||candidate.channelName||'this channel'} in the sidebar before saving`};
  return{enabled:true,label:'Save source',title:'Save this playback-confirmed source to the selected My Playlist channel'};
}
