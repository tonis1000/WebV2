import assert from 'node:assert/strict';
import { buildSearchContext, listSearchGroups } from '../src/search/search-group-catalog.js';
import { resolveSearchIntent } from '../src/search/search-intent.js';

const groups=listSearchGroups();
for(const id of ['ert','ant1','nova','cosmote','cosmote-sport'])assert.ok(groups.some(group=>group.id===id),`${id} search family must exist`);

const context=buildSearchContext([{id:'mega',name:'MEGA'}]);
assert.ok(context.channels.some(channel=>channel.id==='mega'),'real playlist channels must remain in context');

const ert=resolveSearchIntent('ERT',context);
assert.equal(ert.type,'group');
assert.ok(ert.targets.some(target=>target.id==='ert1'));
assert.ok(ert.targets.some(target=>target.id==='ertnews'));

const ant1=resolveSearchIntent('ANT1',context);
assert.equal(ant1.type,'group');
assert.ok(ant1.targets.some(target=>target.name==='ANT1'));
assert.ok(ant1.targets.some(target=>/ANT1 Comedy/i.test(target.name)));

const nova=resolveSearchIntent('Nova',context);
assert.equal(nova.type,'group');
assert.deepEqual(nova.targets.map(target=>target.name),['Nova']);
assert.equal(nova.targets[0].familyQuery,true);

const cosmote=resolveSearchIntent('Cosmote',context);
assert.equal(cosmote.type,'group');
assert.deepEqual(cosmote.targets.map(target=>target.name),['Cosmote']);
assert.equal(cosmote.targets[0].familyQuery,true);

const sport=resolveSearchIntent('COSMOTE SPORT',context);
assert.equal(sport.type,'subgroup');
assert.deepEqual(sport.targets.map(target=>target.name),['Cosmote Sport']);
assert.equal(sport.targets[0].familyQuery,true);

console.log('identity-safe unified search group catalog PASS');
