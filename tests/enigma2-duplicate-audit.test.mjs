import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const owner='src/core/enigma2-core.js';
const proxy='workers/source-hunt-bouquet-proxy.js';

function jsFiles(dir){
  const abs=path.join(root,dir);const out=[];
  for(const entry of fs.readdirSync(abs,{withFileTypes:true})){
    const rel=path.posix.join(dir,entry.name);
    if(entry.isDirectory())out.push(...jsFiles(rel));
    else if(entry.isFile()&&entry.name.endsWith('.js'))out.push(rel);
  }
  return out;
}

const files=[...jsFiles('src'),...jsFiles('workers')];
const violations=[];
for(const rel of files){
  if(rel===owner)continue;
  const source=fs.readFileSync(path.join(root,rel),'utf8');
  const structural=[];
  if(/function\s+extractService\s*\(/.test(source))structural.push('extractService');
  if(/parts\s*\[\s*10\s*\]/.test(source)&&/#SERVICE/.test(source))structural.push('fixed SERVICE field extraction');
  if(/schemeMatch\s*=.*(?:https\?|rtmp\|rtsp)/s.test(source)&&/#SERVICE/.test(source))structural.push('SERVICE embedded-scheme extraction');
  if(/String\([^\n]*text[^\n]*\)[^\n]*split\s*\(\/\\r\?\\n\//.test(source)&&/#SERVICE/.test(source))structural.push('raw bouquet line traversal');
  if(/decodeURIComponent/.test(source)&&/#SERVICE/.test(source)&&rel!==proxy)structural.push('SERVICE percent decoding');
  if(structural.length)violations.push(`${rel}: ${structural.join(', ')}`);
}

assert.deepEqual(violations,[],`independent Enigma2 structural parsing remains outside ${owner}:\n${violations.join('\n')}`);

const discovery=fs.readFileSync(path.join(root,'workers/webtv-source-discovery.js'),'utf8');
const bouquetProxy=fs.readFileSync(path.join(root,proxy),'utf8');
assert.match(discovery,/enigma2-core\.js/,'Discovery consumes canonical Enigma2 structure');
assert.equal(fs.existsSync(path.join(root,'src/source-hunt-enigma2.js')),false,'retired frontend Hunt Enigma2 adapter must remain deleted');
assert.match(bouquetProxy,/#SERVICE\\s\+|#SERVICE/,'bouquet proxy may retain shallow format recognition');
assert.doesNotMatch(bouquetProxy,/parseEnigma2Bouquet|enigma2-core\.js/,'bouquet proxy remains transport/security-only rather than structural-parser-owned');

console.log('Enigma2 duplicate parser audit PASS');
