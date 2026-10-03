import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const ignored=new Set(['.git','node_modules']);
const found=[];

function walk(dir,relative=''){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(ignored.has(entry.name))continue;
    const rel=relative?path.posix.join(relative,entry.name):entry.name;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full,rel);
    else if(entry.isFile()&&entry.name.toLowerCase().endsWith('.md'))found.push(rel);
  }
}
walk(root);
found.sort();
assert.deepEqual(found,['README.md'],'GitHub public Markdown surface must remain README.md only; Project Brain/history belongs in private Drive');
console.log('public Markdown surface guard: PASS');
