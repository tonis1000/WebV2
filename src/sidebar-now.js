import { CONFIG } from './config.js?v=20260920-1021';
import { EpgService } from './core/epg.js?v=20260920-1021';

const BUILD_ID = '20260920-2228';
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
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:5px;
      min-width:0;
      margin-top:0;
      color:#e2e8ef;
      font-size:.82rem;
      font-weight:600;
      line-height:1.2;
      white-space:nowrap;
      overflow:hidden;
    }
    .channel-item .channel-now-title{
      min-width:0;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .channel-item .channel-now-percent{
      flex:0 0 auto;
      color:#63b3ff;
      font-size:.78rem;
      font-weight:800;
      font-variant-numeric:tabular-nums;
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
      const title=document.createElement('span');
      title.className='channel-now-title';
      const percent=document.createElement('span');
      percent.className='channel-now-percent';
      line.append(title,percent);
      meta.appendChild(line);
    }

    const title=line.querySelector('.channel-now-title');
    const percent=line.querySelector('.channel-now-percent');
    const {current}=epg.get(channel);
    if(current?.title){
      const pct=Math.max(0,Math.min(100,Math.round(current.progress||0)));
      title.textContent=current.title;
      title.title=current.title;
      percent.textContent=`${pct}%`;
      line.title=`${current.title} · ${pct}%`;
    }else{
      title.textContent='';
      title.title='';
      percent.textContent='';
      line.title='';
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
window.addEventListener('webtv:ready',scheduleRender);
refresh();
setInterval(render,30000);
setInterval(refresh,CONFIG.epgRefreshMs);
console.info(`[WebTV] Sidebar Now Playing loaded · build ${BUILD_ID}`);
