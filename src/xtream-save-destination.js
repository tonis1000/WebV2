import { promoteImportedChannel } from './core/import-promotion-policy.js';
import { collectKnownSources } from './known-source-collector.js';
import { materializePreviewChannel } from './xtream-preview-policy.js';
import { saveXtreamChannelFromPreview, deleteXtreamChannelSource } from './xtream-client.js';
import {
  createCustomPlaylist,
  deleteCustomPlaylist,
  upsertCustomPlaylistChannel,
} from './custom-playlist-client.js';

function clean(value=''){return String(value??'').trim();}
function destinationKind(destination={}){return clean(destination.kind);}
function defaultMyWriter(channel,sources){
  const api=window.WebTVMyPlaylistAPI;
  if(!api?.upsertChannel)throw new Error('My Playlist channel write API unavailable');
  return api.upsertChannel(channel,sources,{replaceSources:false,reason:'xtream-preview-save'});
}
async function defaultKnownContext(){
  const myPlaylist=await window.WebTVMyPlaylistAPI?.getMyPlaylist?.()||[];
  return {myPlaylist,customPlaylists:[],loadedCatalog:[]};
}

export async function saveVerifiedXtreamChannel({
  candidate,
  channel,
  destination,
  sourceScope='selected',
  deps={},
}={}){
  if(!candidate)throw new Error('Verified Xtream preview candidate is required');
  if(!channel)throw new Error('Channel is required');
  const kind=destinationKind(destination);
  if(!['my','custom','new-custom'].includes(kind))throw new Error('Choose a valid save destination');
  if(!['selected','all-known'].includes(sourceScope))throw new Error('Choose a valid source scope');

  const canonical=promoteImportedChannel({...channel,directUrls:[]});
  const saveChannel=deps.saveChannel||saveXtreamChannelFromPreview;
  const deleteChannelSource=deps.deleteChannelSource||deleteXtreamChannelSource;
  const writeMyPlaylist=deps.writeMyPlaylist||defaultMyWriter;
  const createCustom=deps.createCustomPlaylist||createCustomPlaylist;
  const deleteCustom=deps.deleteCustomPlaylist||deleteCustomPlaylist;
  const writeCustom=deps.writeCustomChannel||((playlistId,ch,sources)=>upsertCustomPlaylistChannel(playlistId,ch,sources,{replaceSources:false}));
  const getKnownContext=deps.getKnownContext||defaultKnownContext;

  let preparedDestination=destination;
  let createdParent=null;
  if(kind==='new-custom'){
    const name=clean(destination.name)||'Custom Playlist';
    createdParent=await createCustom({name});
    if(!createdParent?.id)throw new Error('Custom playlist creation did not return an ID');
    preparedDestination={kind:'custom',playlistId:createdParent.id};
  }

  try{
    const identity={id:canonical.id,originalId:canonical.originalId,tvgId:canonical.tvgId,name:canonical.name};
    const materialized=await materializePreviewChannel(candidate,{
      expectedChannel:identity,
      currentChannel:identity,
      saveChannel,
      deleteChannelSource,
      writeDestination:async source=>{
        const selectedSource={
          url:source.playbackUrl,
          origin:'xtream',
          providerAccountId:clean(source.accountId||source.providerAccountId),
          providerEpgId:clean(channel.providerEpgId||channel.tvgId),
          providerCategory:clean(channel.providerCategory||channel.group||channel.groupName),
        };
        let sources=[selectedSource];
        if(sourceScope==='all-known'){
          const context=await getKnownContext(canonical);
          sources=collectKnownSources(canonical,{...context,selectedSource});
        }
        if(preparedDestination.kind==='my'){
          return writeMyPlaylist(canonical,sources);
        }
        const playlistId=clean(preparedDestination.playlistId);
        if(!playlistId)throw new Error('Custom playlist ID is required');
        return writeCustom(playlistId,canonical,sources);
      },
    });
    return {
      kind:'xtream-channel-save',
      destination:preparedDestination,
      sourceScope,
      channel:canonical,
      source:materialized.source,
      result:materialized.result,
      createdPlaylist:createdParent,
    };
  }catch(error){
    if(createdParent?.id){try{await deleteCustom(createdParent.id);}catch{}}
    throw error;
  }
}
