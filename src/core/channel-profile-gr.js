import { resolveGreekIdentity } from './channel-identity-gr.js';

export const CHANNEL_PROFILE_SCHEMA_VERSION = 1;
export const CHANNEL_PROFILE_CATEGORIES = Object.freeze(['Γενικά','Ειδήσεις','Αθλητικά','Μουσική','Περιφερειακά']);

const VALID_STATUS = new Set(['available','pending','unavailable']);
const CATEGORY = new Set(CHANNEL_PROFILE_CATEGORIES);
const FORBIDDEN_METADATA_KEYS = ['sources','directUrls','playbackUrl'];
const STREAM_URL_RE = /(?:rtmps?|rtsps?):\/\/|\.(?:m3u8|mpd|mp4|webm|ts)(?:[?"\\]|$)/i;

function blankLogo(){
  return Object.freeze({status:'pending',preferredUrl:'',sourceKind:'',sourceUrl:'',fallbacks:Object.freeze([])});
}
function blankEpg(){
  return Object.freeze({status:'pending',sourceId:null,preferredId:null,aliases:Object.freeze([])});
}
function profile(id,category){
  return Object.freeze({
    id,
    country:'GR',
    language:'el',
    category:Object.freeze({primary:category}),
    logo:blankLogo(),
    epg:blankEpg(),
    schemaVersion:CHANNEL_PROFILE_SCHEMA_VERSION,
  });
}

const DEFINITIONS = Object.freeze([
  profile('ert1','Γενικά'),
  profile('ert2','Αθλητικά'),
  profile('ert3','Γενικά'),
  profile('ertnews','Ειδήσεις'),
  profile('ant1','Γενικά'),
  profile('alpha','Γενικά'),
  profile('skai','Γενικά'),
  profile('mega','Γενικά'),
  profile('open','Γενικά'),
  profile('meganews','Ειδήσεις'),
  profile('star','Γενικά'),
  profile('action24','Ειδήσεις'),
  profile('kontra','Ειδήσεις'),
  profile('tv100','Περιφερειακά'),
  profile('baraza-greek-hits','Μουσική'),
  profile('baraza-laika','Μουσική'),
  profile('madtv','Μουσική'),
  profile('madworld','Μουσική'),
  profile('paniktv','Μουσική'),
  profile('realmusictv','Μουσική'),
  profile('ertsports1','Αθλητικά'),
  profile('ertsports2','Αθλητικά'),
  profile('ertsports3','Αθλητικά'),
  profile('ertsports4','Αθλητικά'),
]);

const byId = new Map(DEFINITIONS.map(item => [item.id,item]));

function isHttps(value=''){
  try{return new URL(String(value||'')).protocol==='https:';}catch{return false;}
}
function hasForbiddenKeys(value,keys=FORBIDDEN_METADATA_KEYS){
  if(!value||typeof value!=='object')return false;
  return keys.some(key=>Object.prototype.hasOwnProperty.call(value,key));
}
function cloneProfile(item){
  if(!item)return null;
  const category=Object.freeze({...item.category});
  const fallbacks=Object.freeze([...(item.logo?.fallbacks||[])]);
  const logo=Object.freeze({...item.logo,fallbacks});
  const aliases=Object.freeze([...(item.epg?.aliases||[])]);
  const epg=Object.freeze({...item.epg,aliases});
  return Object.freeze({...item,category,logo,epg});
}

export function validateChannelProfileDefinition(input={},options={}){
  const errors=[];
  const id=String(input.id||'').trim();
  const identity=id?resolveGreekIdentity(id):null;
  if(!id)errors.push('stable profile id is required');
  if(!identity||identity.legacy||identity.id!==id)errors.push('profile id must resolve to the same active strict identity id');
  if(!String(input.country||'').trim())errors.push('country is required');
  if(!String(input.language||'').trim())errors.push('language is required');
  if(!CATEGORY.has(input.category?.primary))errors.push('category must be one of the approved canonical categories');

  const logo=input.logo||{};
  if(!VALID_STATUS.has(logo.status))errors.push('logo status must be available, pending, or unavailable');
  if(logo.status==='available'){
    if(!isHttps(logo.preferredUrl))errors.push('available logo requires an HTTPS preferredUrl');
    if(!String(logo.sourceKind||'').trim())errors.push('available logo requires sourceKind provenance');
  }
  if(logo.status==='pending'&&String(logo.preferredUrl||'').trim())errors.push('pending logo must not claim preferredUrl');
  if(logo.fallbacks!==undefined&&!Array.isArray(logo.fallbacks))errors.push('logo fallbacks must be an array');

  const epg=input.epg||{};
  if(!VALID_STATUS.has(epg.status))errors.push('EPG status must be available, pending, or unavailable');
  if(epg.status==='available'){
    if(!String(epg.sourceId||'').trim())errors.push('available EPG requires sourceId');
    if(!String(epg.preferredId||'').trim())errors.push('available EPG requires preferredId');
  }
  if(!Array.isArray(epg.aliases))errors.push('EPG aliases must be an array');

  if(hasForbiddenKeys(input,[...FORBIDDEN_METADATA_KEYS,'sourceUrl']))errors.push('profile root must not contain stream/source ownership fields');
  if(hasForbiddenKeys(input.category)||hasForbiddenKeys(epg)||hasForbiddenKeys(logo))errors.push('nested profile metadata must not contain playback/source ownership fields');
  if(Object.prototype.hasOwnProperty.call(epg,'sourceUrl'))errors.push('EPG metadata must not contain sourceUrl');
  if(STREAM_URL_RE.test(JSON.stringify(input)))errors.push('profile must not contain media stream URLs');

  const result=errors.length?{ok:false,errors}:{ok:true};
  if(errors.length&&options.throwOnError)throw new Error(`Invalid channel profile: ${errors.join('; ')}`);
  return result;
}

for(const item of DEFINITIONS)validateChannelProfileDefinition(item,{throwOnError:true});

export function getChannelProfileById(id=''){
  return cloneProfile(byId.get(String(id||'').trim())||null);
}

export function resolveChannelProfile(value=''){
  const identity=resolveGreekIdentity(value);
  if(!identity||identity.legacy)return null;
  return getChannelProfileById(identity.id);
}

export function listChannelProfiles(){return DEFINITIONS.map(cloneProfile);}
