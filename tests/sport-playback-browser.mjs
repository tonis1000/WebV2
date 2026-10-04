import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium,firefox} from 'playwright';
import worker from '../workers/webtv-sport.js';

const target=process.env.WEBV2_TARGET_URL||'http://127.0.0.1:4188/sport.html';
const local=!process.env.WEBV2_TARGET_URL;
const root=path.resolve('.');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
if(local)await new Promise(resolve=>server.listen(4188,'127.0.0.1',resolve));
fs.mkdirSync('browser-evidence',{recursive:true});
// PR: run the candidate Worker against the real public provider catalog.
// Production: leave the deployed feed entirely unmocked.
const candidate=local?await (await worker.fetch(new Request('https://test.local/api/schedule'))).json():null;
if(candidate)assert.equal(candidate.providers.sportfmtv.source,'sportfmtv-official-catalog');
async function mediaSnapshot(page){
 const result=[];
 for(const frame of page.frames().slice(1)){
  try{result.push(...await frame.evaluate(()=>[...document.querySelectorAll('video')].map(v=>({time:v.currentTime,paused:v.paused,ready:v.readyState,width:v.videoWidth,height:v.videoHeight,muted:v.muted,volume:v.volume,error:v.error?.code||null,frames:v.getVideoPlaybackQuality?.().totalVideoFrames||0}))));}catch{}
 }
 return result;
}
try{
 for(const [name,engine] of [['chromium',chromium],['firefox',firefox]]){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1440,height:1000}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   if(local)await page.route('https://webtv-sport.atonis.workers.dev/api/schedule*',r=>r.fulfill({json:candidate}));
   const responsePromise=page.waitForResponse(r=>r.url().includes('/api/schedule'));
   await page.goto(target,{waitUntil:'domcontentloaded'});
   const data=await (await responsePromise).json();
   if(process.env.EXPECTED_SHA)assert.equal(data.deploySha,process.env.EXPECTED_SHA);
   assert.equal(data.providers.sportfmtv.source,'sportfmtv-official-catalog');
   await page.waitForFunction(()=>document.getElementById('sport-status').dataset.tone==='ok',{},{timeout:65000});
   const cards=page.locator('.sport-match-card');
   assert.equal(await cards.count(),data.events.length);
   assert.equal(await page.locator('#sport-frame').getAttribute('src'),null);
   await page.locator('#sport-archive-toggle').check();
   const now=Date.now();
   const repeats=data.repeatEvents.filter(e=>Date.parse(e.startUtc)<=now&&now<Date.parse(e.endUtc));
   assert.equal(await cards.count(),data.events.length+repeats.length);
   const currentLive=data.events.find(e=>e.provider==='sportfmtv'&&Date.parse(e.startUtc)<=now&&now<Date.parse(e.endUtc));
   const selected=repeats[0]||currentLive;
   const evidence={engine:name,target,feed:local?'REAL_UPSTREAM_CANDIDATE':'UNMOCKED_PRODUCTION',liveCount:data.events.filter(e=>e.provider==='sportfmtv').length,repeatsNow:repeats.map(e=>e.title),playback:'NO_CURRENT_BROADCAST',errors};
   if(selected){
    const card=cards.filter({has:page.locator('.sport-match-title',{hasText:selected.title})}).first();
    await card.locator('button').first().click();
    assert.equal(await page.locator('#sport-frame').getAttribute('src'),selected.links[0].url);
    // Normal user interaction with provider controls only; no stream extraction or bypass.
    await page.waitForTimeout(12000);
    for(const frame of page.frames().slice(1)){
     for(const label of [/accept all/i,/αποδοχή όλων/i,/play/i,/αναπαραγωγή/i]){
      try{const b=frame.getByRole('button',{name:label}).first();if(await b.isVisible())await b.click({timeout:1500});}catch{}
     }
     try{const video=frame.locator('video').first();if(await video.isVisible())await video.click({timeout:1500});}catch{}
    }
    const before=await mediaSnapshot(page);await page.waitForTimeout(8000);const after=await mediaSnapshot(page);
    evidence.selected={title:selected.title,kind:selected.broadcastKind,url:selected.links[0].url};
    evidence.before=before;evidence.after=after;
    evidence.playback=after.some((v,i)=>!v.paused&&v.ready>=2&&v.width>0&&v.time>(before[i]?.time||0)+1)?'VIDEO_ADVANCING':'PLAYBACK_UNCONFIRMED';
    await page.screenshot({path:`browser-evidence/sport-${name}-playback.png`,fullPage:true});
    await page.locator('#sport-archive-toggle').uncheck();
    assert.equal(await page.locator('#sport-frame').getAttribute('src'),selected.links[0].url,'filter changes must preserve selected playback');
    assert.equal(await page.locator('#sport-frame').count(),1);
   }
   assert.deepEqual(errors,[],'SPORT page must have no uncaught exceptions');
   fs.writeFileSync(`browser-evidence/sport-${name}.json`,JSON.stringify(evidence,null,2));
   console.log('SPORT_BROWSER_ROUTE_PASS',JSON.stringify(evidence));
  }finally{await browser.close();}
 }
}finally{if(local)await new Promise(resolve=>server.close(resolve));}
