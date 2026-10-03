import { resolveChannelProfile } from './channel-profile-gr.js';

export const VERIFIED_LOGO_SOURCE_KINDS = Object.freeze([
  'official-broadcaster',
  'official-media-group',
  'official-publisher-site',
  'wikimedia-commons',
  'registry-verified',
]);

export const CURATED_LOGO_SOURCE_KINDS = Object.freeze([
  'curated-third-party',
  'registry-curated-override',
]);

const VERIFIED = new Set(VERIFIED_LOGO_SOURCE_KINDS);
const CURATED = new Set(CURATED_LOGO_SOURCE_KINDS);

export function sanitizeLogoCandidate(value=''){
  const url=String(value||'').trim();
  if(!url)return '';
  if(/^https?:\/\/(?:www\.)?goo\.gl\//i.test(url))return '';
  if(/^data:image\//i.test(url))return url;
  if(!/^https?:\/\//i.test(url))return '';
  try{
    const parsed=new URL(url);
    if(!['http:','https:'].includes(parsed.protocol))return '';
    return parsed.href;
  }catch{return '';}
}

export function logoTrustForSourceKind(sourceKind=''){
  const kind=String(sourceKind||'').trim();
  if(VERIFIED.has(kind))return 'verified';
  if(CURATED.has(kind))return 'curated';
  if(kind)return 'unverified';
  return 'none';
}

function freezeResult(value){
  return Object.freeze({...value});
}

function candidate({url='',sourceKind='',sourceUrl='',origin='',profileId=''}) {
  const clean=sanitizeLogoCandidate(url);
  if(!clean)return null;
  const trust=logoTrustForSourceKind(sourceKind);
  const rank=trust==='verified'?300:sourceKind==='registry-curated-override'?250:trust==='curated'?200:100;
  return {url:clean,sourceKind:String(sourceKind||''),sourceUrl:String(sourceUrl||''),origin,profileId,trust,verified:trust==='verified',rank};
}

export function resolveChannelLogo({
  id='',
  tvgId='',
  name='',
  profile=null,
  providedLogo='',
  providedSourceKind='channel-provided',
  providedSourceUrl='',
}={}) {
  const resolvedProfile=profile||resolveChannelProfile(id||tvgId||name);
  const options=[];

  if(resolvedProfile?.logo?.status==='available'){
    const fromProfile=candidate({
      url:resolvedProfile.logo.preferredUrl,
      sourceKind:resolvedProfile.logo.sourceKind,
      sourceUrl:resolvedProfile.logo.sourceUrl,
      origin:'channel-profile',
      profileId:resolvedProfile.id,
    });
    if(fromProfile)options.push(fromProfile);
  }

  const supplied=candidate({
    url:providedLogo,
    sourceKind:providedSourceKind,
    sourceUrl:providedSourceUrl,
    origin:'channel-provided',
    profileId:resolvedProfile?.id||'',
  });
  if(supplied)options.push(supplied);

  options.sort((a,b)=>b.rank-a.rank);
  const chosen=options[0]||null;
  if(!chosen){
    return freezeResult({
      status:'pending',
      url:'',
      sourceKind:'',
      sourceUrl:'',
      origin:'none',
      profileId:resolvedProfile?.id||'',
      trust:'none',
      verified:false,
    });
  }

  return freezeResult({
    status:'available',
    url:chosen.url,
    sourceKind:chosen.sourceKind,
    sourceUrl:chosen.sourceUrl,
    origin:chosen.origin,
    profileId:chosen.profileId,
    trust:chosen.trust,
    verified:chosen.verified,
  });
}
