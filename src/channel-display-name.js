import { resolveGreekIdentity } from './core/channel-identity-gr.js';

function text(value=''){ return String(value||'').trim(); }

export function canonicalDefaultChannelName(channel={}){
  const signals=[channel.id,channel.originalId,channel.tvgId,channel.name].map(text).filter(Boolean);
  const identity=signals.map(resolveGreekIdentity).find(item=>item&&!item.legacy);
  return identity?.canonicalName || text(channel.name) || text(channel.originalId) || text(channel.tvgId) || text(channel.id) || 'Unknown';
}

export function savedChannelDisplayName(channel={},existingChannel=null){
  const stored=text(existingChannel?.name);
  return stored || canonicalDefaultChannelName(channel);
}
