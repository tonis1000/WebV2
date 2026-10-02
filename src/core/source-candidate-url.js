function decodeLiteralUnicodeEscapes(value=''){
  return String(value||'').replace(/\\u([0-9a-fA-F]{4})/g,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
}

export function sanitizeCandidateUrl(raw=''){
  let text=decodeLiteralUnicodeEscapes(raw)
    .replace(/\\\//g,'/')
    .replace(/&amp;/gi,'&')
    .replace(/[\u0000-\u001F\u007F]/g,'')
    .trim();

  const markupAt=text.search(/[<>]/);
  if(markupAt>=0)text=text.slice(0,markupAt);
  text=text.replace(/[\\\s]+$/g,'').trim();

  if(!text)return '';
  const pipe=text.indexOf('|');
  const base=(pipe>=0?text.slice(0,pipe):text).trim();
  const suffix=pipe>=0?text.slice(pipe):'';

  try{
    const url=new URL(base);
    if(!/^https?:$/.test(url.protocol))return '';
  }catch{return '';}

  return base+suffix;
}
