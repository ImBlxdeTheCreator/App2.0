/* D2Synergy workspace navigation with feature-level lazy loading. */
(function(){
  'use strict';
  const nav=document.getElementById('workspaceNav');if(!nav)return;
  const panels=[...document.querySelectorAll('[data-workspace-panel]')];
  const valid=new Set([...nav.querySelectorAll('[data-workspace]')].map(b=>b.dataset.workspace));
  const positions=new Map();

  function rememberCurrent(){
    const active=nav.querySelector('[data-workspace].active')?.dataset.workspace;
    if(active)positions.set(active,{x:scrollX,y:scrollY});
  }
  function activate(name,options={}){
    if(!valid.has(name))name='builder';rememberCurrent();
    nav.querySelectorAll('[data-workspace]').forEach(button=>{
      const active=button.dataset.workspace===name;button.classList.toggle('active',active);
      button.setAttribute('aria-current',active?'page':'false');
    });
    panels.forEach(panel=>{const active=panel.dataset.workspacePanel===name;panel.classList.toggle('active',active);panel.hidden=!active;});
    try{sessionStorage.setItem('d2synergy_workspace',name);}catch(e){}
    const saved=positions.get(name);
    if(options.scroll!==false)requestAnimationFrame(()=>scrollTo(saved?.x||0,saved?.y||0));
    window.dispatchEvent(new CustomEvent('d2synergy:workspacechange',{detail:{workspace:name}}));
    window.D2WorkspaceTools?.render?.(name);
    return name;
  }
  async function ensure(name){
    if(!window.D2App?.ensureGroup)return;
    await D2App.ensureGroup(name,{blocking:false});
  }
  async function perform(action){
    try{
      switch(action){
        case 'sync':
          await ensure('account');document.getElementById('globalSyncBtn')?.click();break;
        case 'inventory':
          activate('inventory',{scroll:false});
          window.scrollTo(0,0);
          await ensure('inventory');
          window.openFullScreenVault?.();
          break;
        case 'builder':activate('builder');break;
        case 'artifact':activate('artifact');if(typeof render==='function')render();break;
        case 'loadouts':activate('loadouts',{scroll:false});window.D2SynergyLoadouts?.open?.();break;
        case 'operations':
          activate('operations',{scroll:false});await ensure('operations');window.openActivitiesWindow?.();break;
        case 'vendors':await ensure('operations');window.openVendorsWindow?.();break;
        default:activate(action);break;
      }
    }catch(error){console.error(error);alert(error.message||'Unable to open this workspace.');}
  }
  nav.addEventListener('click',event=>{const button=event.target.closest('[data-workspace]');if(button)perform(button.dataset.workspace);});
  document.addEventListener('click',event=>{const button=event.target.closest('[data-workspace-action]');if(button)perform(button.dataset.workspaceAction);});
  window.D2Workspaces={activate,perform,get active(){try{return sessionStorage.getItem('d2synergy_workspace')||'builder';}catch(e){return 'builder';}}};
  // A fresh app launch always opens on the useful Builder workspace.
  // Workspace state is retained only for the current tab/session.
  try{sessionStorage.setItem('d2synergy_workspace','builder');}catch(e){}
  activate('builder',{scroll:false});
})();


(function(){
  const overlay=document.getElementById('settingsOverlay');
  if(!overlay)return;
  const motion=document.getElementById('settingMotion');
  const density=document.getElementById('settingDensity');
  const text=document.getElementById('settingText');
  function apply(){
    let m='system',d='comfortable',t='100';
    try{m=localStorage.getItem('d2_setting_motion')||m;d=localStorage.getItem('d2_setting_density')||d;t=localStorage.getItem('d2_setting_text')||t;}catch(e){}
    document.documentElement.dataset.motion=m;
    document.documentElement.dataset.density=d;
    document.documentElement.style.fontSize=t+'%';
    motion.value=m; density.value=d; text.value=t;
  }
  function openSettings(){overlay.hidden=false;requestAnimationFrame(()=>overlay.classList.add('open'));}
  function closeSettings(){overlay.classList.remove('open');setTimeout(()=>overlay.hidden=true,160);}
  [motion,density,text].forEach(el=>el.addEventListener('change',()=>{
    try{localStorage.setItem('d2_setting_'+(el===motion?'motion':el===density?'density':'text'),el.value);}catch(e){}apply();
  }));
  document.getElementById('settingsCloseBtn')?.addEventListener('click',closeSettings);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeSettings();});
  document.getElementById('settingsClearCache')?.addEventListener('click',async()=>{
    if('caches' in window){for(const key of await caches.keys())await caches.delete(key);}
    location.reload();
  });
  async function ensureAccount(){await window.D2App?.ensureGroup?.('account',{blocking:false});return window.D2AccountActions;}
  function refreshAccount(){
    let auth=null;
    try{auth=typeof window.getStoredAuth==='function'?window.getStoredAuth():JSON.parse(localStorage.getItem('d2synergy_bungie_auth')||'null');}catch(e){}
    let label='';try{label=localStorage.getItem('d2synergy_account_label')||'';}catch(e){}
    const status=document.getElementById('settingsAccountStatus');
    const signIn=document.getElementById('settingsSignInBtn');
    const signOut=document.getElementById('settingsSignOutBtn');
    let offline=false;try{offline=sessionStorage.getItem('d2synergy_launch_mode')==='offline';}catch(e){}
    if(status)status.textContent=auth
      ? `${offline?'Offline · account saved':'Signed in'}${label?' · '+label:''}`
      : 'Offline · no Bungie account connected';
    if(signIn)signIn.textContent=auth?(offline?'Go Online & Sync':'Sync Account'):'Sign in';
    if(signOut)signOut.disabled=!auth;
  }
  document.getElementById('settingsSignInBtn')?.addEventListener('click',async()=>{
    const api=await ensureAccount();
    let auth=null;try{auth=typeof window.getStoredAuth==='function'?window.getStoredAuth():JSON.parse(localStorage.getItem('d2synergy_bungie_auth')||'null');}catch(e){}
    if(auth){
      try{sessionStorage.setItem('d2synergy_launch_mode','bungie');localStorage.setItem('d2synergy_start_mode','bungie');}catch(e){}
      document.documentElement.dataset.connectionMode='bungie';
      document.getElementById('globalSyncBtn')?.click();
      refreshAccount();
    }else if(api?.signIn)api.signIn();else window.startBungieSignIn?.();
  });
  document.getElementById('settingsSignOutBtn')?.addEventListener('click',async()=>{const api=await ensureAccount();api?.signOut?.();refreshAccount();});
  document.getElementById('settingsGoOfflineBtn')?.addEventListener('click',async()=>{const api=await ensureAccount();api?.goOffline?.();refreshAccount();});
  window.addEventListener('d2synergy:accountchange',refreshAccount);
  window.D2Settings={open(){openSettings();refreshAccount();},close:closeSettings,apply,refreshAccount};apply();refreshAccount();
})();
