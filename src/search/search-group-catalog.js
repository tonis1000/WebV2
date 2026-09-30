const GROUPS=Object.freeze([
  Object.freeze({
    id:'ert',type:'group',label:'ERT',aliases:Object.freeze(['ERT','ΕΡΤ']),
    targets:Object.freeze([
      Object.freeze({id:'ert1',name:'ERT1'}),Object.freeze({id:'ert2',name:'ERT2'}),Object.freeze({id:'ert3',name:'ERT3'}),Object.freeze({id:'ertnews',name:'ERT News'}),
      Object.freeze({id:'ertsports1',name:'ERT Sports 1'}),Object.freeze({id:'ertsports2',name:'ERT Sports 2'}),Object.freeze({id:'ertsports3',name:'ERT Sports 3'}),Object.freeze({id:'ertsports4',name:'ERT Sports 4'}),
    ]),
  }),
  Object.freeze({
    id:'ant1',type:'group',label:'ANT1',aliases:Object.freeze(['ANT1','ANTENNA','ΑΝΤ1']),
    targets:Object.freeze([
      Object.freeze({id:'ant1',name:'ANT1'}),Object.freeze({id:'ant1-comedy',name:'ANT1 Comedy'}),Object.freeze({id:'ant1-drama',name:'ANT1 Drama'}),
      Object.freeze({id:'ant1-sports-1',name:'ANT1+ Sports 1'}),Object.freeze({id:'ant1-sports-2',name:'ANT1+ Sports 2'}),Object.freeze({id:'ant1-sports-3',name:'ANT1+ Sports 3'}),
      Object.freeze({id:'ant1-fight',name:'ANT1+ Fight'}),Object.freeze({id:'ant1-padel',name:'ANT1+ Padel Time TV'}),
    ]),
  }),
  Object.freeze({id:'nova',type:'group',label:'Nova',aliases:Object.freeze(['NOVA']),targets:Object.freeze([Object.freeze({id:'nova-family',name:'Nova',familyQuery:true})])}),
  Object.freeze({id:'cosmote',type:'group',label:'Cosmote',aliases:Object.freeze(['COSMOTE','OTE TV']),targets:Object.freeze([Object.freeze({id:'cosmote-family',name:'Cosmote',familyQuery:true})])}),
  Object.freeze({id:'cosmote-sport',type:'subgroup',label:'Cosmote Sport',aliases:Object.freeze(['COSMOTE SPORT','COSMOTE SPORTS']),targets:Object.freeze([Object.freeze({id:'cosmote-sport-family',name:'Cosmote Sport',familyQuery:true})])}),
]);

function cloneTarget(target={}){return Object.freeze({...target});}
function cloneGroup(group={}){return Object.freeze({...group,aliases:Object.freeze([...(group.aliases||[])]),targets:Object.freeze((group.targets||[]).map(cloneTarget))});}

export function listSearchGroups(){return GROUPS.map(cloneGroup);}

export function buildSearchContext(channels=[]){
  const real=(Array.isArray(channels)?channels:[]).map(channel=>Object.freeze({...channel}));
  const synthetic=[];const seen=new Set(real.map(channel=>String(channel.id||'').trim()).filter(Boolean));
  for(const group of GROUPS)for(const target of group.targets||[]){
    if(seen.has(target.id))continue;
    seen.add(target.id);synthetic.push(Object.freeze({...target}));
  }
  return Object.freeze({channels:Object.freeze([...real,...synthetic]),groups:Object.freeze(listSearchGroups())});
}
