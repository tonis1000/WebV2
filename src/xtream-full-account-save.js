import { materializePreviewAccount } from './xtream-preview-policy.js';

function clean(value=''){return String(value??'').trim();}

function safeSampleMetadata(channel={}){
  const out={
    streamId:clean(channel.streamId),
    name:clean(channel.name),
    logo:clean(channel.logo),
    group:clean(channel.group||channel.categoryName),
    categoryId:clean(channel.categoryId),
    tvgId:clean(channel.tvgId),
  };
  return Object.fromEntries(Object.entries(out).filter(([,value])=>value!==''));
}

export function buildXtreamLibraryMarker({account={},preview={},name=''}={}){
  const accountId=clean(account.id);
  if(!accountId)throw new Error('Saved Xtream account ID is required');
  const channels=Array.isArray(preview?.channels)?preview.channels:[];
  const groupCount=new Set(channels.map(channel=>clean(channel?.group||channel?.categoryName)).filter(Boolean)).size;
  const libraryName=clean(name)||`Xtream · ${clean(account.name||account.server)||'Account'}`;
  const rawM3u=`#EXTM3U\n#EXT-X-WEBTV-XTREAM-ACCOUNT:${accountId}\n#EXTINF:-1 group-title="WebTV System",Xtream account reference\nhttps://webtv.invalid/xtream/${encodeURIComponent(accountId)}\n`;
  return{
    id:`xtpl_${accountId}`,
    name:libraryName,
    kind:'xtream',
    sourceUrl:`xtream:${accountId}`,
    rawM3u,
    channelCount:channels.length,
    groupCount,
    sampleMetadata:safeSampleMetadata(channels[0]||{}),
  };
}

export async function saveVerifiedFullXtreamAccount({candidate,expectedChannel=null,currentChannel=null,preview={},name=''}={}, {
  saveAccount,
  writeLibraryEntry,
  deleteAccount=async()=>{},
  now=Date.now(),
}={}){
  if(typeof writeLibraryEntry!=='function')throw new Error('Xtream Library entry writer is required');
  let entry=null;
  const outcome=await materializePreviewAccount(candidate,{
    expectedChannel,
    currentChannel,
    now,
    saveAccount,
    deleteAccount,
    name,
    writeLibraryEntry:async account=>{
      entry=buildXtreamLibraryMarker({account,preview,name});
      return writeLibraryEntry(entry,account);
    },
  });
  return{account:outcome.account,entry,result:outcome.result};
}
