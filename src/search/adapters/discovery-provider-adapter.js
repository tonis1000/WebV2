import {
  discoverCuratedRemoteFeeds,
  discoverGithubPublicPlaylists,
  discoverRecentWebSearch,
  discoverStrmSpecific,
  CURATED_REMOTE_FEEDS_PROVIDER,
  GITHUB_PUBLIC_PLAYLISTS_PROVIDER,
  RECENT_WEB_SEARCH_PROVIDER,
  STRM_SPECIFIC_DISCOVERY_PROVIDER,
} from '../../discovery/external-discovery-client.js';
import { discoverAuthorizedXtream } from '../../discovery/authorized-xtream.js';

const DEFAULT_DISCOVERERS=Object.freeze({
  [CURATED_REMOTE_FEEDS_PROVIDER]:discoverCuratedRemoteFeeds,
  [GITHUB_PUBLIC_PLAYLISTS_PROVIDER]:discoverGithubPublicPlaylists,
  [RECENT_WEB_SEARCH_PROVIDER]:discoverRecentWebSearch,
  [STRM_SPECIFIC_DISCOVERY_PROVIDER]:discoverStrmSpecific,
  'authorized-xtream':discoverAuthorizedXtream,
  'authorized-xtream-expansion':discoverAuthorizedXtream,
});

const BLOCKED_PROVIDER=/official/i;

function providerFor(source={}){
  return String(source.provider||source.location?.provider||source.id||'').trim();
}

function normalizeResult(result={}){
  return {
    candidates:Array.isArray(result?.candidates)?result.candidates:[],
    leads:Array.isArray(result?.leads)?result.leads:[],
    reports:Array.isArray(result?.reports)?result.reports:[],
  };
}

export function createDiscoveryProviderAdapter({discoverers=DEFAULT_DISCOVERERS}={}){
  return Object.freeze({
    async search({target={},source={},signal}={}){
      if(signal?.aborted)throw signal.reason||new DOMException('Discovery search cancelled','AbortError');
      const provider=providerFor(source);
      if(!provider||BLOCKED_PROVIDER.test(provider))throw new Error(`Unsupported Discovery provider for unified search: ${provider||'(empty)'}`);
      const discover=discoverers?.[provider];
      if(typeof discover!=='function')throw new Error(`Unsupported Discovery provider for unified search: ${provider}`);
      const freshness=String(source.freshness||'30d');
      const allowPaidFallback=source.paidFallback===true;
      const result=await discover(target,{signal,freshness,allowPaidFallback});
      if(signal?.aborted)throw signal.reason||new DOMException('Discovery search cancelled','AbortError');
      return normalizeResult(result);
    },
  });
}

export const discoveryProviderAdapter=createDiscoveryProviderAdapter();
