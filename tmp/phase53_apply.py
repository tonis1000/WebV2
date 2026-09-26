from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly 1 anchor, found {count}')
    p.write_text(text.replace(old, new, 1))

# Xtream client: authenticated/idempotent channel-secret cleanup call.
replace_once(
    'src/xtream-client.js',
    "export async function deleteXtreamAccount(id) {\n",
    "export async function deleteXtreamChannelSource(id) {\n"
    "  const sourceId = String(id || '').trim();\n"
    "  if (!/^xch_[A-Za-z0-9_-]{8,64}$/.test(sourceId)) throw new Error('Invalid Xtream channel source ID');\n"
    "  const result = await bridgeFetch(`/api/channel-sources/${encodeURIComponent(sourceId)}`, { method: 'DELETE' });\n"
    "  return {\n"
    "    id: String(result.id || sourceId),\n"
    "    deleted: Boolean(result.deleted),\n"
    "    reason: String(result.reason || ''),\n"
    "    references: Number(result.references || 0),\n"
    "  };\n"
    "}\n\n"
    "export async function deleteXtreamAccount(id) {\n"
)

# Worker: server-side orphan guard against active My Playlist references.
replace_once(
    'workers/xtream-preview-routes.js',
    "async function proxyUrlFor(requestUrl,env,absoluteTarget){",
    "async function deleteChannelOnly(env,sourceId){\n"
    "  await ensureTables(env);\n"
    "  const id=clean(sourceId);\n"
    "  if(!/^xch_[A-Za-z0-9_-]{8,64}$/.test(id))throw errorWithStatus('Invalid Xtream channel source ID');\n"
    "  const existing=await env.DB.prepare(`SELECT id FROM xtream_channel_sources WHERE id=?`).bind(id).first();\n"
    "  if(!existing)return{id,deleted:false,reason:'not-found',references:0};\n"
    "  const needle=`/channel-stream/${id}/`;\n"
    "  const referenceRow=await env.DB.prepare(`SELECT COUNT(*) AS n FROM channel_sources s JOIN my_playlist m ON m.channel_id=s.channel_id WHERE s.enabled=1 AND instr(s.url, ?) > 0`).bind(needle).first();\n"
    "  const references=Math.max(0,Number(referenceRow?.n||0));\n"
    "  if(references>0)return{id,deleted:false,reason:'still-referenced',references};\n"
    "  await env.DB.prepare(`DELETE FROM xtream_channel_sources WHERE id=?`).bind(id).run();\n"
    "  return{id,deleted:true,reason:'deleted',references:0};\n"
    "}\n\n"
    "async function proxyUrlFor(requestUrl,env,absoluteTarget){"
)
replace_once(
    'workers/xtream-preview-routes.js',
    "function isPhase52Path(path){return path==='/api/preview'||path==='/api/accounts/from-preview'||path==='/api/channel-sources'||/^\\/preview-stream\\/[^/]+\\.m3u8$/.test(path)||/^\\/channel-stream\\/[^/]+\\/[^/]+\\.m3u8$/.test(path);}",
    "function isPhase52Path(path){return path==='/api/preview'||path==='/api/accounts/from-preview'||path==='/api/channel-sources'||/^\\/api\\/channel-sources\\/[^/]+$/.test(path)||/^\\/preview-stream\\/[^/]+\\.m3u8$/.test(path)||/^\\/channel-stream\\/[^/]+\\/[^/]+\\.m3u8$/.test(path);}"
)
replace_once(
    'workers/xtream-preview-routes.js',
    "    const previewMatch=path.match(/^\\/preview-stream\\/([^/]+)\\.m3u8$/);if(previewMatch&&request.method==='GET')return previewStream(request,env,decodeURIComponent(previewMatch[1]),origin);",
    "    const cleanupMatch=path.match(/^\\/api\\/channel-sources\\/([^/]+)$/);\n"
    "    if(cleanupMatch&&request.method==='DELETE'){const denied=await requireAdmin(request,env,origin);if(denied)return denied;const result=await deleteChannelOnly(env,decodeURIComponent(cleanupMatch[1]));return json({ok:true,...result},200,origin);}\n"
    "    const previewMatch=path.match(/^\\/preview-stream\\/([^/]+)\\.m3u8$/);if(previewMatch&&request.method==='GET')return previewStream(request,env,decodeURIComponent(previewMatch[1]),origin);"
)

# Playlist manager: cleanup only URLs explicitly removed by successful My Playlist writes.
replace_once(
    'src/playlist-manager.js',
    "import { parseM3U, dedupeChannels } from './core/channel-catalog.js?v=20260920-1021';\n",
    "import { parseM3U, dedupeChannels } from './core/channel-catalog.js?v=20260920-1021';\n"
    "import { diffRemovedUrls, cleanupRemovedXtreamChannelSources } from './xtream-channel-lifecycle.js?v=20260926-1800';\n"
)
replace_once(
    'src/playlist-manager.js',
    "function selectedChannel(){return api()?.getSelectedChannel?.()||null;}\n\nasync function refreshPrimary",
    "function selectedChannel(){return api()?.getSelectedChannel?.()||null;}\n"
    "async function cleanupXtreamAfterSourceRemoval(previousUrls,currentUrls,context){\n"
    "  const removed=diffRemovedUrls(previousUrls,currentUrls);\n"
    "  if(!removed.length)return{cleaned:[],retained:[],failed:[]};\n"
    "  const result=await cleanupRemovedXtreamChannelSources(removed);\n"
    "  if(result.cleaned.length)log(`XTREAM CHANNEL CLEANUP ${context} · deleted ${result.cleaned.length} orphan secret(s)`);\n"
    "  if(result.retained.length)log(`XTREAM CHANNEL CLEANUP ${context} · retained ${result.retained.length} referenced secret(s)`);\n"
    "  if(result.failed.length)log(`XTREAM CHANNEL CLEANUP ${context} · ${result.failed.length} cleanup failure(s) · My Playlist write remains committed`);\n"
    "  return result;\n"
    "}\n\n"
    "async function refreshPrimary"
)
replace_once(
    'src/playlist-manager.js',
    "async function removeMyChannel(channel){\n  if(!confirm(`Remove “${channel.name}” from My Playlist?`))return;\n  try{\n    await deleteRegistryChannel(channel.id||channel.originalId||channel.name);\n    setStatus(`${channel.name} removed from My Playlist`,'idle');\n    log(`MY PLAYLIST REMOVE · ${channel.name} · D1`);\n    await refreshPrimary({reason:'remove-channel'});\n    if(myCache.length)await updateRegistryOrder(myCache).catch(()=>{});\n  }catch(error){setStatus(error.message,'error');log(`D1 REMOVE CHANNEL FAILED · ${error.message}`);}\n}",
    "async function removeMyChannel(channel){\n  if(!confirm(`Remove “${channel.name}” from My Playlist?`))return;\n  try{\n    myCache=await fetchMyPlaylist();myCacheLoaded=true;\n    const key=normalize(channel.id||channel.originalId||channel.name);\n    const current=myCache.find(c=>normalize(c.id||c.originalId||c.name)===key);\n    const previousUrls=[...(current?.directUrls||channel.directUrls||[])];\n    await deleteRegistryChannel(channel.id||channel.originalId||channel.name);\n    setStatus(`${channel.name} removed from My Playlist`,'idle');\n    log(`MY PLAYLIST REMOVE · ${channel.name} · D1`);\n    await refreshPrimary({reason:'remove-channel'});\n    await cleanupXtreamAfterSourceRemoval(previousUrls,[],'REMOVE CHANNEL');\n    if(myCache.length)await updateRegistryOrder(myCache).catch(()=>{});\n  }catch(error){setStatus(error.message,'error');log(`D1 REMOVE CHANNEL FAILED · ${error.message}`);}\n}"
)
replace_once(
    'src/playlist-manager.js',
    "    if(index<0)throw new Error('Channel is no longer in My Playlist');\n    const edited={...myCache[index],name:name.trim(),group:(group||'Other').trim(),directUrls:urls};\n    await putRegistryChannel(edited,index,true);",
    "    if(index<0)throw new Error('Channel is no longer in My Playlist');\n    const previousUrls=[...(myCache[index].directUrls||[])];\n    const edited={...myCache[index],name:name.trim(),group:(group||'Other').trim(),directUrls:urls};\n    await putRegistryChannel(edited,index,true);"
)
replace_once(
    'src/playlist-manager.js',
    "    await refreshPrimary({reason:'edit-channel'});\n  }catch(error){setStatus(error.message,'error');log(`D1 EDIT CHANNEL FAILED · ${error.message}`);}",
    "    await refreshPrimary({reason:'edit-channel'});\n    await cleanupXtreamAfterSourceRemoval(previousUrls,urls,'EDIT CHANNEL');\n  }catch(error){setStatus(error.message,'error');log(`D1 EDIT CHANNEL FAILED · ${error.message}`);}"
)
replace_once(
    'src/playlist-manager.js',
    "      if(index<0)throw new Error('Channel is no longer in My Playlist');\n      const edited={...myCache[index],directUrls:urls};\n      await putRegistryChannel(edited,index,true);",
    "      if(index<0)throw new Error('Channel is no longer in My Playlist');\n      const previousUrls=[...(myCache[index].directUrls||[])];\n      const edited={...myCache[index],directUrls:urls};\n      await putRegistryChannel(edited,index,true);"
)
replace_once(
    'src/playlist-manager.js',
    "      overlay.hidden=true;\n      await refreshPrimary({reason:'edit-sources'});",
    "      overlay.hidden=true;\n      await refreshPrimary({reason:'edit-sources'});\n      await cleanupXtreamAfterSourceRemoval(previousUrls,urls,'EDIT SOURCES');"
)

print('Phase 5.3 source/worker integration patch applied')
