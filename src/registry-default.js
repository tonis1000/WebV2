const DEFAULT_REGISTRY_URL='https://webtv-registry.atonis.workers.dev';
const KEY='webtv_v2_registry_url';
try{
  if(!localStorage.getItem(KEY)) localStorage.setItem(KEY,DEFAULT_REGISTRY_URL);
}catch{}

// Xtream source UI is loaded here so index.html does not need another entry point.
// It injects its card into Playlist Manager and reuses WebTVPlaylistAPI at click time.
import './xtream-ui.js?v=20260925-xtream1';
