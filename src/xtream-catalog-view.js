export const XTREAM_PAGE_SIZE=100;

function clean(value=''){return String(value??'').trim();}
function folded(value=''){return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}

export function filterXtreamChannels(channels=[],{group='',query=''}={}){
  const wantedGroup=clean(group);
  const q=folded(query);
  return (Array.isArray(channels)?channels:[]).filter(channel=>{
    if(wantedGroup&&clean(channel?.group||channel?.categoryName)!==wantedGroup)return false;
    if(!q)return true;
    return [channel?.name,channel?.tvgId,channel?.streamId,channel?.group,channel?.categoryName]
      .some(value=>folded(value).includes(q));
  });
}

export function pageXtreamChannels(channels=[],page=0,pageSize=XTREAM_PAGE_SIZE){
  const size=Math.max(1,Math.min(XTREAM_PAGE_SIZE,Number(pageSize)||XTREAM_PAGE_SIZE));
  const index=Math.max(0,Math.floor(Number(page)||0));
  const start=index*size;
  return (Array.isArray(channels)?channels:[]).slice(start,start+size);
}

export function summarizeXtreamGroups(channels=[]){
  const counts=new Map();
  for(const channel of Array.isArray(channels)?channels:[]){
    const group=clean(channel?.group||channel?.categoryName)||'Xtream';
    counts.set(group,(counts.get(group)||0)+1);
  }
  return [...counts.entries()]
    .map(([group,count])=>({group,count}))
    .sort((a,b)=>a.group.localeCompare(b.group,undefined,{sensitivity:'base'}));
}
