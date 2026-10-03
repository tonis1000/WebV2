import assert from 'node:assert/strict';
import { parseProgramText, extractFoothubOrigins, toUtcIsoFromAthens } from '../workers/webtv-sport.js';

const sample=`ΠΡΟΓΡΑΜΜΑ ΚΥΡΙΑΚΗ 23/8/2026
16:00 Μπράιτον - Άστον Βίλα / 21:00 ΠΑΟΚ - Λεβαδειακός https://foothublive.top/cdn3/linka.php η https://foothublive.top/cast/5/link1.php η https://foothublive.top/cast/2/link1.php`;

const parsed=parseProgramText(sample,'https://foothubhd.st');
assert.equal(parsed.events.length,2);
assert.equal(parsed.events[0].title,'Μπράιτον - Άστον Βίλα');
assert.equal(parsed.events[1].title,'ΠΑΟΚ - Λεβαδειακός');
assert.equal(parsed.events[0].links.length,3);
assert.equal(parsed.events[0].links[0].label,'Link 1');
assert.match(parsed.events[0].startUtc,/Z$/);

const origins=extractFoothubOrigins('new home foothub.online and https://foothublive.top/x');
assert.ok(origins.includes('https://foothub.online'));
assert.ok(origins.includes('https://foothublive.top'));

assert.equal(typeof toUtcIsoFromAthens(2026,8,23,16,0),'string');

console.log('sport feed worker contract ok');


const homepage=`<h5><span class="event-time">19:00</span> Κόσοβο - Αυστρία</h5>
<h5><span class="event-time">21:45</span> Ελλάδα - Γερμανία</h5>
<a class="btn" data-url="/cdn3/linka.php" href="javascript:void(0)">Link #1</a>
<a class="btn" data-url="/cast/1/link1.php" href="javascript:void(0)">Link #2</a>
<h5><span class="event-time">16:00</span> Αζερμπαϊτζάν - Λιθουανία</h5>
<a class="btn" data-url="/cdn3/linkb.php" href="javascript:void(0)">Link #1</a>
<a class="btn" data-url="/cast/1/link2.php" href="javascript:void(0)">Link #2</a>`;

const homeParsed=(await import('../workers/webtv-sport.js')).parseHomepageHtml(homepage,'https://foothubhd.st');
assert.equal(homeParsed.events.length,3);
assert.equal(homeParsed.events[0].links[0].url,'https://foothubhd.st/cdn3/linka.php');
assert.equal(homeParsed.events[1].links[1].url,'https://foothubhd.st/cast/1/link1.php');
assert.equal(homeParsed.events[2].links[0].url,'https://foothubhd.st/cdn3/linkb.php');
