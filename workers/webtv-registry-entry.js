import registryWorker from './webtv-registry.js';
import { handleCustomPlaylistRoute } from './custom-playlist-routes.js';

function pinAuthDisabled(env){
  return ['1','true','yes','on'].includes(String(env?.PIN_AUTH_DISABLED||'').trim().toLowerCase());
}
function adminBypassRequest(request,env){
  if(!pinAuthDisabled(env)||!env?.ADMIN_TOKEN)return request;
  const headers=new Headers(request.headers);
  headers.set('authorization',`Bearer ${env.ADMIN_TOKEN}`);
  return new Request(request,{headers});
}
async function registryFetch(request,env,ctx){
  const disabled=pinAuthDisabled(env);
  const response=await registryWorker.fetch(adminBypassRequest(request,env),env,ctx);
  const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
  if(!disabled||(path!=='/'&&path!=='/api/status')||!response.ok)return response;
  const payload=await response.json();
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify({...payload,pinAuth:false,pinAuthDisabled:true}),{status:response.status,headers});
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'');
    if(path==='/api/playlists'||path.startsWith('/api/playlists/')){
      const customResponse=await handleCustomPlaylistRoute(adminBypassRequest(request,env),env,registryWorker);
      if(customResponse)return customResponse;
    }
    return registryFetch(request,env,ctx);
  }
};
