const STYLE_ID='webtv-epg-guide-style';
const MODULE_URL='./epg-guide.js?v=20261006-epg-performance-a';
let loadPromise=null;

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement('link');
  link.id=STYLE_ID;link.rel='stylesheet';link.href='./epg-guide.css?v=20261006-epg-performance-a';
  document.head.appendChild(link);
}
function loadGuide(){
  if(loadPromise)return loadPromise;
  ensureStyle();
  loadPromise=import(MODULE_URL).catch(error=>{loadPromise=null;throw error;});
  return loadPromise;
}
function maybeLoad(unlocked){
  if(!unlocked)return;
  loadGuide().catch(error=>console.warn('[WebTV] EPG Guide lazy-load failed',error));
}
window.addEventListener('webtv:admin-visibility',event=>maybeLoad(Boolean(event.detail?.unlocked)));
if(document.documentElement.classList.contains('admin-unlocked'))maybeLoad(true);

console.info('[WebTV] EPG Guide loader ready');
