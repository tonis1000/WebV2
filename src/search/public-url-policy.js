const SENSITIVE_QUERY=/^(?:username|user|password|passwd|pass|token|access_token|refresh_token|authorization|auth|api[_-]?key|key|secret|signature|sig|policy|key-pair-id|credential|session|jwt)$/i;

export function safePublicActionUrl(value=''){
  try{
    const url=new URL(String(value||'').trim());
    if(!/^https?:$/.test(url.protocol))return '';
    if(url.username||url.password)return '';
    for(const key of url.searchParams.keys())if(SENSITIVE_QUERY.test(String(key)))return '';
    const parts=url.pathname.split('/');
    if(parts.length>=5&&['live','movie','series'].includes(String(parts[1]||'').toLowerCase()))return '';
    return url.href;
  }catch{return '';}
}
