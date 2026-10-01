import assert from 'node:assert/strict';
import { XTREAM_PAGE_SIZE, filterXtreamChannels, pageXtreamChannels, summarizeXtreamGroups } from '../src/xtream-catalog-view.js';

assert.equal(XTREAM_PAGE_SIZE,100);
const make=n=>Array.from({length:n},(_,i)=>({streamId:String(i+1),name:`Channel ${String(i+1).padStart(4,'0')}`,group:`Group ${i%10}`,categoryId:String(i%10),tvgId:`test.${i+1}`}));
for(const size of [50,500,5000]){
  const rows=make(size);
  assert.equal(pageXtreamChannels(rows,0).length,Math.min(size,100));
  assert.ok(pageXtreamChannels(rows,1).length<=100);
  const filtered=filterXtreamChannels(rows,{group:'Group 3',query:'Channel'});
  assert.ok(filtered.every(row=>row.group==='Group 3'));
  assert.deepEqual(pageXtreamChannels(rows,0),filtered.length===size?rows.slice(0,100):pageXtreamChannels(rows,0), 'paging must be deterministic for unchanged input');
  const groups=summarizeXtreamGroups(rows);
  assert.equal(groups.length,10);
  assert.equal(groups.reduce((n,row)=>n+row.count,0),size);
}
const rows=make(5000);
assert.deepEqual(filterXtreamChannels(rows,{query:'channel 0042'}).map(row=>row.streamId),['42']);
assert.equal(pageXtreamChannels(rows,999).length,0);
console.log('Xtream catalog bounded view PASS');
