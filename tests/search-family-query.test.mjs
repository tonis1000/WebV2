import assert from 'node:assert/strict';
import { buildSearchContext } from '../src/search/search-group-catalog.js';
import { resolveSearchIntent } from '../src/search/search-intent.js';
import { discoverCuratedRemoteFeeds } from '../src/discovery/external-discovery-client.js';
import { parseM3u, parseEnigma2 } from '../workers/webtv-source-discovery.js';
import { matchesAuthorizedXtreamChannel, discoverAuthorizedXtream } from '../src/discovery/authorized-xtream.js';

const context=buildSearchContext([{id:'mega',name:'MEGA'}]);
const novaIntent=resolveSearchIntent('Nova',context);
assert.equal(novaIntent.type,'group');
assert.equal(novaIntent.targets.length,1);
const nova=novaIntent.targets[0];
assert.equal(nova.familyQuery,true);
assert.ok(Array.isArray(nova.familyAliases)&&nova.familyAliases.includes('novasports'));

let posted=null;
await discoverCuratedRemoteFeeds(nova,{
  fetchImpl:async(_url,options)=>{
    posted=JSON.parse(options.body);
    return {ok:true,json:async()=>({provider:'curated-remote-feeds',candidates:[],reports:[]})};
  },
});
assert.equal(posted.channel.familyQuery,true,'familyQuery must reach Source Discovery Worker');
assert.ok(posted.channel.familyAliases.includes('novasports'),'family aliases must reach Source Discovery Worker');

const m3u=`#EXTM3U\n#EXTINF:-1 tvg-name="Novasports1HD",Novasports1HD\nhttps://stream.test/ns1.m3u8\n#EXTINF:-1 tvg-name="Nova Cinema",Nova Cinema\nhttps://stream.test/nc.m3u8\n#EXTINF:-1 tvg-name="Innovation TV",Innovation TV\nhttps://stream.test/no.m3u8\n`;
const m3uFound=parseM3u(m3u,nova,{name:'fixture',format:'m3u'});
assert.deepEqual(m3uFound.map(item=>item.channelName).sort(),['Nova Cinema','Novasports1HD'].sort(),'family M3U search must return real child channel names only');

const bouquet=`#NAME NOVA\n#SERVICE 4097:0:1:0:0:0:0:0:0:0:https%3A%2F%2Fstream.test%2Fns2.m3u8:Novasports2HD\n#DESCRIPTION Novasports2HD\n#SERVICE 4097:0:1:0:0:0:0:0:0:0:https%3A%2F%2Fstream.test%2Fother.m3u8:Other TV\n#DESCRIPTION Other TV\n`;
const e2Found=parseEnigma2(bouquet,nova,{name:'fixture',format:'enigma2'});
assert.deepEqual(e2Found.map(item=>item.channelName),['Novasports2HD'],'family Enigma2 search must return the real child channel name');

assert.equal(matchesAuthorizedXtreamChannel(nova,{name:'Novasports Prime'}),true);
assert.equal(matchesAuthorizedXtreamChannel(nova,{name:'Innovation TV'}),false);
const xtream=await discoverAuthorizedXtream(nova,{
  listAccounts:async()=>[{id:'a1',name:'Authorized'}],
  loadChannels:async()=>({channels:[
    {name:'Novasports Prime',streamId:'1',playbackUrl:'https://xtream.test/1.m3u8'},
    {name:'Innovation TV',streamId:'2',playbackUrl:'https://xtream.test/2.m3u8'},
  ]}),
});
assert.deepEqual(xtream.candidates.map(item=>item.channelName),['Novasports Prime'],'family Xtream search must preserve actual matched channel name');

const exact={id:'ert1',name:'ERT1'};
assert.equal(matchesAuthorizedXtreamChannel(exact,{name:'ERT2'}),false,'exact Xtream matching must remain exact');

console.log('Unified Search family group query contract PASS');
