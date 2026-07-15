/* Local loadout library. Saved builds remain available offline because they
   are stored in the browser, not on Bungie.net. */
(function(){
  'use strict';
  const STORAGE_KEY='d2synergy_saved_loadouts_v1';
  const EXCLUDED_KEYS=new Set(['liveCharacterStats','selectedCharId']);
  const overlay=document.getElementById('loadoutsOverlay');
  const body=document.getElementById('loadoutsBody');
  const nameInput=document.getElementById('loadoutNameInput');

  function deepClone(value){ return JSON.parse(JSON.stringify(value)); }
  function loadLibrary(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      return Array.isArray(parsed)?parsed:[];
    }catch(e){ return []; }
  }
  function saveLibrary(items){ localStorage.setItem(STORAGE_KEY,JSON.stringify(items)); }
  function snapshotState(){
    const out={};
    Object.keys(state).forEach(key=>{
      if(EXCLUDED_KEYS.has(key) || typeof state[key]==='function') return;
      try{ out[key]=deepClone(state[key]); }catch(e){}
    });
    return out;
  }
  function summaryFor(s){
    const parts=[s.cls,s.element,s.super].filter(Boolean);
    const weapons=Object.values(s.legendaryRealItem||{}).map(x=>x&&x.name).filter(Boolean);
    if(s.liveExoticWeapon?.name) weapons.push(s.liveExoticWeapon.name);
    if(weapons.length) parts.push(weapons.slice(0,3).join(' / '));
    if(s.liveExoticArmor?.name || s.exoticArmor) parts.push(s.liveExoticArmor?.name||s.exoticArmor);
    return parts.join(' • ') || 'Saved D2Synergy build';
  }
  function applySnapshot(snapshot){
    if(!snapshot || typeof snapshot!=='object') throw new Error('Invalid loadout data');
    Object.keys(snapshot).forEach(key=>{
      if(Object.prototype.hasOwnProperty.call(state,key) && !EXCLUDED_KEYS.has(key)){
        state[key]=deepClone(snapshot[key]);
      }
    });
    if(typeof render==='function') render();
  }
  function open(){ overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');renderList();setTimeout(()=>nameInput.focus(),40); }
  function close(){ overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true'); }
  function renderList(){
    const items=loadLibrary().sort((a,b)=>b.updatedAt-a.updatedAt);
    body.innerHTML='';
    if(!items.length){
      const e=document.createElement('div');e.className='loadoutEmpty';e.innerHTML='<strong>No saved loadouts yet.</strong><br><br>Build something in D2Synergy, then choose “Save Current Build.”';body.appendChild(e);return;
    }
    items.forEach(item=>{
      const card=document.createElement('article');card.className='loadoutCard';
      const copy=document.createElement('div');
      const name=document.createElement('div');name.className='loadoutName';name.textContent=item.name;
      const meta=document.createElement('div');meta.className='loadoutMeta';meta.textContent=`Saved ${new Date(item.updatedAt).toLocaleString()} • ${item.source==='bungie'?'Bungie-connected':'Offline/local'}`;
      const summary=document.createElement('div');summary.className='loadoutSummary';summary.textContent=summaryFor(item.state);
      copy.append(name,meta,summary);
      const actions=document.createElement('div');actions.className='loadoutActions';
      const load=document.createElement('button');load.textContent='Load';load.onclick=()=>{applySnapshot(item.state);close();};
      const overwrite=document.createElement('button');overwrite.textContent='Update';overwrite.onclick=()=>{item.state=snapshotState();item.updatedAt=Date.now();item.source=(typeof getStoredAuth==='function'&&getStoredAuth())?'bungie':'offline';const all=loadLibrary().map(x=>x.id===item.id?item:x);saveLibrary(all);renderList();};
      const del=document.createElement('button');del.textContent='Delete';del.className='danger';del.onclick=()=>{if(confirm(`Delete “${item.name}”?`)){saveLibrary(loadLibrary().filter(x=>x.id!==item.id));renderList();}};
      actions.append(load,overwrite,del);card.append(copy,actions);body.appendChild(card);
    });
  }
  function saveCurrent(){
    const proposed=(nameInput.value||'').trim() || `${state.cls} ${state.element} Build`;
    const items=loadLibrary();
    const existing=items.find(x=>x.name.toLowerCase()===proposed.toLowerCase());
    const record={id:existing?.id||((crypto.randomUUID&&crypto.randomUUID())||`${Date.now()}-${Math.random()}`),name:proposed,state:snapshotState(),createdAt:existing?.createdAt||Date.now(),updatedAt:Date.now(),source:(typeof getStoredAuth==='function'&&getStoredAuth())?'bungie':'offline'};
    const next=existing?items.map(x=>x.id===existing.id?record:x):[...items,record];
    saveLibrary(next);nameInput.value='';renderList();
  }
  function exportAll(){
    const blob=new Blob([JSON.stringify({format:'D2SynergyLoadouts',version:1,exportedAt:new Date().toISOString(),loadouts:loadLibrary()},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='d2synergy-loadouts.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  async function importFile(file){
    const data=JSON.parse(await file.text());const incoming=Array.isArray(data)?data:data.loadouts;
    if(!Array.isArray(incoming)) throw new Error('This is not a D2Synergy loadout export');
    const map=new Map(loadLibrary().map(x=>[x.id,x]));incoming.forEach(x=>{if(x&&x.id&&x.state)map.set(x.id,x);});saveLibrary([...map.values()]);renderList();
  }

  const legacyOpenButton=document.getElementById('loadoutsBtn');
  if(legacyOpenButton)legacyOpenButton.onclick=open;
  document.getElementById('loadoutsCloseBtn').onclick=close;
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.getElementById('saveLoadoutBtn').onclick=saveCurrent;
  nameInput.addEventListener('keydown',e=>{if(e.key==='Enter')saveCurrent();});
  document.getElementById('exportLoadoutsBtn').onclick=exportAll;
  document.getElementById('importLoadoutsInput').onchange=async e=>{try{if(e.target.files[0])await importFile(e.target.files[0]);}catch(err){alert(err.message);}finally{e.target.value='';}};
  window.D2SynergyLoadouts={open,close,saveCurrent,loadLibrary,applySnapshot};
})();
