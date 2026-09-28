const RAW_IDENTITIES = [
  ['ERT1',['ERT1','ERT 1','ΕΡΤ1','ΕΡΤ 1','EPT1']],
  ['ERT2 SPORT',['ERT2 SPORT','ERT2','ERT 2','ΕΡΤ2','ΕΡΤ 2','ΕΡΤ2 ΣΠΟΡ']],
  ['ERT3',['ERT3','ERT 3','ΕΡΤ3','ΕΡΤ 3']],
  ['ERT News',['ERT News','ERTNEWS','ERT NEWS','ΕΡΤ News']],
  ['ERT World',['ERT World','ERTWORLD']],
  ['ERT Cosmos',['ERT Cosmos','ERTCOSMOS']],
  ['ERT Sports 1',['ERT Sports 1','ERT Sport 1','ERTSports1']],
  ['ERT Sports 2',['ERT Sports 2','ERT Sport 2','ERTSports2']],
  ['ERT Sports 3',['ERT Sports 3','ERT Sport 3','ERTSports3']],
  ['Vouli TV',['Vouli TV','Vouli','Βουλή TV','Βουλή']],
  ['ANT1',['ANT1','ANT 1','ANTENNA','ANTENNA TV','ΑΝΤ1','ΑΝΤΕΝΝΑ','ANT1.gr']],
  ['ANT1 Comedy',['ANT1 Comedy','ANT1Comedy','ANT Comedy','Antenna Comedy','ANTCOMEDY']],
  ['ANT1 Drama',['ANT1 Drama','ANT1Drama','ANT Drama','Antenna Drama','ANTDRAMA']],
  ['ANT1+ Sports 1',['ANT1+ Sports 1','ANT1 Sports 1','Sports 1','SPORTS1']],
  ['ANT1+ Sports 2',['ANT1+ Sports 2','ANT1 Sports 2','Sports 2','SPORTS2']],
  ['ANT1+ Sports 3',['ANT1+ Sports 3','ANT1 Sports 3','Sports 3','SPORTS3']],
  ['ANT1+ Fight',['ANT1+ Fight','ANT1 Fight','Fight']],
  ['ANT1+ Padel Time TV',['ANT1+ Padel Time TV','Padel Time TV','PADEL_TIME_TV','ANT1 Padel']],
  ['Alpha TV',['Alpha TV','AlphaTV','ALPHA','ALPHA TV','AlphaTV.gr']],
  ['MEGA',['MEGA','MEGA TV','MegaTV','MEGA Channel','Mega Channel','MEGA HD','MEGA.gr']],
  ['MEGA News',['MEGA News','MEGANews','Mega News']],
  ['Star Channel',['Star Channel','STAR','Star TV','StarTV','StarChannel','StarChannel.gr']],
  ['SKAI',['SKAI','SKAI TV','SkaiTV','ΣΚΑΪ','ΣΚΑΙ','SkaiTV.gr']],
  ['Open TV',['OPEN','Open TV','OpenTV','Open Beyond','Epsilon TV','Epsilon','epsilontv','OpenTV.gr']],
  ['MAK TV',['MAK TV','MAKTV','Makedonia TV','Macedonia TV','Μακεδονία TV','MakTV.gr']],
  ['Action 24',['Action 24','Action24','ACTION TV','Action24.gr']],
  ['Kontra Channel',['Kontra Channel','Kontra','Kontra TV','KontraChannel']],
  ['One Channel',['One Channel','ONE','ONE TV']],
  ['Naftemporiki TV',['Naftemporiki TV','Naftemporiki','Ναυτεμπορική TV','Ναυτεμπορική']],
  ['MAD TV',['MAD TV','MADTV','MAD TV Greece','MADTVGreece']],
  ['Blue Sky',['Blue Sky','BlueSky','BLUE SKY TV']],
  ['Crete TV',['Crete TV','Kriti TV','Κρήτη TV','KRHTH TV']],
  ['Omega TV',['Omega TV','OMEGA','OMEGATV','OMEGA TV']]
];

const REJECTS = {
  'MEGA':['OMEGA','OMEGA TV','OMEGATV'],
  'Omega TV':['MEGA','MEGA TV','MEGATV'],
  'ANT1':['ANT1 COMEDY','ANT1 DRAMA','ANT1+ SPORTS 1','ANT1+ SPORTS 2','ANT1+ SPORTS 3','ANT1+ FIGHT','ANT1+ PADEL TIME TV'],
  'MEGA News':['MEGA CHANNEL']
};

export function normalizeChannelText(value=''){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9α-ω]+/gi,' ').trim();
}
function tokens(value=''){return normalizeChannelText(value).split(/\s+/).filter(Boolean);}
function compact(value=''){return tokens(value).join('');}
const identities = RAW_IDENTITIES.map(([name,aliases])=>({name,aliases:[name,...aliases],reject:REJECTS[name]||[]}));

export function resolveGreekIdentity(query=''){
  const q=normalizeChannelText(query), qc=compact(query);
  if(!q)return null;
  return identities.find(item=>item.aliases.some(alias=>normalizeChannelText(alias)===q || compact(alias)===qc))||null;
}

function containsTokenSequence(hayTokens,needleTokens){
  if(!needleTokens.length || needleTokens.length>hayTokens.length)return false;
  outer: for(let i=0;i<=hayTokens.length-needleTokens.length;i++){
    for(let j=0;j<needleTokens.length;j++)if(hayTokens[i+j]!==needleTokens[j])continue outer;
    return true;
  }
  return false;
}

export function channelMatchScore(text='',query='',mode='exact'){
  const hay=tokens(text); if(!hay.length)return 0;
  const identity=resolveGreekIdentity(query);
  if(identity){
    for(const reject of identity.reject){
      const rt=tokens(reject); if(containsTokenSequence(hay,rt) || hay.includes(compact(reject)))return 0;
    }
    let best=0;
    for(const alias of identity.aliases){
      const at=tokens(alias), ac=compact(alias);
      if(containsTokenSequence(hay,at))best=Math.max(best, at.length>1?6:5);
      if(ac && hay.includes(ac))best=Math.max(best,5);
    }
    if(mode==='broad' && !best){
      const family=tokens(identity.name)[0]; if(family && hay.includes(family))best=3;
    }
    return best;
  }
  const q=tokens(query); if(!q.length)return 0;
  return containsTokenSequence(hay,q) ? (mode==='broad'?3:5) : 0;
}

export function canonicalGreekChannelName(query=''){return resolveGreekIdentity(query)?.name || String(query||'').trim();}
export function greekChannelAliases(query=''){return resolveGreekIdentity(query)?.aliases || [String(query||'').trim()];}
export function makeSyntheticChannel(query=''){
  const name=canonicalGreekChannelName(query);
  return {id:name,originalId:name,tvgId:name,name,group:'Discovered',directUrls:[]};
}
export function listGreekChannelIdentities(){return identities.map(x=>({...x}));}

window.WebTVGreekChannelIdentity={resolveGreekIdentity,channelMatchScore,canonicalGreekChannelName,greekChannelAliases,makeSyntheticChannel,listGreekChannelIdentities};
