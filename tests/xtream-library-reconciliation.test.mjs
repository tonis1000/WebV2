import assert from 'node:assert/strict';
import { reconcileXtreamLibraryRows } from '../src/xtream-library-reconciliation.js';

const saved=[
  {id:'normal',name:'Normal M3U',type:'url',url:'https://example.test/list.m3u'},
  {id:'xtpl_xt_saved',name:'Xtream · Saved',type:'xtream',url:'xtream:xt_saved',channelCount:12,groupCount:3},
];
const accounts=[
  {id:'xt_saved',name:'Saved',server:'https://saved.example'},
  {id:'xt_orphan',name:'test',server:'https://orphan.example'},
];

const rows=reconcileXtreamLibraryRows(saved,accounts);
assert.equal(rows.length,3);
assert.equal(rows.filter(row=>row.type==='xtream').length,2);
const preserved=rows.find(row=>row.id==='xtpl_xt_saved');
assert.equal(preserved.recoveredXtreamAccount,false);
assert.equal(preserved.channelCount,12);

const recovered=rows.find(row=>row.url==='xtream:xt_orphan');
assert.ok(recovered,'authorized account without Saved Playlist marker must be surfaced');
assert.equal(recovered.id,'xtpl_xt_orphan');
assert.equal(recovered.type,'xtream');
assert.equal(recovered.name,'Xtream · test');
assert.equal(recovered.recoveredXtreamAccount,true);
assert.equal(recovered.channelCount,0);
assert.equal(recovered.groupCount,0);
assert.equal('username' in recovered,false);
assert.equal('password' in recovered,false);
assert.equal(JSON.stringify(recovered).includes('orphan.example'),false,'recovered card must not expose provider server details');

const noAccounts=reconcileXtreamLibraryRows(saved,[]);
assert.equal(noAccounts.length,2,'normal Saved Playlist rendering must remain intact when no account list is available');

console.log('Xtream Library reconciliation PASS');
