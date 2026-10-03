import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SRC=path.join(ROOT,'src');

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

const files=walk(SRC).map(file=>({
  file:path.relative(ROOT,file),
  source:readFileSync(file,'utf8'),
}));

const refreshOwners=files
  .filter(({source})=>source.includes('epg.refresh('))
  .map(({file})=>file);

assert.deepEqual(
  refreshOwners,
  ['src/main.js'],
  'main.js must be the only frontend owner that schedules EPG refresh/fetch'
);

const xmltvParsers=files
  .filter(({source})=>source.includes("DOMParser().parseFromString(xmlText, 'application/xml')"))
  .map(({file})=>file);

assert.deepEqual(
  xmltvParsers,
  ['src/core/epg.js'],
  'core/epg.js must remain the only frontend XMLTV parser owner'
);

const epgUrlOwners=files
  .filter(({source})=>source.includes('CONFIG.epgUrl')||source.includes('CONFIG.epgFallbackUrl'))
  .map(({file})=>file);

assert.deepEqual(
  epgUrlOwners,
  ['src/core/epg.js'],
  'core/epg.js must remain the only frontend EPG feed URL consumer'
);

const sidebar=readFileSync(path.join(ROOT,'src/sidebar-now.js'),'utf8');
assert.doesNotMatch(sidebar,/\brefresh\s*\(/,'Sidebar Now Playing must not own an EPG refresh function');
assert.doesNotMatch(sidebar,/CONFIG\.epgRefreshMs/,'Sidebar Now Playing must not schedule EPG refresh');
assert.match(sidebar,/epg\.get\(channel\)/,'Sidebar Now Playing should remain a read-only EPG presentation consumer');
assert.match(sidebar,/webtv:epg-updated/,'Sidebar Now Playing should render from the canonical EPG update event');

const main=readFileSync(path.join(ROOT,'src/main.js'),'utf8');
assert.match(main,/const epgTask=epg\.refresh\(\{channels\}\)/,'main.js must own initial sidebar-scoped EPG refresh');
assert.match(main,/setInterval\(\(\)=>epg\.refresh\(\{channels\}\)\.then\(renderEpg\)/,'main.js must own periodic sidebar-scoped EPG refresh scheduling');

console.log('EPG refresh ownership PASS');
