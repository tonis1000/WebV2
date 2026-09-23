const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="42" height="42"%3E%3Crect width="100%25" height="100%25" rx="8" fill="%2310161c"/%3E%3C/svg%3E';

export function safeLogo(value=''){
  const url=String(value||'').trim();
  if(!url)return '';
  if(/^https?:\/\/(?:www\.)?goo\.gl\//i.test(url))return '';
  if(!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url))return '';
  return url;
}

let observer=null;
function getObserver(){
  if(observer || typeof IntersectionObserver==='undefined')return observer;
  observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const img=entry.target;
      const url=safeLogo(img.dataset.logoSrc||'');
      if(url)img.src=url;
      delete img.dataset.logoSrc;
      observer.unobserve(img);
    }
  },{root:null,rootMargin:'220px 0px',threshold:0.01});
  return observer;
}

export function prepareLazyLogo(img,value=''){
  if(!img)return;
  const url=safeLogo(value);
  img.alt='';
  img.decoding='async';
  img.loading='lazy';
  img.src=PLACEHOLDER;
  if(!url)return;
  const io=getObserver();
  if(!io){img.src=url;return;}
  img.dataset.logoSrc=url;
  io.observe(img);
}

export function applyImmediateLogo(img,value=''){
  if(!img)return false;
  const url=safeLogo(value);
  if(!url){
    img.removeAttribute('src');
    img.hidden=true;
    return false;
  }
  img.decoding='async';
  img.src=url;
  img.hidden=false;
  return true;
}

export function sanitizeExistingLogos(root=document){
  for(const img of root.querySelectorAll?.('img[src],img[data-logo-src]')||[]){
    const raw=img.dataset.logoSrc||img.getAttribute('src')||'';
    if(/^https?:\/\/(?:www\.)?goo\.gl\//i.test(raw)){
      img.removeAttribute('src');
      delete img.dataset.logoSrc;
    }
  }
}

export const LOGO_PLACEHOLDER=PLACEHOLDER;
