#!/usr/bin/env node
/**
 * One-time D2Synergy curated hash resolver.
 *
 * Usage:
 *   BUNGIE_API_KEY=... node resolve-curated-hashes.mjs /path/to/js/data/exotics.js
 *
 * It resolves EXOTIC_ARMOR and EXOTIC_WEAPONS through Bungie's Armory search,
 * writes exact DestinyInventoryItemDefinition hashes into the source file, and
 * emits a JSON report beside the file. Ambiguous/redacted/missing results are
 * never guessed and are left for manual review.
 */
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';

const file=path.resolve(process.argv[2]||'js/data/exotics.js');
const apiKey=process.env.BUNGIE_API_KEY;
if(!apiKey)throw new Error('Set BUNGIE_API_KEY before running this script.');
const base='https://www.bungie.net/Platform';
const classType={Titan:0,Hunter:1,Warlock:2};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’\'`]/g,'').replace(/[–—]/g,'-').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();

async function bungie(pathname){
  let last;
  for(let attempt=0;attempt<4;attempt++){
    try{
      const r=await fetch(base+pathname,{headers:{'X-API-Key':apiKey}});
      const body=await r.json();
      if(r.ok&&body?.ErrorCode===1)return body.Response;
      last=new Error(body?.Message||`HTTP ${r.status}`);
    }catch(e){last=e;}
    await sleep(600*2**attempt);
  }
  throw last;
}

async function searchOne(target){
  const response=await bungie(`/Destiny2/Armory/Search/DestinyInventoryItemDefinition/${encodeURIComponent(target.name)}/`);
  const rows=response?.results?.results||[];
  const exact=rows.filter(row=>norm(row.displayProperties?.name)===norm(target.name)&&!row.redacted);
  const typed=exact.filter(row=>Number(row.itemType)===target.itemType);
  const classMatched=target.className?typed.filter(row=>Number(row.classType)===classType[target.className]):typed;
  const pool=classMatched.length?classMatched:typed;
  if(pool.length===1)return {status:'resolved',hash:String(pool[0].hash),candidate:pool[0]};
  if(pool.length>1)return {status:'ambiguous',candidates:pool.map(x=>({hash:String(x.hash),name:x.displayProperties?.name,itemType:x.itemType,classType:x.classType,icon:x.displayProperties?.icon||null}))};
  return {status:'missing',candidates:exact.map(x=>({hash:String(x.hash),name:x.displayProperties?.name,itemType:x.itemType,classType:x.classType,redacted:!!x.redacted}))};
}

function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function insertHashInRange(source,startMarker,endMarker,name,hash){
  const start=source.indexOf(startMarker);if(start<0)throw new Error(`Missing marker ${startMarker}`);
  const end=endMarker?source.indexOf(endMarker,start):source.length;if(end<0)throw new Error(`Missing marker ${endMarker}`);
  const segment=source.slice(start,end);
  const rx=new RegExp(`\\{name:(['"])${escapeRegExp(name)}\\1,(?!\\s*hash:)`);
  if(!rx.test(segment))return {source,changed:false};
  const changed=segment.replace(rx,`{name:$1${name}$1, hash:${hash},`);
  return {source:source.slice(0,start)+changed+source.slice(end),changed:true};
}

let source=await fs.readFile(file,'utf8');
const context={};vm.createContext(context);
vm.runInContext(source+'\n;globalThis.__D2_HASH_TARGETS={EXOTIC_ARMOR,EXOTIC_WEAPONS};',context,{filename:file});
const {EXOTIC_ARMOR,EXOTIC_WEAPONS}=context.__D2_HASH_TARGETS;
const targets=[];
for(const [className,items] of Object.entries(EXOTIC_ARMOR))for(const item of items)if(!item.hash)targets.push({section:'armor',className,name:item.name,itemType:2});
for(const item of EXOTIC_WEAPONS)if(!item.hash)targets.push({section:'weapon',className:null,name:item.name,itemType:3});

const report={file,startedAt:new Date().toISOString(),total:targets.length,resolved:[],ambiguous:[],missing:[],errors:[]};
for(let i=0;i<targets.length;i++){
  const target=targets[i];
  process.stdout.write(`[${i+1}/${targets.length}] ${target.name} ... `);
  try{
    const result=await searchOne(target);
    if(result.status==='resolved'){
      const marker=target.section==='armor'?'const EXOTIC_ARMOR =':'const EXOTIC_WEAPONS =';
      const end=target.section==='armor'?'const EXOTIC_CLASS_ITEM_PERKS =':null;
      const patched=insertHashInRange(source,marker,end,target.name,result.hash);
      if(patched.changed){source=patched.source;report.resolved.push({...target,hash:result.hash});console.log(result.hash);}else{report.errors.push({...target,error:'Source entry not uniquely patchable'});console.log('source-match-failed');}
    }else{
      report[result.status].push({...target,candidates:result.candidates});console.log(result.status);
    }
  }catch(error){report.errors.push({...target,error:String(error?.message||error)});console.log('error');}
  await sleep(55);
}
report.finishedAt=new Date().toISOString();
await fs.writeFile(file,source);
const reportPath=file.replace(/\.js$/,'-hash-report.json');
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(`\nResolved ${report.resolved.length}/${report.total}; ambiguous ${report.ambiguous.length}; missing ${report.missing.length}; errors ${report.errors.length}.`);
console.log(`Report: ${reportPath}`);
