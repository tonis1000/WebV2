import { listXtreamAccounts, loadXtreamChannels } from '../xtream-client.js';
import { createCandidate, normalizeChannelName } from './candidate-model.js';

export const AUTHORIZED_XTREAM_DISCOVERY_PROVIDER='authorized-xtream-expansion';
export const AUTHORIZED_XTREAM_MAX_ACCOUNTS=3;
export const AUTHORIZED_XTREAM_MAX_STREAMS_PER_ACCOUNT=5000;
export const AUTHORIZED_XTREAM_MAX_CANDIDATES=8;

function identityKeys(channel={}){
  const values=[channel.id,channel.originalId,channel.tvgId,channel.name]
    .map(value=>normalizeChannelName(value).replace(/\s+(?:hd|tv|greece|greek|gr)$/i,'').trim())
    .filter(Boolean);
  return [...new Set(values)];
}

export function matchesAuthorizedXtreamChannel(selected={},candidate={}){
  const wanted=new Set(identityKeys(selected));
  if(!wanted.size)return false;
  return identityKeys(candidate).some(key=>wanted.has(key));
}

export async function discoverAuthorizedXtream(selected={}, {
  signal,
  listAccounts=listXtreamAccounts,
  loadChannels=loadXtreamChannels,
}={}){
  if(signal?.aborted)throw signal.reason||new DOMException('Authorized Xtream discovery cancelled','AbortError');
  const accounts=(await listAccounts()).slice(0,AUTHORIZED_XTREAM_MAX_ACCOUNTS);
  const candidates=[];const reports=[];
  for(const account of accounts){
    if(signal?.aborted)throw signal.reason||new DOMException('Authorized Xtream discovery cancelled','AbortError');
    try{
      const loaded=await loadChannels(account.id);
      const rows=(Array.isArray(loaded?.channels)?loaded.channels:[]).slice(0,AUTHORIZED_XTREAM_MAX_STREAMS_PER_ACCOUNT);
      let matches=0;
      for(const channel of rows){
        if(!matchesAuthorizedXtreamChannel(selected,channel))continue;
        const streamId=String(channel.streamId||'').trim();
        const playbackUrl=String(channel.playbackUrl||'').trim();
        if(!streamId||!/^https?:\/\//i.test(playbackUrl))continue;
        matches+=1;
        candidates.push(createCandidate({
          channelName:selected.name||selected.originalId||selected.id||'',
          sourceType:'xtream',
          sourceUrl:playbackUrl,
          sourceOrigin:`Xtream · ${account.name||account.server||account.id||'Authorized account'}`,
          discoveryProvider:AUTHORIZED_XTREAM_DISCOVERY_PROVIDER,
          verificationStatus:'UNVERIFIED',
          matchConfidence:'HIGH',
          freshness:'authorized-account-live-catalog',
          xtreamContext:{
            server:String(account.server||loaded?.account?.server||''),
            username:'',password:'',streamId,accountRef:String(account.id||loaded?.account?.id||''),
          },
        }));
        if(candidates.length>=AUTHORIZED_XTREAM_MAX_CANDIDATES)break;
      }
      reports.push({accountRef:String(account.id||''),accountName:String(account.name||''),status:'OK',streamsScanned:rows.length,matches});
    }catch(error){
      reports.push({accountRef:String(account.id||''),accountName:String(account.name||''),status:'ERROR',streamsScanned:0,matches:0,error:error?.message||String(error)});
    }
    if(candidates.length>=AUTHORIZED_XTREAM_MAX_CANDIDATES)break;
  }
  return{provider:AUTHORIZED_XTREAM_DISCOVERY_PROVIDER,candidates,reports,limits:{maxAccounts:AUTHORIZED_XTREAM_MAX_ACCOUNTS,maxStreamsPerAccount:AUTHORIZED_XTREAM_MAX_STREAMS_PER_ACCOUNT,maxCandidates:AUTHORIZED_XTREAM_MAX_CANDIDATES}};
}
