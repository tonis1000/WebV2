import registryWorker from './webtv-registry.js';
import { handleCustomPlaylistRoute } from './custom-playlist-routes.js';

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'');
    if(path==='/api/playlists'||path.startsWith('/api/playlists/')){
      const customResponse=await handleCustomPlaylistRoute(request,env,registryWorker);
      if(customResponse)return customResponse;
    }
    return registryWorker.fetch(request,env,ctx);
  }
};
