import assert from 'node:assert/strict';
import { resolveSearchIntent } from '../src/search/search-intent.js';

const context = {
  channels: [
    { id:'ert1', name:'ERT1' },
    { id:'ert2', name:'ERT2' },
    { id:'ert3', name:'ERT3' },
    { id:'ertnews', name:'ERT News' },
    { id:'cosmote-sport-1', name:'Cosmote Sport 1' },
    { id:'cosmote-sport-2', name:'Cosmote Sport 2' },
  ],
  groups: [
    { id:'ert', type:'group', label:'ERT', aliases:['ERT','ΕΡΤ'], members:['ert1','ert2','ert3','ertnews'] },
    { id:'cosmote-sport', type:'subgroup', label:'Cosmote Sport', aliases:['COSMOTE SPORT','COSMOTE SPORTS'], members:['cosmote-sport-1','cosmote-sport-2'] },
  ],
};

const channel = resolveSearchIntent('ERT1', context);
assert.equal(channel.type, 'channel');
assert.equal(channel.query, 'ERT1');
assert.deepEqual(channel.targets.map(item => item.id), ['ert1']);

const group = resolveSearchIntent('ERT', context);
assert.equal(group.type, 'group');
assert.deepEqual(group.targets.map(item => item.id), ['ert1','ert2','ert3','ertnews']);

const subgroup = resolveSearchIntent('COSMOTE SPORT', context);
assert.equal(subgroup.type, 'subgroup');
assert.deepEqual(subgroup.targets.map(item => item.id), ['cosmote-sport-1','cosmote-sport-2']);

const free = resolveSearchIntent('some unknown station', context);
assert.equal(free.type, 'free-text');
assert.equal(free.query, 'some unknown station');
assert.deepEqual(free.targets, []);

const ambiguous = resolveSearchIntent('ERT S', context);
assert.equal(ambiguous.type, 'free-text', 'substring-only evidence must not invent a known group');

console.log('unified search intent contract PASS');
