import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium,firefox} from 'playwright';

const root=path.resolve('.');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(4187,'127.0.0.1',resolve));
const target=process.env.WEBV2_TARGET_URL||'http://127.0.0.1:4187/';
fs.mkdirSync('browser-evidence',{recursive:true});
try{
 for(const [name,engine] of [['chromium',chromium],['firefox',firefox]]){
  const browser=await engine.launch({headless:true});
  try{
   const context=await browser.newContext({viewport:{width:1440,height:900}});
   const page=await context.newPage();
   const errors=[];const requests={playlist:0,epg:0};
   page.on('pageerror',error=>errors.push(error.message));
   page.on('request',request=>{const u=new URL(request.url());if(u.pathname==='/api/my-playlist')requests.playlist++;if(u.pathname==='/epg.xml')requests.epg++;});
   await page.addInitScript(()=>{
    const Native=MutationObserver;
    window.railProbe={callbacks:0,records:0};
    window.MutationObserver=class extends Native{
     constructor(callback){super((records,observer)=>{window.railProbe.callbacks++;window.railProbe.records+=records.length;callback(records,observer);});}
    };
   });
   await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>window.WebTVPlaylistAPI?.ready&&window.WebTVPlaylistAPI.getCount()>0,null,{timeout:45000});
   await page.waitForFunction(()=>[...document.querySelectorAll('.channel-now-title')].some(n=>n.textContent.trim()),null,{timeout:60000});
   const inspect=()=>page.evaluate(()=>({
    ...window.railProbe,rails:document.querySelectorAll('#desktop-control-rail').length,
    channels:window.WebTVPlaylistAPI.getCount(),rows:document.querySelectorAll('#channel-list .channel-item').length,
    selected:window.WebTVPlaylistAPI.getSelectedChannel(),
    epgRows:[...document.querySelectorAll('.channel-now-title')].filter(n=>n.textContent.trim()).length,
    railHidden:getComputedStyle(document.getElementById('desktop-control-rail')).display==='none',
    sportHidden:getComputedStyle(document.getElementById('sport-toggle')).display==='none',
    brandDock:document.getElementById('admin-unlock-trigger').parentElement.parentElement.id,
    topbarStable:document.querySelector('.topbar-actions').parentElement.classList.contains('topbar')
   }));
   const startup=await inspect();
   assert.equal(startup.rails,1);assert.equal(startup.rows,startup.channels);assert.equal(startup.selected,null);
   assert(startup.railHidden&&startup.sportHidden&&startup.topbarStable);assert.equal(startup.brandDock,'player-header-admin');
   await page.screenshot({path:`browser-evidence/${name}-locked.png`,fullPage:true});
   await page.waitForTimeout(6000);
   const idle=await inspect();assert(idle.callbacks-startup.callbacks<50,'idle DOM deliveries must remain bounded');
   assert(requests.playlist<=12&&requests.epg<=6,'startup reads must be bounded');
   for(const width of [1000,2560,780,1440]){
    await page.setViewportSize({width,height:900});await page.waitForTimeout(250);
    assert.equal(await page.locator('#desktop-control-rail').count(),width<900?0:1);
    assert.equal(await page.locator('.topbar-actions').evaluate(n=>n.parentElement.classList.contains('topbar')),true);
   }
   // Controlled auth-boundary integration. These responses grant no D1 write
   // access: test UI restoration only; real public startup above is unmocked.
   await page.route('**/api/login',route=>route.fulfill({json:{token:'rail-test-no-write-authority',days:1}}));
   await page.route('**/api/session',route=>route.fulfill({json:{ok:true}}));
   page.on('dialog',dialog=>dialog.type()==='prompt'?dialog.accept('123456'):dialog.dismiss());
   await page.locator('#admin-unlock-trigger').click();
   await page.waitForFunction(()=>document.documentElement.classList.contains('admin-unlocked'));
   assert(await page.locator('#sport-toggle').isVisible());
   assert.equal(await page.locator('#sport-toggle').evaluate(n=>n.parentElement.id),'desktop-rail-tools');
   await page.screenshot({path:`browser-evidence/${name}-unlocked-controlled-auth.png`,fullPage:true});
   await page.locator('#sport-toggle').click();await page.waitForURL('**/sport.html');
   await page.locator('.back-link').click();await page.waitForURL('**/index.html?from=sport');
   await page.waitForFunction(()=>document.documentElement.classList.contains('admin-unlocked')&&window.WebTVPlaylistAPI?.ready,null,{timeout:45000});
   assert(await page.locator('#sport-toggle').isVisible());
   assert.equal(await page.evaluate(()=>window.WebTVPlaylistAPI.getSelectedChannel()),null);
   await page.locator('#admin-unlock-trigger').click();assert(!(await page.locator('#sport-toggle').isVisible()));
   await page.reload({waitUntil:'domcontentloaded'});
   assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('admin-locked')),true);
   assert.deepEqual(errors,[],'whole page must have no uncaught runtime exceptions');
   const evidence={engine:name,target,publicStartup:'UNMOCKED',sportReturn:'CONTROLLED_AUTH_BOUNDARY',startup,idle,requests,errors};
   fs.writeFileSync(`browser-evidence/${name}.json`,JSON.stringify(evidence,null,2));
   console.log('FULL_PAGE_BROWSER_PASS',JSON.stringify(evidence));
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
