import { discoveryProviderAdapter } from './adapters/discovery-provider-adapter.js';
import { huntExplorationAdapter } from './adapters/hunt-exploration-adapter.js';

const FREE_RUNTIME_LANES=Object.freeze([
  Object.freeze({id:'curated-remote-feeds',label:'Curated sources',type:'discovery-provider',provider:'curated-remote-feeds',freshness:'30d',enabled:true}),
  Object.freeze({id:'github-public-playlists',label:'GitHub playlists',type:'discovery-provider',provider:'github-public-playlists',freshness:'30d',enabled:true}),
  Object.freeze({id:'strm-specific-discovery',label:'STRM sources',type:'discovery-provider',provider:'strm-specific-discovery',freshness:'30d',enabled:true}),
  Object.freeze({id:'authorized-xtream',label:'Authorized Xtream',type:'discovery-provider',provider:'authorized-xtream',freshness:'live',enabled:true}),
  Object.freeze({id:'hunt-exploration',label:'Forums / Reddit / leads',type:'hunt-exploration',days:30,enabled:true,paidFallback:false}),
]);

const PAID_FALLBACK_LANES=Object.freeze([
  Object.freeze({id:'recent-web-search',label:'Recent web (Brave fallback)',type:'discovery-provider',provider:'recent-web-search',freshness:'30d',enabled:true,paidFallback:true}),
  Object.freeze({id:'hunt-paid-fallback',label:'Deep Hunt (Brave fallback)',type:'hunt-exploration',days:30,enabled:true,paidFallback:true}),
]);

const RUNTIME_ADAPTERS=Object.freeze({
  'discovery-provider':discoveryProviderAdapter,
  'hunt-exploration':huntExplorationAdapter,
});

export function listUnifiedSearchLanes({enabledOnly=true,paidOnly=false,includePaidFallback=false}={}){
  const base=paidOnly?PAID_FALLBACK_LANES:(includePaidFallback?[...FREE_RUNTIME_LANES,...PAID_FALLBACK_LANES]:FREE_RUNTIME_LANES);
  const lanes=enabledOnly?base.filter(item=>item.enabled):base;
  return lanes.map(item=>Object.freeze({...item}));
}

export function getUnifiedSearchRuntimeAdapter(type=''){
  const key=String(type||'').trim().toLowerCase();
  const adapter=RUNTIME_ADAPTERS[key];
  if(!adapter)throw new Error(`Unified search runtime adapter not registered: ${key||'(empty)'}`);
  return adapter;
}
