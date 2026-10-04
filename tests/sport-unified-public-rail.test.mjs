import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sportJs=fs.readFileSync(new URL('../src/sport-page.js',import.meta.url),'utf8');
const sportHtml=fs.readFileSync(new URL('../sport.html',import.meta.url),'utf8');
const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
const gateCss=fs.readFileSync(new URL('../admin-gate.css',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(sportHtml,/id="sport-archive-toggle"/,'SPORT page must expose a SportFM archive filter');
assert.match(sportJs,/PRE_START_MINUTES\s*=\s*10/,'green window must begin 10 minutes before start');
assert.match(sportJs,/POST_END_MINUTES\s*=\s*15/,'green window must remain through end +15 minutes');
assert.match(sportJs,/sort\([^)]*startUtc|sortEventsByStart/,'SPORT events must be chronologically sorted');
assert.doesNotMatch(sportJs,/makeProviderSection\(/,'SPORT sidebar must be one unified list, not provider sections');
assert.match(sportJs,/repeatEvents/,'SPORT filter must consume guide broadcasts rather than blocked archive videos');
assert.match(sportJs,/sportfmtv/,'SPORT rows must retain provider identity');

assert.match(gateCss,/html\.admin-locked #sport-toggle,/,'SPORT entry must stay inside the protected rail');
assert.match(index,/right-rail-preview\.js/,'main page must load the desktop/public rail explicitly');
assert.match(rail,/html\.rail-preview\.admin-locked \.desktop-control-rail\{display:none!important\}/,'right rail must be hidden before explicit PIN unlock');
assert.match(rail,/admin-locked[^\n]*#desktop-rail-tools|#desktop-rail-tools/,'locked right rail must keep the public tools area available');

assert.match(main,/loadStartupCloudPlaylist\(\)/,'fresh/return entry must use the resilient startup playlist path');
assert.match(main,/preserveSelection:false/,'fresh/return entry must start with no selected channel');
assert.match(main,/epg\.refresh\(\{channels\}\)/,'EPG must refresh for the whole sidebar without selecting a channel');

console.log('SPORT unified/public rail contract ok');

const nodes=new Map();
const context=vm.createContext({document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{checked:false});return nodes.get(id);}},URL,Intl,Date,console});
vm.runInContext(sportJs.slice(0,sportJs.indexOf('els.refresh?.addEventListener')),context);
const now=Date.parse('2026-10-04T09:00:00Z');
context.data={events:[{id:'live',startUtc:'2026-10-04T10:00:00Z'}],archiveEvents:[{id:'blocked-replay',provider:'sportfmtv',archive:true}],repeatEvents:[{id:'current-repeat',provider:'sportfmtv',broadcastKind:'repeat',startUtc:'2026-10-04T08:00:00Z',endUtc:'2026-10-04T10:00:00Z'},{id:'ended-repeat',provider:'sportfmtv',broadcastKind:'repeat',startUtc:'2026-10-04T06:00:00Z',endUtc:'2026-10-04T08:00:00Z'}]};
context.now=now;
assert.deepEqual(Array.from(vm.runInContext('visibleEvents(data,now)',context),e=>e.id),['live']);
nodes.get('sport-archive-toggle').checked=true;
assert.deepEqual(Array.from(vm.runInContext('visibleEvents(data,now)',context),e=>e.id),['current-repeat','live'],'filter adds only presently airing repeat broadcasts, never stale archive videos');
context.now=Date.parse('2026-10-04T10:00:00Z');
assert.deepEqual(Array.from(vm.runInContext('visibleEvents(data,now)',context),e=>e.id),['live'],'repeat disappears at its actual end');

// Exercise the rendered boundary timer, rather than only the filtering helper.
let clock=Date.parse('2026-10-04T09:59:59Z');
let pending=null;
class ClockDate extends Date{static now(){return clock;}}
function node(){return{children:[],dataset:{},scrollTop:31,checked:false,classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},append(...children){this.children.push(...children);},appendChild(child){this.children.push(child);},replaceChildren(){this.children=[];}};}
const dom=new Map();
const runtime=vm.createContext({document:{getElementById(id){if(!dom.has(id))dom.set(id,node());return dom.get(id);},createElement:node,querySelectorAll(){return[];}},URL,Intl,Date:ClockDate,console,setTimeout(fn,delay){pending={fn,delay};return 1;},clearTimeout(){pending=null;}});
vm.runInContext(sportJs.slice(0,sportJs.indexOf('els.refresh?.addEventListener')),runtime);
dom.get('sport-archive-toggle').checked=true;
runtime.data={events:[],repeatEvents:[{title:'Ends now',provider:'sportfmtv',broadcastKind:'repeat',startUtc:'2026-10-04T08:00:00Z',endUtc:'2026-10-04T10:00:00Z',links:[{url:'https://www.sportfmtv.gr/el/media-video/sport-fm-linear-channel-1'}]}]};
vm.runInContext('renderSchedule(data)',runtime);
assert.equal(dom.get('sport-match-list').children.length,1);
assert.equal(pending.delay,1010,'render schedules one timer at the next official boundary');
assert.equal(dom.get('sport-match-list').scrollTop,31);
const expiry=pending.fn;clock+=1010;expiry();
assert.equal(dom.get('sport-match-list').children.length,0,'expired repeat is removed from the actual rendered list');
assert.equal(pending,null,'expired schedule must not spin timers');
runtime.expired=runtime.data.repeatEvents[0];
vm.runInContext('playLink(expired,expired.links[0],{})',runtime);
assert.equal(dom.get('sport-frame').src,undefined,'late clicks cannot navigate to expired repeats');
