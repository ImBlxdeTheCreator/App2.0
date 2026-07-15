/* D2Synergy workspace navigation.
   Workspaces now switch real panels instead of only changing the active tab.
   Heavy inventory, vendor, operations, and loadout views remain overlays so
   they do not stay mounted and slow the builder when they are not in use. */
(function(){
  'use strict';
  const nav=document.getElementById('workspaceNav');
  if(!nav)return;

  const panels=[...document.querySelectorAll('[data-workspace-panel]')];
  const valid=new Set([...nav.querySelectorAll('[data-workspace]')].map(b=>b.dataset.workspace));

  function activate(name,options={}){
    if(!valid.has(name))name='command';
    nav.querySelectorAll('[data-workspace]').forEach(button=>{
      const active=button.dataset.workspace===name;
      button.classList.toggle('active',active);
      button.setAttribute('aria-current',active?'page':'false');
    });
    panels.forEach(panel=>{
      const active=panel.dataset.workspacePanel===name;
      panel.classList.toggle('active',active);
      panel.hidden=!active;
    });
    localStorage.setItem('d2synergy_workspace',name);
    if(options.scroll!==false){
      const panel=document.querySelector(`[data-workspace-panel="${name}"]`);
      panel?.scrollIntoView({behavior:options.instant?'auto':'smooth',block:'start'});
    }
    window.dispatchEvent(new CustomEvent('d2synergy:workspacechange',{detail:{workspace:name}}));
    return name;
  }

  function perform(action){
    switch(action){
      case 'sync':
        document.getElementById('globalSyncBtn')?.click();
        break;
      case 'inventory':
        activate('inventory',{scroll:false});
        if(typeof openFullScreenVault==='function')openFullScreenVault();
        break;
      case 'builder':
        activate('builder');
        break;
      case 'loadouts':
        activate('loadouts',{scroll:false});
        document.getElementById('loadoutsBtn')?.click();
        break;
      case 'operations':
        activate('operations',{scroll:false});
        if(typeof openActivitiesWindow==='function')openActivitiesWindow();
        break;
      case 'vendors':
        if(typeof openVendorsWindow==='function')openVendorsWindow();
        break;
      case 'command':
      case 'fireteam':
      case 'collections':
      case 'fashion':
        activate(action);
        break;
    }
  }

  nav.addEventListener('click',event=>{
    const button=event.target.closest('[data-workspace]');
    if(!button)return;
    perform(button.dataset.workspace);
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-workspace-action]');
    if(!button)return;
    perform(button.dataset.workspaceAction);
  });

  window.D2Workspaces={activate,perform,get active(){return localStorage.getItem('d2synergy_workspace')||'command';}};
  activate(localStorage.getItem('d2synergy_workspace')||'command',{scroll:false,instant:true});
})();
