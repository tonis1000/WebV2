import legacyWorker from './webtv-xtream.js';
import { handleXtreamPreviewRoute } from './xtream-preview-routes.js';

export default {
  async fetch(request, env) {
    const routed=await handleXtreamPreviewRoute(request,env);
    if(routed)return routed;
    return legacyWorker.fetch(request,env);
  },
};
