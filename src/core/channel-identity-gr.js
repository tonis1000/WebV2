export const CHANNEL_IDENTITY_SCHEMA_VERSION = 1;

const ref = (kind,url,label='') => Object.freeze({kind,url,label});

const ACTIVE_DEFINITIONS = [
  {id:'ert1',canonicalName:'ERT1',officialNames:['ΕΡΤ1','ERT1'],aliases:['ERT 1','ΕΡΤ 1','EPT1','ert1.gr'],officialRefs:[ref('official-live','https://www.ert.gr/tv/live/','ERT live TV'),ref('official-platform','https://live.ertflix.gr/live','ERTFLIX Live')],rejects:['ERT2','ERT3','ERT NEWS','ERT SPORTS']},
  {id:'ert2',canonicalName:'ERT2',officialNames:['ΕΡΤ2 ΣΠΟΡ','ERT2'],aliases:['ERT 2','ΕΡΤ2','ΕΡΤ 2','ERT2 SPORT','ERT2 SPORTS','ΕΡΤ2 SPORT','ΕΡΤ2 ΣΠΟΡ'],officialRefs:[ref('official-live','https://www.ert.gr/tv/live/','ERT live TV'),ref('official-brand','https://www.ert.gr/epikoinonia/','ERT channel list')],rejects:['ERT SPORTS 1','ERT SPORTS 2','ERT SPORTS 3','ERT SPORTS 4','ERT SPORTS 5','ERT1','ERT3','ERT NEWS']},
  {id:'ert3',canonicalName:'ERT3',officialNames:['ΕΡΤ3','ERT3'],aliases:['ERT 3','ΕΡΤ 3'],officialRefs:[ref('official-live','https://www.ert.gr/tv/live/','ERT live TV')],rejects:['ERT1','ERT2','ERT NEWS','ERT SPORTS']},
  {id:'ertnews',canonicalName:'ERT News',officialNames:['ΕΡΤ NEWS','ERT NEWS'],aliases:['ERTNEWS','ΕΡΤ News','ertnews.gr'],officialRefs:[ref('official-site','https://www.ertnews.gr/','ERT NEWS'),ref('official-live','https://www.ert.gr/tv/live/','ERT live TV')],rejects:['ERT1','ERT2','ERT3','ERT SPORTS']},
  {id:'ant1',canonicalName:'ANT1',officialNames:['ANT1','ANT1 TV'],aliases:['ANT 1','ANTENNA','ANTENNA TV','ΑΝΤ1','ΑΝΤΕΝΝΑ','ANT1.gr','antenna.gr','ANT1 HD'],officialRefs:[ref('official-live','https://www.antenna.gr/live','ANT1 TV Live')],rejects:['ANT1 COMEDY','ANT1 DRAMA','ANT1+ SPORTS','ANT1 SPORTS','ANT1+ FIGHT','ANT1 FIGHT','PADEL TIME TV','ANT1+ PADEL','ANT1 CYPRUS','ANT1 CY','ANT1CY','ANT1 ΚΥΠΡΟΥ']},
  {id:'alpha',canonicalName:'Alpha TV',officialNames:['AlphaTV','Alpha TV'],aliases:['ALPHA','ALPHA TV','AlphaTV.gr','alpha.gr','ALPHA HD'],officialRefs:[ref('official-live','https://www.alphatv.gr/live/','AlphaTV Live')],rejects:['ALPHA CYPRUS','ALPHA CY','ALPHACYP','ALPHA ΚΥΠΡΟΥ']},
  {id:'skai',canonicalName:'SKAI',officialNames:['ΣΚΑΪ','SKAI'],aliases:['SKAI TV','SkaiTV','ΣΚΑΙ','skai.gr','SKAI HD'],officialRefs:[ref('official-site','https://www.skai.gr/tv/','SKAI TV')],rejects:[]},
  {id:'mega',canonicalName:'MEGA',officialNames:['MEGA TV','MEGA'],aliases:['MegaTV','MEGA Channel','Mega Channel','MEGA HD','MEGA.gr','megatv.com'],officialRefs:[ref('official-live','https://www.megatv.com/live/','MEGA Live')],rejects:['OMEGA','OMEGA TV','OMEGATV','MEGA NEWS']},
  {id:'open',canonicalName:'Open TV',officialNames:['OPEN TV','OPEN'],aliases:['OpenTV','Open Beyond','Epsilon TV','Epsilon','epsilontv','OpenTV.gr','tvopen.gr','OPEN HD'],officialRefs:[ref('official-live','https://www.tvopen.gr/live','OPEN TV Live')],rejects:[]},
  {id:'meganews',canonicalName:'MEGA News',officialNames:['MEGA News','MegaNews'],aliases:['MEGANews','MEGA NEWS','mega-news.gr'],officialRefs:[ref('official-site','https://www.mega-news.gr/','MEGA News'),ref('official-brand','https://www.megatv.com/showtype/meganews/','MEGA TV Mega News')],rejects:['MEGA TV','MEGA CHANNEL','MEGA HD']},
  {id:'star',canonicalName:'Star TV',officialNames:['Star TV','Star Channel'],aliases:['STAR','StarTV','StarChannel','StarChannel.gr','star.gr','STAR HD'],officialRefs:[ref('official-live','https://www.star.gr/tv/live-stream','Star TV Live')],rejects:['STAR ΚΕΝΤΡΙΚΗΣ ΕΛΛΑΔΑΣ','STAR CENTRAL GREECE']},
  {id:'action24',canonicalName:'Action 24',officialNames:['ACTION 24','Action24'],aliases:['ACTION TV','Action24.gr','action24.gr'],officialRefs:[ref('official-site','https://www.action24.gr/','ACTION 24'),ref('official-live','https://www.action24.gr/live-stream/','ACTION 24 Live')],rejects:[]},
  {id:'kontra',canonicalName:'Kontra',officialNames:['Kontra Channel','KontraChannel'],aliases:['Kontra','Kontra TV','kontrachannel','kontrachannel.gr'],officialRefs:[ref('official-live','https://kontrachannel.gr/livetv-kontrachannel.html','KontraChannel Live TV')],rejects:[]},
  {id:'tv100',canonicalName:'tv100',officialNames:['TV100','TV100 Thessaloniki'],aliases:['TV 100','TV100 THESSALONIKI','ΔΗΜΟΤΙΚΗ ΤΗΛΕΟΡΑΣΗ ΘΕΣΣΑΛΟΝΙΚΗΣ'],officialRefs:[ref('official-site','https://www.tv100.gr/','TV100 Thessaloniki'),ref('official-live','https://www.tv100.gr/live','TV100 Live')],rejects:['FM100','FM100.6']},
  {id:'baraza-greek-hits',canonicalName:'BARAZA TV HD Greek Hits',officialNames:['Baraza HD Music TV','Greek Hits'],aliases:['BARAZA TV HD GREEK HITS','Baraza MusicTV Greek Hits','Baraza HD Music TV Greek Hits','Baraza Greek Hits'],officialRefs:[ref('official-live','https://app.barazaradio.com/greekhits/','Greek Hits – Baraza HD Music TV'),ref('official-site','https://barazaradio.com/','Baraza Radio TV')],rejects:['BARAZA LAIKA','GREEK LAIKA','RELAXING']},
  {id:'baraza-laika',canonicalName:'Baraza TV Laika',officialNames:['Greek Laika Music','Baraza MusicTV'],aliases:['BARAZA TV LAIKA','Baraza Greek Laika','Greek Laika Baraza','Baraza Laika'],officialRefs:[ref('official-live','https://app.barazaradio.com/alldaymusic/','Greek Laika Music'),ref('official-site','https://barazaradio.com/','Baraza Radio TV')],rejects:['GREEK HITS','BARAZA TV HD GREEK HITS','RELAXING']},
  {id:'madtv',canonicalName:'MADTV',officialNames:['MAD TV','Mad TV'],aliases:['MADTV','MAD TV GREECE','MadTVGreece','mad.gr'],officialRefs:[ref('official-site','https://www.mad.gr/madtv/','MAD TV')],rejects:['MAD WORLD','MAD LIT']},
  {id:'madworld',canonicalName:'MAD World',officialNames:['Mad World','MAD World'],aliases:['MADWORLD','MAD WORLD TV','MadWorld'],officialRefs:[ref('official-site','https://www.mad.gr/mad-world/','Mad World')],rejects:['MAD TV','MADTV','MAD LIT']},
  {id:'paniktv',canonicalName:'Panik TV',officialNames:['Panik TV','PANIK TV'],aliases:['PANIKTV','Panik Web TV','Panik Music TV'],officialRefs:[ref('official-site','https://panikmusic.gr/panik-tv/','Panik TV')],rejects:['PANIK TV BACKSTAGE']},
  {id:'realmusictv',canonicalName:'Real Music TV',officialNames:['Real Music TV','Real Music Greece'],aliases:['REAL MUSIC TV','RealMusicTV','Real Music Greece TV','RealMusicGreece'],officialRefs:[ref('official-social','https://www.youtube.com/@RealMusicGreece','Real Music Greece (Official)'),ref('official-social','https://www.facebook.com/RealMusicgr/','Real Music Greece')],rejects:[]},
  {id:'ertsports1',canonicalName:'ΕΡΤ SPORTS 1',officialNames:['ERT Sports 1','ΕΡΤ Sports 1'],aliases:['ΕΡΤ SPORTS 1','ERT SPORT 1','ERTSPORTS1','ΕΡΤSPORTS1'],officialRefs:[ref('official-platform','https://www.ertflix.gr/epg/channel/ert-sports-live-ww','ERT Sports 1'),ref('official-live','https://live.ertflix.gr/live','ERTFLIX Live')],rejects:['ERT SPORTS 2','ERT SPORTS 3','ERT SPORTS 4','ERT SPORTS 5']},
  {id:'ertsports2',canonicalName:'ΕΡΤ SPORTS 2',officialNames:['ERT Sports 2','ΕΡΤ Sports 2'],aliases:['ΕΡΤ SPORTS 2','ERT SPORT 2','ERTSPORTS2','ΕΡΤSPORTS2'],officialRefs:[ref('official-live','https://live.ertflix.gr/live','ERTFLIX Live')],rejects:['ERT SPORTS 1','ERT SPORTS 3','ERT SPORTS 4','ERT SPORTS 5']},
  {id:'ertsports3',canonicalName:'ΕΡΤ SPORTS 3',officialNames:['ERT Sports 3','ΕΡΤ Sports 3'],aliases:['ΕΡΤ SPORTS 3','ERT SPORT 3','ERTSPORTS3','ΕΡΤSPORTS3'],officialRefs:[ref('official-live','https://live.ertflix.gr/live','ERTFLIX Live')],rejects:['ERT SPORTS 1','ERT SPORTS 2','ERT SPORTS 4','ERT SPORTS 5']},
  {id:'ertsports4',canonicalName:'ΕΡΤ SPORTS 4',officialNames:['ERT Sports 4','ΕΡΤ Sports 4'],aliases:['ΕΡΤ SPORTS 4','ERT SPORT 4','ERTSPORTS4','ΕΡΤSPORTS4'],officialRefs:[ref('official-live','https://live.ertflix.gr/live','ERTFLIX Live')],rejects:['ERT SPORTS 1','ERT SPORTS 2','ERT SPORTS 3','ERT SPORTS 5']},
];

// Compatibility-only identities from the pre-core matcher. They remain resolvable so
// this migration does not silently delete historical recognition. New identities must
// use the strict schema above and include authoritative official references.
const LEGACY_DEFINITIONS = [
  {id:'ert-world',canonicalName:'ERT World',officialNames:['ERT World'],aliases:['ERTWORLD'],officialRefs:[],rejects:[],legacy:true},
  {id:'ert-cosmos',canonicalName:'ERT Cosmos',officialNames:['ERT Cosmos'],aliases:['ERTCOSMOS'],officialRefs:[],rejects:[],legacy:true},
  {id:'vouli-tv',canonicalName:'Vouli TV',officialNames:['Vouli TV'],aliases:['Vouli','Βουλή TV','Βουλή'],officialRefs:[],rejects:[],legacy:true},
  {id:'ant1-comedy',canonicalName:'ANT1 Comedy',officialNames:['ANT1 Comedy'],aliases:['ANT1Comedy','ANT Comedy','Antenna Comedy','ANTCOMEDY'],officialRefs:[],rejects:[],legacy:true},
  {id:'ant1-drama',canonicalName:'ANT1 Drama',officialNames:['ANT1 Drama'],aliases:['ANT1Drama','ANT Drama','Antenna Drama','ANTDRAMA'],officialRefs:[],rejects:[],legacy:true},
  {id:'ant1-sports-1',canonicalName:'ANT1+ Sports 1',officialNames:['ANT1+ Sports 1'],aliases:['ANT1 Sports 1'],officialRefs:[],rejects:[],legacy:true},
  {id:'ant1-sports-2',canonicalName:'ANT1+ Sports 2',officialNames:['ANT1+ Sports 2'],aliases:['ANT1 Sports 2'],officialRefs:[],rejects:[],legacy:true},
  {id:'ant1-sports-3',canonicalName:'ANT1+ Sports 3',officialNames:['ANT1+ Sports 3'],aliases:['ANT1 Sports 3'],officialRefs:[],rejects:[],legacy:true},
  {id:'ant1-fight',canonicalName:'ANT1+ Fight',officialNames:['ANT1+ Fight'],aliases:['ANT1 Fight'],officialRefs:[],rejects:[],legacy:true},
  {id:'ant1-padel',canonicalName:'ANT1+ Padel Time TV',officialNames:['ANT1+ Padel Time TV'],aliases:['Padel Time TV','PADEL_TIME_TV','ANT1 Padel'],officialRefs:[],rejects:[],legacy:true},
  {id:'mak-tv',canonicalName:'MAK TV',officialNames:['MAK TV'],aliases:['MAKTV','Makedonia TV','Macedonia TV','Μακεδονία TV','MakTV.gr'],officialRefs:[],rejects:[],legacy:true},
  {id:'one-channel',canonicalName:'One Channel',officialNames:['One Channel'],aliases:['ONE','ONE TV'],officialRefs:[],rejects:[],legacy:true},
  {id:'naftemporiki-tv',canonicalName:'Naftemporiki TV',officialNames:['Naftemporiki TV'],aliases:['Naftemporiki','Ναυτεμπορική TV','Ναυτεμπορική'],officialRefs:[],rejects:[],legacy:true},
  {id:'blue-sky',canonicalName:'Blue Sky',officialNames:['Blue Sky'],aliases:['BlueSky','BLUE SKY TV'],officialRefs:[],rejects:[],legacy:true},
  {id:'crete-tv',canonicalName:'Crete TV',officialNames:['Crete TV'],aliases:['Kriti TV','Κρήτη TV','KRHTH TV'],officialRefs:[],rejects:[],legacy:true},
  {id:'omega-tv',canonicalName:'Omega TV',officialNames:['Omega TV'],aliases:['OMEGA','OMEGATV','OMEGA TV'],officialRefs:[],rejects:['MEGA','MEGA TV','MEGATV'],legacy:true},
];

export function normalizeChannelText(value=''){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9α-ω]+/gi,' ').replace(/\s+/g,' ').trim();
}
function tokens(value=''){return normalizeChannelText(value).split(/\s+/).filter(Boolean);}
function compact(value=''){return tokens(value).join('');}
function uniqueText(values=[]){const out=[];const seen=new Set();for(const value of values){const text=String(value||'').trim();const key=normalizeChannelText(text);if(!text||!key||seen.has(key))continue;seen.add(key);out.push(text);}return out;}

export function validateGreekChannelIdentityDefinition(input={},options={}){
  const errors=[];
  if(!String(input.id||'').trim())errors.push('stable identity id is required');
  if(!String(input.canonicalName||input.name||'').trim())errors.push('canonical name is required');
  if(!Array.isArray(input.aliases)||input.aliases.length<1)errors.push('at least one alias is required');
  if(!Array.isArray(input.officialNames)||input.officialNames.length<1)errors.push('at least one official name is required');
  const refs=Array.isArray(input.officialRefs)?input.officialRefs:[];
  if(!input.legacy&&refs.length<1)errors.push('at least one official reference is required');
  for(const item of refs){
    if(!String(item?.kind||'').startsWith('official-'))errors.push('official reference kind must start with official-');
    try{const url=new URL(String(item?.url||''));if(url.protocol!=='https:')errors.push('official reference must use HTTPS');}catch{errors.push('official reference URL is invalid');}
  }
  const result=errors.length?{ok:false,errors}:{ok:true};
  if(errors.length&&options.throwOnError)throw new Error(`Invalid channel identity: ${errors.join('; ')}`);
  return result;
}

function freezeIdentity(raw){
  validateGreekChannelIdentityDefinition(raw,{throwOnError:true});
  const canonicalName=String(raw.canonicalName||raw.name).trim();
  return Object.freeze({
    id:String(raw.id).trim(),
    name:canonicalName,
    canonicalName,
    officialNames:Object.freeze(uniqueText(raw.officialNames)),
    aliases:Object.freeze(uniqueText([canonicalName,...raw.officialNames,...raw.aliases])),
    officialRefs:Object.freeze((raw.officialRefs||[]).map(item=>Object.freeze({...item}))),
    reject:Object.freeze(uniqueText(raw.rejects||raw.reject||[])),
    rejects:Object.freeze(uniqueText(raw.rejects||raw.reject||[])),
    legacy:Boolean(raw.legacy),
    schemaVersion:CHANNEL_IDENTITY_SCHEMA_VERSION,
  });
}

const identities=Object.freeze([...ACTIVE_DEFINITIONS,...LEGACY_DEFINITIONS].map(freezeIdentity));
const byId=new Map(identities.map(item=>[normalizeChannelText(item.id),item]));

export function resolveGreekIdentity(query=''){
  const q=normalizeChannelText(query),qc=compact(query);if(!q)return null;
  if(byId.has(q))return byId.get(q);
  return identities.find(item=>[item.canonicalName,...item.officialNames,...item.aliases].some(alias=>normalizeChannelText(alias)===q||compact(alias)===qc))||null;
}

function containsTokenSequence(hayTokens,needleTokens){
  if(!needleTokens.length||needleTokens.length>hayTokens.length)return false;
  outer:for(let i=0;i<=hayTokens.length-needleTokens.length;i++){
    for(let j=0;j<needleTokens.length;j++)if(hayTokens[i+j]!==needleTokens[j])continue outer;
    return true;
  }
  return false;
}

export function channelMatchScore(text='',query='',mode='exact'){
  const hay=tokens(text);if(!hay.length)return 0;
  const identity=resolveGreekIdentity(query);
  if(identity){
    for(const reject of identity.reject){const rt=tokens(reject);if(containsTokenSequence(hay,rt)||hay.includes(compact(reject)))return 0;}
    let best=0;
    for(const alias of identity.aliases){
      const at=tokens(alias),ac=compact(alias);
      if(containsTokenSequence(hay,at))best=Math.max(best,at.length>1?6:5);
      if(ac&&hay.includes(ac))best=Math.max(best,5);
    }
    if(mode==='broad'&&!best){const family=tokens(identity.canonicalName)[0];if(family&&hay.includes(family))best=3;}
    return best;
  }
  const q=tokens(query);if(!q.length)return 0;
  return containsTokenSequence(hay,q)?(mode==='broad'?3:5):0;
}

export function channelSignalsMatch(signals=[],channel={},mode='exact'){
  const queries=[channel?.name,channel?.id,channel?.originalId,channel?.tvgId].filter(Boolean);
  const identity=queries.map(resolveGreekIdentity).find(Boolean);
  if(identity)return (signals||[]).filter(Boolean).some(signal=>channelMatchScore(signal,identity.canonicalName,mode)>0);
  return (signals||[]).filter(Boolean).some(signal=>queries.some(query=>channelMatchScore(signal,query,mode)>0));
}

export function canonicalGreekChannelName(query=''){return resolveGreekIdentity(query)?.canonicalName||String(query||'').trim();}
export function greekChannelAliases(query=''){return resolveGreekIdentity(query)?.aliases||[String(query||'').trim()].filter(Boolean);}
export function greekChannelOfficialRefs(query=''){return resolveGreekIdentity(query)?.officialRefs||[];}
export function makeSyntheticChannel(query=''){const identity=resolveGreekIdentity(query);const name=identity?.canonicalName||String(query||'').trim();const id=identity?.id||name;return{id,originalId:id,tvgId:id,name,group:'Discovered',directUrls:[]};}
export function listGreekChannelIdentities(){return identities.map(item=>({...item,officialNames:[...item.officialNames],aliases:[...item.aliases],officialRefs:item.officialRefs.map(ref=>({...ref})),reject:[...item.reject],rejects:[...item.rejects]}));}
