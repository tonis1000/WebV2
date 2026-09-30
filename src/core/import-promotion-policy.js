import { resolveGreekIdentity } from './channel-identity-gr.js';
import { getChannelProfileById } from './channel-profile-gr.js';
import { normalizeId } from './utils.js';

function clean(value=''){return String(value??'').trim();}
function urls(values=[]){return [...new Set((Array.isArray(values)?values:[]).map(clean).filter(Boolean))];}

export function promoteImportedChannel(channel={}){
  const queries=[channel.id,channel.originalId,channel.tvgId,channel.name].map(clean).filter(Boolean);
  const identities=queries.map(resolveGreekIdentity).filter(Boolean);
  const unique=new Map(identities.map(identity=>[identity.id,identity]));
  const identity=unique.size===1?[...unique.values()][0]:null;
  const profile=identity&&!identity.legacy?getChannelProfileById(identity.id):null;
  const directUrls=urls(channel.directUrls);

  if(identity&&profile){
    const group=clean(profile.category?.primary)||'Other';
    return {
      ...channel,
      id:identity.id,
      originalId:identity.id,
      tvgId:identity.id,
      name:identity.canonicalName,
      logo:profile.logo?.status==='available'?clean(profile.logo.preferredUrl):'',
      group,
      groupName:group,
      directUrls,
      metadataTrust:'canonical-profile',
    };
  }

  const id=normalizeId(channel.id||channel.originalId||channel.tvgId||channel.name);
  return {
    ...channel,
    id,
    originalId:clean(channel.originalId||channel.tvgId||channel.id||channel.name),
    tvgId:clean(channel.tvgId||channel.originalId||channel.id||channel.name),
    name:clean(channel.name||channel.originalId||channel.tvgId||channel.id)||'Unknown',
    logo:'',
    group:'Other',
    groupName:'Other',
    directUrls,
    metadataTrust:'imported-unprofiled',
  };
}
