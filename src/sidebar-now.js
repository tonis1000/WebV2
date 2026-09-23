import { CONFIG } from './config.js?v=20260923-2215';
import { EpgService } from './core/epg.js?v=20260923-2315';

const BUILD_ID = '20260923-2255';
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
      grid-template-columns:minmax(0,auto) minmax(88px,1fr);
      grid-template-rows:auto auto;
      column-gap:10px;
      align-items:center;
      min-width:0;
    }
    .channel-item .channel-meta-inline.no-epg-meta{
      grid-template-columns:minmax(0,1fr)!important;
      column-gap:0!important;
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
      flex-direction:column;
      justify-content:center;
      gap:5px;
      min-width:0;
      margin-top:0;
      color:#e2e8ef;
      font-size:.80rem;
      font-weight:600;
      line-height:1.15;
      overflow:hidden;
    }
    .channel-item .channel-now-inline.no-epg{
      display:none!important;
    }
    .channel-item .channel-now-title{
      display:block;
      width:100%;
      min-width:0;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      text-align:right;
    }
    .channel-item .channel-now-timeline{
      display:block;
      position:relative;
      width:100%;
      min-width:54px;
      height:5px;
      margin:0;
      overflow:hidden;
      border-radius:999px;
      background:#7f1d1d;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);
    }
    .channel-item .channel-now-played{
      display:block;
      height:100%;
      width:0;
      margin:0;
      border-radius:999px 0 0 999px;
      background:#22c55e;
      transition:width .35s linear;
    }
    @media(max-width:520px){
      .channel-item .channel-now-inline{
        max-width:44vw;
      }
      .channel-item .channel-now-timeline{
        height:4px;
        min-width:48px;
      }
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
      const timeline=document.createElement('span');
      timeline.className='channel-now-timeline';
      const played=document.createElement('span');
      played.className='channel-now-played';
      timeline.appendChild(played);
      line.append(title,timeline);
      meta.appendChild(line);
    }

    const title=line.querySelector('.channel-now-title');
    const played=line.querySelector('.channel-now-played');
    const {current}=epg.get(channel);
    if(current?.title){
      const pct=Math.max(0,Math.min(100,Number(current.progress)||0));
      title.textContent=current.title;
      title.title=current.title;
      played.style.width=`${pct}%`;
      line.classList.remove('no-epg');
      meta.classList.remove('no-epg-meta');
      line.title=current.title;
    }else{
      title.textContent='';
      title.title='';
      played.style.width='0%';
      line.classList.add('no-epg');
      meta.classList.add('no-epg-meta');
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
  // Only react when channel rows are replaced/reordered. Do not observe the
  // EPG elements this module inserts inside each row, or it schedules itself.
  new MutationObserver(scheduleRender).observe(list,{childList:true,subtree:false});
}
window.addEventListener('webtv:ready',scheduleRender);
window.addEventListener('webtv:epg-updated',()=>{ready=true;scheduleRender();});
refresh();
setInterval(render,30000);
setInterval(refresh,CONFIG.epgRefreshMs);
console.info(`[WebTV] Sidebar Now Playing loaded · build ${BUILD_ID} · direct-row observer · shared EPG singleton`);
