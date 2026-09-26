import assert from 'node:assert/strict';
import { candidateForDisplay } from '../src/discovery/candidate-model.js';
import {
  matchesSelectedChannel,
  candidatesFromMyPlaylist,
  candidatesFromSavedPlaylists,
  candidatesFromLoadedXtream,
  collectLocalCandidates,
} from '../src/discovery/local-candidates.js';

const selected={id:'mega',originalId:'MEGA',name:'MEGA',group:'General'};
assert.equal(matchesSelectedChannel(selected,{name:'MEGA'}),true);
assert.equal(matchesSelectedChannel(selected,{name:'MEGA News'}),false);

const myPlaylist=[
  {id:'mega',name:'MEGA',directUrls:['https://local.test/mega.m3u8']},
  {id:'skai',name:'SKAI',directUrls:['https://local.test/skai.m3u8']},
];
const myCandidates=candidatesFromMyPlaylist(selected,myPlaylist);
assert.equal(myCandidates.length,1);
assert.equal(myCandidates[0].sourceType,'hls');
assert.equal(myCandidates[0].discoveryProvider,'local-my-playlist');
assert.equal(myCandidates[0].verificationStatus,'UNVERIFIED');

const savedPlaylists=[{
  id:'saved-1',
  name:'Greek backup',
  text:'#EXTM3U\n#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA",MEGA\nhttps://backup.test/mega.mpd\n#EXTINF:-1 tvg-id="SKAI" tvg-name="SKAI",SKAI\nhttps://backup.test/skai.m3u8\n',
}];
const savedCandidates=candidatesFromSavedPlaylists(selected,savedPlaylists);
assert.equal(savedCandidates.length,1);
assert.equal(savedCandidates[0].sourceType,'dash');
assert.match(savedCandidates[0].sourceOrigin,/Greek backup/);

const loadedXtream={
  account:{id:'xt-1',name:'Provider A',server:'https://provider.test'},
  channels:[
    {id:'xtream:xt-1:42',streamId:'42',tvgId:'MEGA',name:'MEGA',playbackUrl:'https://webtv-xtream.test/stream/xt-1/42.m3u8?s=signed'},
    {id:'xtream:xt-1:43',streamId:'43',tvgId:'SKAI',name:'SKAI',playbackUrl:'https://webtv-xtream.test/stream/xt-1/43.m3u8?s=signed'},
  ],
};
const xtreamCandidates=candidatesFromLoadedXtream(selected,loadedXtream);
assert.equal(xtreamCandidates.length,1);
assert.equal(xtreamCandidates[0].sourceType,'xtream');
assert.equal(xtreamCandidates[0].xtreamAccountRef,'xt-1');
assert.equal(xtreamCandidates[0].xtreamStreamId,'42');
assert.equal(xtreamCandidates[0].xtreamContext.password,'');
assert.equal(candidateForDisplay(xtreamCandidates[0]).sourceUrl,'[redacted Xtream source]');

const result=collectLocalCandidates(selected,{myPlaylistChannels:myPlaylist,savedPlaylists,loadedXtream});
assert.equal(result.candidates.length,3);
assert.deepEqual(result.lanes,{myPlaylist:1,savedPlaylists:1,xtream:1,total:3});
assert.equal(result.candidates.every(item=>item.verified===false),true);
console.log('discovery local source tests PASS');
