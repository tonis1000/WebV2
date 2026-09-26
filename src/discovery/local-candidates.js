import { parseM3U } from '../core/channel-catalog.js';
import { createCandidate, normalizeChannelName } from './candidate-model.js';

function identityKeys(channel={}) {
  return [...new Set([
    channel.id,
    channel.originalId,
    channel.tvgId,
    channel.name,
  ].map(normalizeChannelName).filter(Boolean))];
}

export function matchesSelectedChannel(selected={}, candidate={}) {
  const wanted=new Set(identityKeys(selected));
  if (!wanted.size) return false;
  return identityKeys(candidate).some(key=>wanted.has(key));
}

function candidatesFromUrls(selected, urls, meta={}) {
  const out=[];
  for (const sourceUrl of [...new Set((urls||[]).map(v=>String(v||'').trim()).filter(Boolean))]) {
    out.push(createCandidate({
      channelName:selected.name||selected.originalId||selected.id||'',
      sourceUrl,
      sourceOrigin:meta.sourceOrigin||'Local source',
      discoveryProvider:meta.discoveryProvider||'local',
      verificationStatus:'UNVERIFIED',
      matchConfidence:'HIGH',
    }));
  }
  return out;
}

export function candidatesFromMyPlaylist(selected={}, channels=[]) {
  const out=[];
  for (const channel of channels||[]) {
    if (!matchesSelectedChannel(selected,channel)) continue;
    out.push(...candidatesFromUrls(selected,channel.directUrls||[],{
      sourceOrigin:'My Playlist · D1 snapshot',
      discoveryProvider:'local-my-playlist',
    }));
  }
  return out;
}

export function candidatesFromSavedPlaylists(selected={}, playlists=[]) {
  const out=[];
  for (const playlist of playlists||[]) {
    const channels=parseM3U(playlist?.text||'');
    for (const channel of channels) {
      if (!matchesSelectedChannel(selected,channel)) continue;
      out.push(...candidatesFromUrls(selected,channel.directUrls||[],{
        sourceOrigin:`Saved Playlist · ${playlist?.name||playlist?.id||'Unnamed'}`,
        discoveryProvider:'local-saved-playlist',
      }));
    }
  }
  return out;
}

export function candidatesFromLoadedXtream(selected={}, loaded=null) {
  if (!loaded?.account || !Array.isArray(loaded.channels)) return [];
  const account=loaded.account||{};
  const out=[];
  for (const channel of loaded.channels) {
    if (!matchesSelectedChannel(selected,channel)) continue;
    const streamId=String(channel.streamId||'').trim();
    const playbackUrl=String(channel.playbackUrl||'').trim();
    if (!streamId || !playbackUrl) continue;
    out.push(createCandidate({
      channelName:selected.name||selected.originalId||selected.id||'',
      sourceType:'xtream',
      sourceUrl:playbackUrl,
      sourceOrigin:`Xtream · ${account.name||account.server||account.id||'Loaded account'}`,
      discoveryProvider:'local-xtream-loaded',
      verificationStatus:'UNVERIFIED',
      matchConfidence:'HIGH',
      xtreamContext:{
        server:String(account.server||''),
        username:'',
        password:'',
        streamId,
        accountRef:String(account.id||''),
      },
    }));
  }
  return out;
}

export function dedupeLocalCandidates(candidates=[]) {
  const seen=new Map();
  const out=[];
  for (const candidate of candidates||[]) {
    const key=[candidate.sourceType,candidate.sourceUrl,candidate.xtreamAccountRef,candidate.xtreamStreamId].join('|');
    if (seen.has(key)) continue;
    seen.set(key,candidate.candidateId);
    out.push(candidate);
  }
  return out;
}

export function collectLocalCandidates(selected={}, context={}) {
  const myPlaylist=candidatesFromMyPlaylist(selected,context.myPlaylistChannels||[]);
  const savedPlaylists=candidatesFromSavedPlaylists(selected,context.savedPlaylists||[]);
  const xtream=candidatesFromLoadedXtream(selected,context.loadedXtream||null);
  const candidates=dedupeLocalCandidates([...myPlaylist,...savedPlaylists,...xtream]);
  return {
    candidates,
    lanes:Object.freeze({
      myPlaylist:myPlaylist.length,
      savedPlaylists:savedPlaylists.length,
      xtream:xtream.length,
      total:candidates.length,
    }),
  };
}
