function countM3U(text=''){
  const channels=(String(text).match(/^#EXTINF:/gm)||[]).length;
  const groups=new Set([...String(text).matchAll(/group-title="([^"]*)"/g)].map(m=>m[1]||'Other')).size;
  return {channels,groups};
}
export function savedPlaylistCacheItem(detail={},local=null,now=Date.now()){
  const kind=String(detail.kind||'saved');
  const isCustom=kind==='custom';
  const raw=isCustom?'':String(detail.rawM3u||'');
  const summary=isCustom?{channels:Number(detail.channelCount||0),groups:Number(detail.groupCount||0)}:countM3U(raw);
  const remoteUpdatedAt=Date.parse(detail.updatedAt)||0;
  return {
    id:String(detail.id||''),
    name:String(detail.name||''),
    type:kind,
    url:String(detail.sourceUrl||''),
    text:raw,
    channelCount:Number(detail.channelCount||summary.channels||0),
    groupCount:Number(detail.groupCount||summary.groups||0),
    createdAt:Date.parse(detail.createdAt)||local?.createdAt||now,
    updatedAt:remoteUpdatedAt||now,
  };
}
