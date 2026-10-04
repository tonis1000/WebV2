const FEED_URL='https://webtv-sport.atonis.workers.dev/api/schedule';
const DISPLAY_TZ='Europe/Berlin';
const PRE_START_MINUTES=10;
const POST_END_MINUTES=15;
const DEFAULT_FOOTHUB_DURATION_MINUTES=125;
const DEFAULT_SPORTFM_DURATION_MINUTES=135;
const $=id=>document.getElementById(id);

const els={
  list:$('sport-match-list'),
  status:$('sport-status'),
  frame:$('sport-frame'),
  empty:$('sport-empty'),
  title:$('sport-now-title'),
  activeLink:$('sport-now-link'),
  domain:$('sport-domain'),
  clock:$('sport-clock'),
  refresh:$('sport-refresh'),
  archiveToggle:$('sport-archive-toggle'),
};

let scheduleData=null;
let activeUrl='';
let scheduleLoading=false;
let repeatBoundaryTimer=null;

function setStatus(message,tone='loading'){
  els.status.textContent=message;
  els.status.dataset.tone=tone;
}

function safeEmbedUrl(value=''){
  try{
    const url=new URL(String(value||''));
    if(url.protocol!=='https:')return'';
    return url.href;
  }catch{return'';}
}

function berlinTime(event={}){
  if(event.startUtc){
    const date=new Date(event.startUtc);
    if(!Number.isNaN(date.getTime())){
      return new Intl.DateTimeFormat('de-DE',{
        timeZone:DISPLAY_TZ,hour:'2-digit',minute:'2-digit',hour12:false
      }).format(date);
    }
  }
  return event.time||event.date||'--:--';
}

function eventDurationMinutes(event={}){
  const explicit=Number(event.durationMinutes);
  if(Number.isFinite(explicit)&&explicit>0)return explicit;
  return event.provider==='sportfmtv'
    ? DEFAULT_SPORTFM_DURATION_MINUTES
    : DEFAULT_FOOTHUB_DURATION_MINUTES;
}

function isInGreenWindow(event={},nowMs=Date.now()){
  if(event.broadcastKind==='repeat')return isAiringRepeat(event,nowMs);
  if(event.archive)return false;
  const start=Date.parse(event.startUtc||'');
  if(!Number.isFinite(start))return false;
  const pre=PRE_START_MINUTES*60000;
  const post=POST_END_MINUTES*60000;
  const officialEnd=Date.parse(event.endUtc||'');
  const end=Number.isFinite(officialEnd)?officialEnd:start+eventDurationMinutes(event)*60000;
  return nowMs>=start-pre&&nowMs<=end+post;
}

function sortEventsByStart(events=[]){
  return [...events].sort((a,b)=>{
    const ams=Date.parse(a.startUtc||'');
    const bms=Date.parse(b.startUtc||'');
    if(Number.isFinite(ams)&&Number.isFinite(bms))return ams-bms;
    if(Number.isFinite(ams))return -1;
    if(Number.isFinite(bms))return 1;
    return String(a.time||a.date||'').localeCompare(String(b.time||b.date||''));
  });
}

function clearActiveLink(){
  document.querySelectorAll('.sport-link.active').forEach(node=>node.classList.remove('active'));
}

function playLink(event,link,button){
  if(event.broadcastKind==='repeat'&&!isAiringRepeat(event)){renderSchedule(scheduleData);return;}
  const safeUrl=safeEmbedUrl(link?.url);
  if(!safeUrl){
    setStatus('Μη έγκυρο HTTPS link.','warn');
    return;
  }
  clearActiveLink();
  button.classList.add('active');
  activeUrl=safeUrl;
  els.title.textContent=event.title||'SPORT';
  els.activeLink.textContent=link.label||'Link';
  els.empty.hidden=true;
  els.frame.hidden=false;
  els.frame.src=safeUrl;
}

function makeMatchCard(event,index){
  const card=document.createElement('article');
  card.className='sport-match-card';
  card.dataset.startUtc=event.startUtc||'';
  card.dataset.durationMinutes=String(eventDurationMinutes(event));
  card.dataset.archive=event.archive?'1':'0';
  card.dataset.live=isInGreenWindow(event)?'1':'0';

  const line=document.createElement('div');
  line.className='sport-match-line';

  const time=document.createElement('time');
  time.className='sport-match-time';
  const futureDate=event.startUtc&&new Intl.DateTimeFormat('de-DE',{timeZone:DISPLAY_TZ,day:'2-digit',month:'2-digit'}).format(new Date(event.startUtc));
  const todayDate=new Intl.DateTimeFormat('de-DE',{timeZone:DISPLAY_TZ,day:'2-digit',month:'2-digit'}).format(new Date());
  time.textContent=(futureDate&&futureDate!==todayDate?futureDate+' ':'')+berlinTime(event);
  const sourceLabel=event.provider==='sportfmtv'?'SportFM TV':'Foothub';
  time.title=event.archive
    ? sourceLabel+' · '+(event.date||'παλιός αγώνας')
    : event.time&&event.time!==time.textContent
      ? sourceLabel+': '+event.time+' · Germany: '+time.textContent
      : 'Germany time: '+time.textContent;

  const title=document.createElement('div');
  title.className='sport-match-title';
  title.textContent=event.title||('Αγώνας '+(index+1));
  line.append(time,title);

  const live=document.createElement('span');
  live.className='sport-live-badge';
  live.textContent=event.broadcastKind==='repeat'?'ΤΩΡΑ · Επανάληψη':'LIVE';
  live.hidden=!isInGreenWindow(event);
  line.appendChild(live);

  const links=document.createElement('div');
  links.className='sport-link-row';

  (event.links||[]).forEach((link,linkIndex)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='sport-link';
    button.setAttribute('data-link-index',String(linkIndex));
    button.textContent=link.label||('Link '+(linkIndex+1));
    const safeUrl=safeEmbedUrl(link.url);
    if(safeUrl&&safeUrl===activeUrl)button.classList.add('active');
    button.addEventListener('click',()=>playLink(event,link,button));
    links.appendChild(button);
  });

  card.append(line,links);
  return card;
}

function isAiringRepeat(event={},nowMs=Date.now()){
  const start=Date.parse(event.startUtc||'');
  const end=Date.parse(event.endUtc||'');
  return event.broadcastKind==='repeat'&&Number.isFinite(start)&&Number.isFinite(end)&&start<=nowMs&&nowMs<end;
}

function visibleEvents(data,nowMs=Date.now()){
  const current=sortEventsByStart(Array.isArray(data?.events)?data.events:[]);
  if(!els.archiveToggle?.checked)return current;
  const repeats=(Array.isArray(data?.repeatEvents)?data.repeatEvents:[])
    .filter(event=>event.provider==='sportfmtv'&&isAiringRepeat(event,nowMs));
  return sortEventsByStart([...current,...repeats]);
}

function renderSchedule(data){
  scheduleData=data;
  clearTimeout(repeatBoundaryTimer);
  if(els.archiveToggle?.checked){
    const now=Date.now();
    const boundaries=(data?.repeatEvents||[]).flatMap(e=>[Date.parse(e.startUtc),Date.parse(e.endUtc)]).filter(t=>t>now);
    if(boundaries.length)repeatBoundaryTimer=setTimeout(()=>renderSchedule(scheduleData),Math.min(Math.min(...boundaries)-now+10,2147483647));
  }
  const scrollTop=els.list.scrollTop;
  els.list.replaceChildren();

  const current=Array.isArray(data?.events)?data.events:[];
  const repeats=(Array.isArray(data?.repeatEvents)?data.repeatEvents:[]).filter(event=>isAiringRepeat(event));
  const events=visibleEvents(data);
  const foothubCount=current.filter(event=>event.provider!=='sportfmtv').length;
  const sportfmtvCount=current.filter(event=>event.provider==='sportfmtv').length;

  const foothubOrigin=data?.providers?.foothub?.origin||data?.origin||'';
  els.domain.textContent=foothubOrigin
    ? 'Foothub: '+foothubOrigin.replace(/^https?:\/\//,'')+' · SPORTFM TV'
    : 'SPORTFM TV';

  if(!events.length){
    setStatus('Δεν βρέθηκαν αγώνες από τις διαθέσιμες δημόσιες πηγές.','warn');
    return;
  }

  const archiveSuffix=els.archiveToggle?.checked?' · επαναλήψεις τώρα '+repeats.length:'';
  setStatus(
    current.length+' αγώνες · Foothub '+foothubCount+' · SPORTFM TV '+sportfmtvCount+archiveSuffix+' · ώρα Γερμανίας',
    'ok'
  );

  for(const [index,event] of events.entries()){
    els.list.appendChild(makeMatchCard(event,index));
  }
  els.list.scrollTop=scrollTop;
}

function refreshLiveStates(){
  if(scheduleData&&els.archiveToggle?.checked)return;
  const now=Date.now();
  for(const card of els.list.querySelectorAll('.sport-match-card')){
    const start=Date.parse(card.dataset.startUtc||'');
    const duration=Number(card.dataset.durationMinutes||0);
    const archive=card.dataset.archive==='1';
    const live=!archive&&Number.isFinite(start)&&duration>0
      &&now>=start-PRE_START_MINUTES*60000
      &&now<=start+duration*60000+POST_END_MINUTES*60000;
    card.dataset.live=live?'1':'0';
    const badge=card.querySelector('.sport-live-badge');
    if(badge)badge.hidden=!live;
  }
}

async function loadSchedule(){
  if(scheduleLoading)return;
  scheduleLoading=true;
  els.refresh.disabled=true;
  setStatus('Φόρτωση προγράμματος…','loading');
  try{
    const response=await fetch(FEED_URL+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(60000)});
    const data=await response.json();
    if(!response.ok||data?.ok!==true)throw new Error(data?.error||('HTTP '+response.status));
    renderSchedule(data);
  }catch(error){
    console.error('[SPORT] schedule load failed',error);
    setStatus('Αποτυχία φόρτωσης: '+(error?.message||error),'error');
  }finally{
    els.refresh.disabled=false;
    scheduleLoading=false;
  }
}

function updateClock(){
  els.clock.textContent=new Intl.DateTimeFormat('de-DE',{
    timeZone:DISPLAY_TZ,weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).format(new Date());
}

els.refresh?.addEventListener('click',loadSchedule);
els.archiveToggle?.addEventListener('change',()=>{if(scheduleData)renderSchedule(scheduleData);});
els.frame?.addEventListener('error',()=>{
  setStatus('Το επιλεγμένο iframe δεν φόρτωσε. Δοκίμασε άλλο Link.','warn');
});

updateClock();
setInterval(updateClock,1000);
setInterval(refreshLiveStates,30000);
setInterval(()=>{if(!document.hidden)loadSchedule();},60000);
loadSchedule();
