const DEFAULT_REGISTRY_URL='https://webtv-registry.atonis.workers.dev';
const KEY='webtv_v2_registry_url';
try{
  if(!localStorage.getItem(KEY)) localStorage.setItem(KEY,DEFAULT_REGISTRY_URL);
}catch{}

// Xtream/source management UIs are loaded here so index.html does not need another entry point.
// Discovery Phase 1 is intentionally isolated: local shell only, no player/D1/network coupling.
import './xtream-ui.js?v=20260925-xtream6';
import './xtream-preview-actions.js?v=20260925-xtream-click1';
import './xtream-enhancements.js?v=20260925-xtream-enh2';
import './source-order-controls.js?v=20260926-order2';
import './route-tooltip.js?v=20260926-routes1';
import './discovery/discovery-ui.js?v=20260926-discovery-phase1';

// Defensive recovery for the D1 sidebar. The source-order feature must never leave
// the app in an empty startup state if the first cloud read races another module.
async function recoverCloudSidebar(){
  const api=window.WebTVPlaylistAPI;
  if(!api?.reloadCloudMyPlaylist)return false;
  if(Number(api.getCount?.()||0)>0)return true;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      await api.reloadCloudMyPlaylist({reason:`startup-recovery-${attempt}`,preserveSelection:false});
      if(Number(api.getCount?.()||0)>0){
        console.info(`[WebTV] D1 sidebar recovered on attempt ${attempt} · ${api.getCount()} channels`);
        return true;
      }
    }catch(error){
      console.warn(`[WebTV] D1 sidebar recovery attempt ${attempt} failed`,error);
    }
    await new Promise(resolve=>setTimeout(resolve,700*attempt));
  }
  console.warn('[WebTV] D1 sidebar still empty after startup recovery');
  return false;
}

window.addEventListener('webtv:ready',()=>setTimeout(recoverCloudSidebar,150),{once:true});
setTimeout(()=>{if(window.WebTVPlaylistAPI?.ready)recoverCloudSidebar();},1800);
