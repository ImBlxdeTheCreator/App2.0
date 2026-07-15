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
    if(!valid.has(name))name='command';rememberCurrent();
    nav.querySelectorAll('[data-workspace]').forEach(button=>{
      const active=button.dataset.workspace===name;button.classList.toggle('active',active);
      button.setAttribute('aria-current',active?'page':'false');
    });
    panels.forEach(panel=>{const active=panel.dataset.workspacePanel===name;panel.classList.toggle('active',active);panel.hidden=!active;});
    localStorage.setItem('d2synergy_workspace',name);
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
        case 'loadouts':activate('loadouts',{scroll:false});document.getElementById('loadoutsBtn')?.click();break;
        case 'operations':
          activate('operations',{scroll:false});await ensure('operations');window.openActivitiesWindow?.();break;
        case 'vendors':await ensure('operations');window.openVendorsWindow?.();break;
        default:activate(action);break;
      }
    }catch(error){console.error(error);alert(error.message||'Unable to open this workspace.');}
  }
  nav.addEventListener('click',event=>{const button=event.target.closest('[data-workspace]');if(button)perform(button.dataset.workspace);});
  document.addEventListener('click',event=>{const button=event.target.closest('[data-workspace-action]');if(button)perform(button.dataset.workspaceAction);});
  window.D2Workspaces={activate,perform,get active(){return localStorage.getItem('d2synergy_workspace')||'command';}};
  activate(localStorage.getItem('d2synergy_workspace')||'command',{scroll:false});
})();
