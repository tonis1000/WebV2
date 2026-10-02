import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SRC=path.join(ROOT,'src');
const LEGACY=path.join(SRC,'source-hunt-oneclick.js');

function walk(dir){
  const out=[];
  for(const name of readdirSync(dir)){
    const full=path.join(dir,name);
    const stat=statSync(full);
    if(stat.isDirectory())out.push(...walk(full));
    else if(full.endsWith('.js'))out.push(full);
  }
  return out;
}

const consumers=[];
for(const file of walk(SRC)){
  if(file===LEGACY)continue;
  const source=readFileSync(file,'utf8');
  if(source.includes('source-hunt-oneclick'))consumers.push(path.relative(ROOT,file));
}
assert.deepEqual(consumers,[],'retired source-hunt-oneclick must have zero src consumers before deletion');

const index=readFileSync(path.join(ROOT,'index.html'),'utf8');
assert.doesNotMatch(index,/source-hunt-oneclick\.js/,'retired One-click must not be a production entrypoint');

assert.equal(
  existsSync(LEGACY),
  false,
  'retired source-hunt-oneclick playback/fallback orchestration owner must be deleted after zero-consumer proof'
);

const main=readFileSync(path.join(ROOT,'src/main.js'),'utf8');
const player=readFileSync(path.join(ROOT,'src/core/player.js'),'utf8');
assert.equal((main.match(/new\s+PlayerController\s*\(/g)||[]).length,1,'main.js must instantiate exactly one PlayerController');
assert.equal((main.match(/window\.WebTVPlaybackAPI\s*=/g)||[]).length,1,'main.js must expose exactly one playback bridge');
assert.match(main,/testCandidate[\s\S]*player\.play\(/,'candidate playback must delegate to the canonical PlayerController');
assert.match(main,/replaySelected:\(\)=>selected\?selectChannel\(selected\)/,'replay must delegate to canonical selected-channel playback');
assert.match(player,/async play\(/,'PlayerController remains the playback attempt owner');
assert.match(player,/#playOfficialFallback\(/,'PlayerController remains official fallback owner');

console.log('Player ownership retirement PASS');
