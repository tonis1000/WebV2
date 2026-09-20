import { CONFIG } from './config.js?v=20260920-1021';
import { EpgService } from './core/epg.js?v=20260920-1021';

const BUILD_ID = '20260920-2222';
const list = document.getElementById('channel-list');
const epg = new EpgService();
let ready = false;
let scheduled = false;

function ensureStyle(){
  if(document.getElementById('sidebar-now-style')) return;
  const style=document.createElement('style');
  style.id='sidebar-now-style';
  style.textContent=`
    .channel-item .channel-meta-inline{
      display:grid;
      grid-template-columns:minmax(0,auto) minmax(0,1fr);
      grid-template-rows:auto auto;
      column-gap:10px;
      align-items:center;
      min-width:0;
    }
    .channel-item .channel-meta-inline>strong{
      grid-column:1;
      grid-row:1;
      min-width:0;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .channel-item .channel-meta-inline>.channel-group-inline{
      grid-column:1;
      grid-row:2;
      min-width:0;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .channel-item .channel-now-inline{
      grid-column:2;
      grid-row:1 / 3;
      align-self:center;
      min-width:0;
      margin-top:0;
      color:#c7d0da;
      font-size:.72rem;
      line-height:1.2;
      text-align:right;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
  `;
  document.head.appendChild(style);
}

function channelFromButton(button){
  const id=button.dataset?.channelId||'';
  const real=window.WebTVPlaylistAPI?.getChannelById?.(id);
  if(real) return real;
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

    meta.classList.add('channel-meta-inline');
    const group=meta.querySelector('span:not(.channel-now-inline)');
    if(group) group.classList.add('channel-group-inline');

    let line=meta.querySelector('.channel-now-inline');
    if(!line){
      line=document.createElement('span');
      line.className='channel-now-inline';
      meta.appendChild(line);
    }

    const {current}=epg.get(channel);
    line.textContent=current?.title||'';
    line.title=current?.title||'';
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
window.addEventListener('webtv:ready',scheduleRender);
refresh();
setInterval(render,30000);
setInterval(refresh,CONFIG.epgRefreshMs);
console.info(`[WebTV] Sidebar Now Playing loaded · build ${BUILD_ID}`);
