const FEED_URL='https://webtv-sport.atonis.workers.dev/api/schedule';
const DISPLAY_TZ='Europe/Berlin';
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
};

let activeButton=null;

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
  return event.time||'--:--';
}

function isLive(event={}){
  const ms=Date.parse(event.startUtc||'');
  if(!Number.isFinite(ms))return false;
  const diff=(Date.now()-ms)/60000;
  return diff>=-10&&diff<=180;
}

function clearActiveLink(){
  document.querySelectorAll('.sport-link.active').forEach(node=>node.classList.remove('active'));
  activeButton=null;
}

function playLink(event,link,button){
  const safeUrl=safeEmbedUrl(link?.url);
  if(!safeUrl){
    setStatus('Μη έγκυρο HTTPS link.','warn');
    return;
  }
  clearActiveLink();
  button.classList.add('active');
  activeButton=button;
  els.title.textContent=event.title||'SPORT';
  els.activeLink.textContent=link.label||'Link';
  els.empty.hidden=true;
  els.frame.hidden=false;
  els.frame.src=safeUrl;
}

function makeMatchCard(event,index){
  const card=document.createElement('article');
  card.className='sport-match-card';
  card.dataset.live=isLive(event)?'1':'0';

  const line=document.createElement('div');
  line.className='sport-match-line';

  const time=document.createElement('time');
  time.className='sport-match-time';
  time.textContent=berlinTime(event);
  time.title=event.time&&event.time!==time.textContent
    ? 'Foothub: '+event.time+' · Germany: '+time.textContent
    : 'Germany time: '+time.textContent;

  const title=document.createElement('div');
  title.className='sport-match-title';
  title.textContent=event.title||('Αγώνας '+(index+1));
  line.append(time,title);

  if(isLive(event)){
    const live=document.createElement('span');
    live.className='sport-live-badge';
    live.textContent='LIVE';
    line.appendChild(live);
  }

  const links=document.createElement('div');
  links.className='sport-link-row';

  (event.links||[]).forEach((link,linkIndex)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='sport-link';
    button.setAttribute('data-link-index',String(linkIndex));
    button.textContent=link.label||('Link '+(linkIndex+1));
    button.addEventListener('click',()=>playLink(event,link,button));
    links.appendChild(button);
  });

  card.append(line,links);
  return card;
}

function renderSchedule(data){
  els.list.replaceChildren();
  clearActiveLink();

  const events=Array.isArray(data?.events)?data.events:[];
  els.domain.textContent=data?.origin
    ? 'Foothub: '+data.origin.replace(/^https?:\/\//,'')
    : 'Foothub: —';

  if(!events.length){
    setStatus('Δεν βρέθηκαν αγώνες από τις διαθέσιμες δημόσιες πηγές.','warn');
    return;
  }

  const source=data?.source==='program.txt'?'program.txt':'homepage';
  const freshness=data?.fresh===false?' · παλιό feed':'';
  setStatus(events.length+' αγώνες · '+source+freshness+' · ώρα Γερμανίας',data?.fresh===false?'warn':'ok');

  for(const [index,event] of events.entries()){
    els.list.appendChild(makeMatchCard(event,index));
  }
}

async function loadSchedule(){
  els.refresh.disabled=true;
  setStatus('Φόρτωση προγράμματος…','loading');
  try{
    const response=await fetch(FEED_URL+'?t='+Date.now(),{cache:'no-store'});
    const data=await response.json();
    if(!response.ok||data?.ok!==true)throw new Error(data?.error||('HTTP '+response.status));
    renderSchedule(data);
  }catch(error){
    console.error('[SPORT] schedule load failed',error);
    setStatus('Αποτυχία φόρτωσης: '+(error?.message||error),'error');
  }finally{
    els.refresh.disabled=false;
  }
}

function updateClock(){
  els.clock.textContent=new Intl.DateTimeFormat('de-DE',{
    timeZone:DISPLAY_TZ,weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).format(new Date());
}

els.refresh?.addEventListener('click',loadSchedule);
els.frame?.addEventListener('error',()=>{
  activeButton?.classList.add('failed');
  setStatus('Το επιλεγμένο iframe δεν φόρτωσε. Δοκίμασε άλλο Link.','warn');
});

updateClock();
setInterval(updateClock,1000);
loadSchedule();
