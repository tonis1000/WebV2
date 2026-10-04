const BUILD_ID='20261004-guide-timeline-a';
const $=id=>document.getElementById(id);
const DESKTOP_HOUR_WIDTH=225;
const MOBILE_HOUR_WIDTH=132;
const TIMELINE_STEP_HOURS=3;
function hourWidth(){return window.matchMedia('(max-width:780px)').matches?MOBILE_HOUR_WIDTH:DESKTOP_HOUR_WIDTH;}
let dayOffset=0;
let activeProgram=null;
let nowPresentationTimer=0;

function api(){return window.WebTVEPGAPI||null;}
function playlist(){return window.WebTVPlaylistAPI||null;}
function dayBounds(offset=0){
  const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+offset);
  const end=new Date(d);end.setDate(end.getDate()+1);
  return{start:d,end};
}
function dayLabel(offset=0){
  const{start}=dayBounds(offset);
  if(offset===0)return'Σήμερα';
  if(offset===1)return'Αύριο';
  if(offset===-1)return'Χθες';
  return start.toLocaleDateString('el-GR',{weekday:'short',day:'2-digit',month:'2-digit'});
}
function ensureToggle(){
  let button=$('epg-guide-toggle');
  if(!button){
    const actions=document.querySelector('.topbar-actions');if(!actions)return null;
    button=document.createElement('button');
    button.id='epg-guide-toggle';button.type='button';button.className='button epg-guide-button';button.textContent='EPG Guide';
    button.setAttribute('aria-controls','epg-guide-overlay');button.setAttribute('aria-expanded','false');
    const before=$('source-hunt-toggle')||$('diagnostics-toggle');actions.insertBefore(button,before||null);
  }
  if(button.dataset.epgGuideBound!=='1'){
    button.dataset.epgGuideBound='1';
    button.addEventListener('click',()=>openGuide());
  }
  window.dispatchEvent(new CustomEvent('webtv:admin-controls-changed',{detail:{control:'epg-guide-toggle'}}));
  return button;
}
function ensureUi(){
  if($('epg-guide-overlay'))return;
  const overlay=document.createElement('div');
  overlay.id='epg-guide-overlay';overlay.className='epg-guide-overlay';overlay.hidden=true;
  overlay.innerHTML=`
    <section class="epg-guide-shell panel" role="dialog" aria-modal="true" aria-label="EPG Guide">
      <header class="epg-guide-head">
        <div><p class="eyebrow">TV GUIDE</p><h2>Πρόγραμμα καναλιών</h2><p id="epg-guide-summary" class="muted small">Τα κανάλια του τρέχοντος sidebar</p></div>
        <div class="epg-guide-head-actions">
          <button id="epg-guide-prev" class="button ghost" type="button" aria-label="Προηγούμενες ώρες">←</button>
          <button id="epg-guide-today" class="button ghost" type="button">Σήμερα</button>
          <button id="epg-guide-next" class="button ghost" type="button" aria-label="Επόμενες ώρες">→</button>
          <button id="epg-guide-close" class="button ghost" type="button" aria-label="Close EPG Guide">✕</button>
        </div>
      </header>
      <div class="epg-guide-datebar"><strong id="epg-guide-day">Σήμερα</strong><span id="epg-guide-status" class="muted small">Ready</span></div>
      <div id="epg-guide-scroll" class="epg-guide-scroll">
        <div id="epg-guide-grid" class="epg-guide-grid"></div>
      </div>
    </section>
    <div id="epg-program-dialog" class="epg-program-dialog" hidden>
      <article class="epg-program-card panel" role="dialog" aria-modal="true" aria-label="Program details">
        <button id="epg-program-close" class="epg-program-close" type="button" aria-label="Close program details">✕</button>
        <div class="epg-program-channel"><img id="epg-program-logo" alt="" hidden><div><span id="epg-program-channel-name"></span><strong id="epg-program-title"></strong></div></div>
        <img id="epg-program-image" class="epg-program-image" alt="" hidden>
        <div class="epg-program-meta"><span id="epg-program-time"></span><span id="epg-program-category"></span></div>
        <p id="epg-program-description" class="epg-program-description"></p>
        <div class="epg-program-actions"><button id="epg-program-play" class="button" type="button">▶ Play</button><button id="epg-program-back" class="button ghost" type="button">Back to guide</button></div>
      </article>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)closeGuide();});
  $('epg-guide-close')?.addEventListener('click',closeGuide);
  $('epg-guide-prev')?.addEventListener('click',()=>scrollTimelineBy(-TIMELINE_STEP_HOURS));
  $('epg-guide-next')?.addEventListener('click',()=>scrollTimelineBy(TIMELINE_STEP_HOURS));
  $('epg-guide-today')?.addEventListener('click',()=>{dayOffset=0;renderGuide({focusNow:true});});
  $('epg-program-close')?.addEventListener('click',closeProgram);
  $('epg-program-back')?.addEventListener('click',closeProgram);
  $('epg-program-dialog')?.addEventListener('pointerdown',event=>{if(event.target===$('epg-program-dialog'))closeProgram();});
  $('epg-program-play')?.addEventListener('click',playProgramChannel);
  $('epg-guide-scroll')?.addEventListener('scroll',()=>requestAnimationFrame(keepCurrentProgrammeCopyVisible),{passive:true});
}
function closeProgram(){$('epg-program-dialog').hidden=true;activeProgram=null;}
function closeGuide(){
  closeProgram();const overlay=$('epg-guide-overlay');if(overlay)overlay.hidden=true;
  $('epg-guide-toggle')?.setAttribute('aria-expanded','false');document.documentElement.classList.remove('epg-guide-open');
}
async function openGuide(){
  ensureUi();dayOffset=0;
  const overlay=$('epg-guide-overlay');overlay.hidden=false;$('epg-guide-toggle')?.setAttribute('aria-expanded','true');
  document.documentElement.classList.add('epg-guide-open');
  const channels=playlist()?.getChannels?.()||[];
  $('epg-guide-status').textContent='Loading EPG…';
  try{await api()?.refreshForChannels?.(channels,{force:false});}catch{}
  renderGuide({focusNow:true});
}
function currentChannelWidth(){
  const grid=$('epg-guide-grid');
  const value=grid?parseFloat(getComputedStyle(grid).getPropertyValue('--epg-channel-width')):0;
  return Number.isFinite(value)&&value>0?value:(window.matchMedia('(max-width:780px)').matches?126:190);
}
function keepCurrentProgrammeCopyVisible(){
  const scroll=$('epg-guide-scroll');if(!scroll)return;
  for(const block of document.querySelectorAll('.epg-guide-program.is-now')){
    const copy=block.querySelector('.epg-guide-program-copy');if(!copy)continue;
    const left=Number(block.dataset.left)||0,width=Number(block.dataset.width)||0;
    const inset=Math.max(0,Math.min(Math.max(0,width-120),scroll.scrollLeft-left+12));
    copy.style.transform=inset>0?'translateX('+inset+'px)':'';
  }
}
function focusNowInTimeline({behavior='auto'}={}){
  if(dayOffset!==0)return;
  const scroll=$('epg-guide-scroll');if(!scroll)return;
  const now=new Date(),minutes=now.getHours()*60+now.getMinutes();
  const nowX=(minutes/60)*hourWidth();
  const visibleTimelineWidth=Math.max(1,scroll.clientWidth-currentChannelWidth());
  const maxScroll=Math.max(0,scroll.scrollWidth-scroll.clientWidth);
  const target=Math.max(0,Math.min(maxScroll,nowX-visibleTimelineWidth/2));
  scroll.scrollTo({left:target,behavior});
  requestAnimationFrame(keepCurrentProgrammeCopyVisible);
}
function scrollTimelineBy(hours){
  const scroll=$('epg-guide-scroll');if(!scroll)return;
  const maxScroll=Math.max(0,scroll.scrollWidth-scroll.clientWidth);
  const target=Math.max(0,Math.min(maxScroll,scroll.scrollLeft+hours*hourWidth()));
  scroll.scrollTo({left:target,behavior:'smooth'});
  requestAnimationFrame(keepCurrentProgrammeCopyVisible);
}
function programmePosition(item,start,end){
  const total=end-start;
  const a=Math.max(start,new Date(item.start).getTime()),b=Math.min(end,new Date(item.stop).getTime());
  if(b<=a)return null;
  return{left:((a-start)/total)*24*hourWidth(),width:Math.max(34,((b-a)/total)*24*hourWidth())};
}
function openProgram(channel,item){
  activeProgram={channel,item};$('epg-program-dialog').hidden=false;
  const logo=$('epg-program-logo');if(channel.logo){logo.src=channel.logo;logo.hidden=false;}else{logo.hidden=true;logo.removeAttribute('src');}
  $('epg-program-channel-name').textContent=channel.name||'Channel';
  $('epg-program-title').textContent=item.title||'';
  $('epg-program-time').textContent=`${new Date(item.start).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})} – ${new Date(item.stop).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})}`;
  $('epg-program-category').textContent=item.category||'';
  $('epg-program-description').textContent=item.description||'Δεν υπάρχει περιγραφή.';
  const image=$('epg-program-image');if(item.image){image.src=item.image;image.hidden=false;}else{image.hidden=true;image.removeAttribute('src');}
}
async function playProgramChannel(){
  const id=activeProgram?.channel?.id;if(!id)return;
  const button=$('epg-program-play');button.disabled=true;button.textContent='Connecting…';
  try{
    await window.WebTVPlaybackAPI?.playChannelById?.(id);
    closeGuide();
  }catch(error){
    button.textContent='Play failed';
    setTimeout(()=>{button.disabled=false;button.textContent='▶ Play';},1600);
  }
}
function renderGuide({focusNow=false}={}){
  ensureUi();
  const channels=playlist()?.getChannels?.()||[];
  const root=$('epg-guide-grid'),status=$('epg-guide-status'),scroll=$('epg-guide-scroll');
  const previousScroll=scroll?.scrollLeft||0;
  const{start,end}=dayBounds(dayOffset);const startMs=start.getTime(),endMs=end.getTime();
  $('epg-guide-day').textContent=dayLabel(dayOffset);
  $('epg-guide-summary').textContent=`${channels.length} sidebar channels · click a programme for details`;
  root.replaceChildren();
  const nowMs=Date.now();
  const header=document.createElement('div');header.className='epg-guide-row epg-guide-hours-row';
  const corner=document.createElement('div');corner.className='epg-guide-channel epg-guide-corner';corner.textContent='Channel';
  const hours=document.createElement('div');hours.className='epg-guide-hours';hours.style.width=`${24*hourWidth()}px`;
  for(let hour=0;hour<24;hour+=1){const cell=document.createElement('span');cell.style.left=`${hour*hourWidth()}px`;cell.textContent=`${String(hour).padStart(2,'0')}:00`;hours.appendChild(cell);}
  header.append(corner,hours);root.appendChild(header);
  let programmeCount=0;
  for(const channel of channels){
    const row=document.createElement('div');row.className='epg-guide-row';
    const label=document.createElement('div');label.className='epg-guide-channel';
    if(channel.logo){const img=document.createElement('img');img.src=channel.logo;img.alt='';label.appendChild(img);}
    const name=document.createElement('strong');name.textContent=channel.name;label.appendChild(name);
    const track=document.createElement('div');track.className='epg-guide-track';track.style.width=`${24*hourWidth()}px`;
    const schedule=api()?.getSchedule?.(channel,{from:start,to:end,limit:160})||[];
    if(!schedule.length){const empty=document.createElement('span');empty.className='epg-guide-empty';empty.textContent='No EPG';track.appendChild(empty);}
    for(const item of schedule){
      const pos=programmePosition(item,startMs,endMs);if(!pos)continue;programmeCount+=1;
      const block=document.createElement('button');block.type='button';block.className='epg-guide-program';block.style.left=`${pos.left}px`;block.style.width=`${pos.width}px`;block.dataset.left=String(pos.left);block.dataset.width=String(pos.width);
      const itemStart=new Date(item.start).getTime(),itemStop=new Date(item.stop).getTime();
      if(dayOffset===0&&nowMs>=itemStart&&nowMs<itemStop){block.classList.add('is-now');block.setAttribute('aria-current','true');}
      block.title=`${item.title} · ${new Date(item.start).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})}`;
      const copy=document.createElement('span');copy.className='epg-guide-program-copy';
      const time=document.createElement('small');time.textContent=new Date(item.start).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'});
      const title=document.createElement('strong');title.textContent=item.title;copy.append(time,title);block.append(copy);
      block.addEventListener('click',()=>openProgram(channel,item));track.appendChild(block);
    }
    row.append(label,track);root.appendChild(row);
  }
  if(dayOffset===0){
    const now=new Date();const minutes=now.getHours()*60+now.getMinutes();const nowX=(minutes/60)*hourWidth();
    const line=document.createElement('div');line.id='epg-guide-now-line';line.className='epg-guide-now-line';line.style.left=`calc(var(--epg-channel-width) + ${nowX}px)`;
    const badge=document.createElement('span');badge.textContent='ΤΩΡΑ';line.appendChild(badge);root.appendChild(line);
    requestAnimationFrame(()=>{if(focusNow)focusNowInTimeline();else{if(scroll)scroll.scrollLeft=previousScroll;keepCurrentProgrammeCopyVisible();}});
  }else requestAnimationFrame(()=>{if(scroll)scroll.scrollLeft=focusNow?0:previousScroll;});
  status.textContent=`${programmeCount} programmes · ${channels.length} channels`;
}
function boot(){
  ensureToggle();ensureUi();
  window.addEventListener('webtv:admin-visibility',event=>{if(!event.detail?.unlocked)closeGuide();});
  window.addEventListener('webtv:epg-updated',()=>{if(!$('epg-guide-overlay')?.hidden)renderGuide();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!$('epg-program-dialog')?.hidden)closeProgram();else if(!$('epg-guide-overlay')?.hidden)closeGuide();}});
  if(!nowPresentationTimer)nowPresentationTimer=setInterval(()=>{if(!$('epg-guide-overlay')?.hidden&&dayOffset===0)renderGuide();},60000);
}
if(playlist()?.ready)boot();else window.addEventListener('webtv:ready',boot,{once:true});
console.info(`[WebTV] EPG Guide loaded · ${BUILD_ID}`);
