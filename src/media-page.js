const WORKER='https://webtv-media.atonis.workers.dev';
const $=id=>document.getElementById(id);
const els={status:$('media-status'),catalog:$('media-catalog'),detail:$('media-detail'),title:$('media-detail-title'),description:$('media-detail-description'),episodes:$('media-episode-list'),official:$('media-official-link'),back:$('media-detail-back'),search:$('media-search')};
let catalog=[];

function setStatus(message,tone='loading'){els.status.textContent=message;els.status.dataset.tone=tone;}
function empty(node){while(node?.firstChild)node.removeChild(node.firstChild);}
function makeCard(item){
  const button=document.createElement('button');button.type='button';button.className='media-title-card';button.dataset.mediaId=item.id;
  const badge=document.createElement('span');badge.className='media-title-badge';badge.textContent='ERTFLIX';
  const title=document.createElement('strong');title.textContent=item.title;
  const meta=document.createElement('span');meta.textContent='Σειρά · Official';
  button.append(badge,title,meta);
  button.addEventListener('click',()=>openSeries(item.id));
  return button;
}
function renderCatalog(){
  empty(els.catalog);
  const q=(els.search?.value||'').trim().toLocaleLowerCase('el');
  const rows=catalog.filter(item=>!q||item.title.toLocaleLowerCase('el').includes(q));
  for(const item of rows)els.catalog.appendChild(makeCard(item));
  setStatus(rows.length?rows.length+' σειρές από ERTFlix':'Δεν βρέθηκαν σειρές',rows.length?'ok':'warn');
}
function makeEpisode(item){
  const row=document.createElement('a');row.className='media-episode-row';row.href=item.officialUrl;row.target='_blank';row.rel='noopener noreferrer';
  const num=document.createElement('span');num.className='media-episode-number';num.textContent=item.episodeNumber?'E'+item.episodeNumber:'EP';
  const body=document.createElement('span');body.className='media-episode-body';
  const title=document.createElement('strong');title.textContent=item.title;
  const meta=document.createElement('small');meta.textContent='Official ERTFlix';
  body.append(title,meta);row.append(num,body);return row;
}
async function openSeries(id){
  setStatus('Φόρτωση επεισοδίων…');
  try{
    const response=await fetch(WORKER+'/api/series/'+encodeURIComponent(id),{cache:'no-store'});
    const data=await response.json();
    if(!response.ok||!data.ok||!data.series)throw new Error(data.error||'Series unavailable');
    const series=data.series;
    els.title.textContent=series.title;
    els.description.textContent=series.description||'Official ERTFlix series';
    els.official.href=series.officialUrl;
    empty(els.episodes);
    for(const episode of series.episodes||[])els.episodes.appendChild(makeEpisode(episode));
    if(!(series.episodes||[]).length){const p=document.createElement('p');p.className='media-empty';p.textContent='Δεν βρέθηκαν δομημένα επεισόδια στην τρέχουσα δημόσια σελίδα ERTFlix.';els.episodes.appendChild(p);}
    els.catalog.hidden=true;els.detail.hidden=false;
    setStatus((series.episodes?.length||0)+' επεισόδια · '+series.title,'ok');
  }catch(error){setStatus('ERTFlix details unavailable: '+error.message,'error');}
}
async function loadCatalog(){
  setStatus('Φόρτωση ERTFlix catalog…');
  try{
    const response=await fetch(WORKER+'/api/catalog',{cache:'no-store'});
    const data=await response.json();
    if(!response.ok||!data.ok||!Array.isArray(data.items))throw new Error(data.error||'Catalog unavailable');
    catalog=data.items;renderCatalog();
  }catch(error){
    setStatus('ERTFlix catalog unavailable: '+error.message,'error');
    empty(els.catalog);const p=document.createElement('p');p.className='media-empty';p.textContent='Η δημόσια πηγή ERTFlix δεν είναι διαθέσιμη αυτή τη στιγμή.';els.catalog.appendChild(p);
  }
}
els.back?.addEventListener('click',()=>{els.detail.hidden=true;els.catalog.hidden=false;renderCatalog();});
els.search?.addEventListener('input',renderCatalog);
loadCatalog();
