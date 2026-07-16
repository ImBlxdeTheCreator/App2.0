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
    sessionStorage.setItem('d2synergy_workspace',name);
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
          activate('inventory',{scroll:false});await ensure('inventory');window.openFullScreenVault?.();break;
        case 'builder':activate('builder');break;
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
  window.D2Workspaces={activate,perform,get active(){return sessionStorage.getItem('d2synergy_workspace')||'builder';}};
  // A fresh app launch always opens on the useful Builder workspace.
  // Workspace state is retained only for the current tab/session.
  sessionStorage.setItem('d2synergy_workspace','builder');
  activate('builder',{scroll:false});
})();


(function(){
  const overlay=document.getElementById('settingsOverlay');
  if(!overlay)return;
  const motion=document.getElementById('settingMotion');
  const density=document.getElementById('settingDensity');
  const text=document.getElementById('settingText');
  function apply(){
    const m=localStorage.getItem('d2_setting_motion')||'system';
    const d=localStorage.getItem('d2_setting_density')||'comfortable';
    const t=localStorage.getItem('d2_setting_text')||'100';
    document.documentElement.dataset.motion=m;
    document.documentElement.dataset.density=d;
    document.documentElement.style.fontSize=t+'%';
    motion.value=m; density.value=d; text.value=t;
  }
  function open(){overlay.hidden=false;requestAnimationFrame(()=>overlay.classList.add('open'));}
  function close(){overlay.classList.remove('open');setTimeout(()=>overlay.hidden=true,160);}
  [motion,density,text].forEach(el=>el.addEventListener('change',()=>{
    localStorage.setItem('d2_setting_'+(el===motion?'motion':el===density?'density':'text'),el.value);apply();
  }));
  document.getElementById('settingsCloseBtn')?.addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.getElementById('settingsClearCache')?.addEventListener('click',async()=>{
    if('caches' in window){for(const key of await caches.keys())await caches.delete(key);}
    location.reload();
  });
  window.D2Settings={open,close,apply};apply();
})();
