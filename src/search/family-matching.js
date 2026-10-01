import { normalizeChannelText } from '../core/channel-identity-gr.js';

function compact(value=''){return normalizeChannelText(value).replace(/\s+/g,'');}

export function familySignalsMatch(signals=[],family={}){
  if(family?.familyQuery!==true)return false;
  const aliases=[family.name,...(Array.isArray(family.familyAliases)?family.familyAliases:[])]
    .map(value=>String(value||'').trim()).filter(Boolean);
  if(!aliases.length)return false;
  for(const signal of signals||[]){
    const normalized=normalizeChannelText(signal);
    if(!normalized)continue;
    const compactSignal=compact(signal);
    for(const alias of aliases){
      const normalizedAlias=normalizeChannelText(alias);
      if(!normalizedAlias)continue;
      if(normalized===normalizedAlias||normalized.startsWith(`${normalizedAlias} `))return true;
      const compactAlias=compact(alias);
      if(!compactAlias||!compactSignal.startsWith(compactAlias))continue;
      const suffix=compactSignal.slice(compactAlias.length);
      if(!suffix||/^\d/.test(suffix))return true;
    }
  }
  return false;
}
