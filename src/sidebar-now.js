import { CONFIG } from './config.js?v=20260920-1021';
import { EpgService } from './core/epg.js?v=20260920-1021';

const BUILD_ID = '20260920-2205';
const list = document.getElementById('channel-list');
const epg = new EpgService();
let ready = false;
let scheduled = false;

function ensureStyle(){
  if(document.getElementById('sidebar-now-style')) return;
  const style=document.createElement('style');
  style.id='sidebar-now-style';
  style.textContent=`
    .channel-item .channel-now{
      display:block;
      margin-top:3px;
      color:#c7d0da;
      font-size:.76rem;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
  `;
  document.head.appendChild(style);
}

function channelFromButton(button){
  const meta=button.children?.[1];
  const name=meta?.querySelector('strong')?.textContent?.trim()||'';
  return name?{id:name,originalId:name,name}:null;
}

function render(){
  scheduled=false;
  if(!ready||!list) return;
  for(const button of list.querySelectorAll('.channel-item')){
    const meta=button.children?.[1];
    const channel=channelFromButton(button);
    if(!meta||!channel) continue;
    const {current}=epg.get(channel);
    let line=meta.querySelector('.channel-now');
    const fallback=meta.querySelector('span:not(.channel-now)');
    if(current?.title){
      if(!line){line=document.createElement('span');line.className='channel-now';meta.appendChild(line);}
      line.textContent=current.title;
      line.title=current.title;
      if(fallback) fallback.hidden=true;
    }else{
      if(line) line.remove();
      if(fallback) fallback.hidden=false;
    }
  }
}

function scheduleRender(){
  if(scheduled) return;
  scheduled=true;
  requestAnimationFrame(render);
}

async function refresh(){
  try{
    await epg.refresh();
    ready=true;
    render();
  }catch(error){
    console.warn('[WebTV] sidebar now-playing unavailable',error);
  }
}

ensureStyle();
if(list){
  new MutationObserver(scheduleRender).observe(list,{childList:true,subtree:true});
}
refresh();
setInterval(render,30000);
setInterval(refresh,CONFIG.epgRefreshMs);
console.info(`[WebTV] Sidebar Now Playing loaded · build ${BUILD_ID}`);
