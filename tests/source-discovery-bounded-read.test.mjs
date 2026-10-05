import assert from 'node:assert/strict';
import { readTextBounded } from '../workers/webtv-source-discovery.js';

const encoder=new TextEncoder();
let pulls=0;
let cancelled=false;
const stream=new ReadableStream({
  pull(controller){
    pulls++;
    controller.enqueue(encoder.encode('x'.repeat(1024)));
    if(pulls>20)controller.close();
  },
  cancel(){cancelled=true;}
});
const response=new Response(stream,{status:200,headers:{'content-type':'text/plain'}});
const text=await readTextBounded(response,4096);
assert.ok(text.length<=4096,'bounded reader must never return more than maxBytes');
assert.ok(pulls<=5,'bounded reader must stop consuming once the byte budget is reached');
assert.equal(cancelled,true,'bounded reader should cancel the remaining body after reaching the byte limit');
console.log('Source Discovery bounded response reader PASS');
