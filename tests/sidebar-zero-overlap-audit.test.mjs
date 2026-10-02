import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../src/',import.meta.url));
function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(full));
    else if(entry.isFile()&&entry.name.endsWith('.js'))out.push(full);
  }
  return out;
}
const files=walk(root).sort();
const repoRoot=fileURLToPath(new URL('..',import.meta.url));
const rel=file=>path.relative(repoRoot,file).replaceAll(path.sep,'/');
const contents=new Map(files.map(file=>[rel(file),fs.readFileSync(file,'utf8')]));

const channelListRefs=[...contents]
  .filter(([,source])=>/channel-list/.test(source))
  .map(([file])=>file)
  .sort();

assert.deepEqual(
  channelListRefs,
  ['src/main.js','src/sidebar-now.js'],
  `Only main.js and sidebar-now.js may directly bind #channel-list; found: ${channelListRefs.join(', ')}`
);

const main=contents.get('src/main.js')||'';
assert.match(main,/list\.replaceChildren\(fragment\)/,'main.js must remain the channel-list child renderer');

const sidebar=contents.get('src/sidebar-now.js')||'';
assert.match(sidebar,/MutationObserver/,'Sidebar Now Playing may observe row creation for decoration');
assert.doesNotMatch(sidebar,/\blist\.(?:appendChild|prepend|replaceChildren|insertBefore|removeChild)\s*\(/,'Sidebar Now Playing must not mutate channel-list child order');
assert.doesNotMatch(sidebar,/\.hidden\s*=/,'Sidebar Now Playing must not own channel-root visibility');

for(const [file,source] of contents){
  if(file==='src/main.js')continue;
  if(!/channel-item|channel-list|channel-summary/.test(source))continue;
  assert.doesNotMatch(
    source,
    /(?:querySelectorAll|querySelector|getElementById)[\s\S]{0,200}channel-item[\s\S]{0,500}\.(?:appendChild|prepend|replaceChildren|insertBefore|removeChild)\s*\(/,
    `${file} must not become a second channel-row ordering owner`
  );
}

const favorites=contents.get('src/favorites-ui.js')||'';
assert.doesNotMatch(favorites,/channel-list/,'Favorites must not bind the channel-list DOM directly');
assert.doesNotMatch(favorites,/item\.hidden\s*=/,'Favorites must not own channel-root visibility');
assert.doesNotMatch(favorites,/MutationObserver/,'Favorites must not post-process channel rows through DOM mutation observation');

console.log(JSON.stringify({
  channelListRefs,
  rootOwner:'src/main.js',
  decorator:'src/sidebar-now.js',
  scannedFiles:files.length,
  status:'PASS'
},null,2));
