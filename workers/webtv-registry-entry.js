import registryWorker from './webtv-registry.js';

const START_PATH='/api/project-agent/pair/start';

function startPage(){
  const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebV2 Project Agent Pairing</title></head><body><main><h1>WebV2 Project Agent Pairing</h1><p>Start a one-time project-agent pairing. Opening this page alone does not create anything.</p><form method="post" action="/api/project-agent/pair/start"><button type="submit">Start Pairing</button></form></main></body></html>';
  return new Response(html,{status:200,headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname.replace(/\/+$/,'')===START_PATH&&request.method==='GET')return startPage();
    return registryWorker.fetch(request,env,ctx);
  }
};
