import { previewXtreamAccount } from '../xtream-client.js';
import { createCandidate } from './candidate-model.js';
import { matchesAuthorizedXtreamChannel } from './authorized-xtream.js';

export const NEW_XTREAM_PREVIEW_PROVIDER='new-xtream-preview';
export const NEW_XTREAM_MAX_STREAMS=5000;
export const NEW_XTREAM_MAX_CANDIDATES=8;

export async function discoverNewXtreamPreview(selected={},credentials={}, {
  previewAccount=previewXtreamAccount,
}={}){
  const result=await previewAccount(credentials);
  const previewToken=String(result?.previewToken||'').trim();
  const expiresAt=String(result?.expiresAt||'').trim();
  if(!previewToken)throw new Error('Xtream bridge did not return a preview token');
  const rows=(Array.isArray(result?.channels)?result.channels:[]).slice(0,NEW_XTREAM_MAX_STREAMS);
  const candidates=[];
  for(const channel of rows){
    if(!matchesAuthorizedXtreamChannel(selected,channel))continue;
    const streamId=String(channel?.streamId||'').trim();
    const playbackUrl=String(channel?.playbackUrl||'').trim();
    if(!streamId||!/^https?:\/\//i.test(playbackUrl))continue;
    candidates.push(createCandidate({
      channelName:selected.name||selected.originalId||selected.id||'',
      sourceType:'xtream-preview',
      sourceUrl:playbackUrl,
      sourceOrigin:`Xtream preview · ${result?.account?.name||result?.account?.server||'New account'}`,
      discoveryProvider:NEW_XTREAM_PREVIEW_PROVIDER,
      verificationStatus:'UNVERIFIED',
      matchConfidence:'HIGH',
      freshness:'trusted-preview-live-catalog',
      candidateKind:'xtream-preview',
      saveEligible:false,
      xtreamStreamId:streamId,
      xtreamPreviewToken:previewToken,
      xtreamPreviewServer:String(result?.account?.server||''),
      xtreamPreviewExpiresAt:expiresAt,
    }));
    if(candidates.length>=NEW_XTREAM_MAX_CANDIDATES)break;
  }
  return{
    provider:NEW_XTREAM_PREVIEW_PROVIDER,
    account:{
      name:String(result?.account?.name||''),
      server:String(result?.account?.server||''),
    },
    candidates,
    streamsScanned:rows.length,
    expiresAt,
  };
}
