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
