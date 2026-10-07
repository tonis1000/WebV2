function clean(value=''){return String(value||'').trim();}

export function reconcileXtreamLibraryRows(savedRows=[],accounts=[]){
  const rows=(Array.isArray(savedRows)?savedRows:[]).map(row=>({...row,recoveredXtreamAccount:Boolean(row?.recoveredXtreamAccount)}));
  const present=new Set();
  for(const row of rows){
    if(row?.type!=='xtream')continue;
    const match=/^xtream:(.+)$/i.exec(clean(row.url||row.sourceUrl));
    const id=clean(match?.[1]);
    if(id)present.add(id);
  }
  for(const account of Array.isArray(accounts)?accounts:[]){
    const id=clean(account?.id);
    if(!id||present.has(id))continue;
    const name=clean(account?.name)||'Account';
    rows.push({
      id:`xtpl_${id}`,
      name:`Xtream · ${name}`,
      type:'xtream',
      url:`xtream:${id}`,
      text:'',
      channelCount:0,
      groupCount:0,
      recoveredXtreamAccount:true,
      createdAt:0,
      updatedAt:0,
    });
    present.add(id);
  }
  return rows;
}
