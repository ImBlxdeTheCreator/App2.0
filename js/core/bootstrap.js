/* D2Synergy staged bootstrap.
   v18 keeps the builder shell small, loads account code only for Bungie mode,
   and defers inventory/operations code until the related workspace opens. */
(function(){
  'use strict';

  const BUILD='20260716-rollback-19-0-1';
  const groups={
    builder:{
      label:'Loading the build workspace',
      files:[
        'js/data/subclasses.js','js/data/abilities.js','js/data/exotics.js',
        'js/data/weapons.js','js/data/armor.js','js/data/artifacts.js',
        'js/core/state.js','js/ui/status.js','js/core/synergy-engine.js','js/ui/builder.js',
        'js/ui/readout.js','js/ui/builder-layout.js','js/features/loadouts.js',
        'js/features/workspace-tools.js','js/ui/workspaces.js'
      ]
    },
    account:{
      label:'Connecting Bungie account services',
      files:['js/api/bungie.js','js/features/live-character-sync.js','js/features/finalize-loadout.js']
    },
    inventory:{
      label:'Opening inventory',
      files:['js/features/item-detail.js','js/features/vault.js']
    },
    operations:{
      label:'Opening operations',
      files:['js/features/activities-vendors.js']
    }
  };

  const loaded=new Set();
  const loading=new Map();
  const groupPromises=new Map();
  let ready=false;
  let bootPromise=null;

  function versioned(src){return `${src}?v=${BUILD}`;}

  function hintGroup(name,priority='low'){
    const group=groups[name];
    if(!group)return;
    group.files.forEach(src=>{
      if(loaded.has(src)||document.querySelector(`link[data-d2-hint="${src}"]`))return;
      const link=document.createElement('link');
      link.rel='preload';link.as='script';link.fetchPriority=priority;
      link.href=versioned(src);link.dataset.d2Hint=src;
      document.head.appendChild(link);
    });
  }

  function loadScript(src,onReady){
    if(loaded.has(src)){onReady?.();return Promise.resolve();}
    if(loading.has(src))return loading.get(src);
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=versioned(src);script.async=false;script.dataset.d2Dynamic='true';
      script.onload=()=>{loaded.add(src);loading.delete(src);onReady?.();resolve();};
      script.onerror=()=>{loading.delete(src);reject(new Error(`Unable to load ${src}`));};
      document.body.appendChild(script);
    });
    loading.set(src,promise);
    return promise;
  }

  async function ensureGroup(name,options={}){
    if(groupPromises.has(name))return groupPromises.get(name);
    const group=groups[name];
    if(!group)throw new Error(`Unknown D2Synergy module group: ${name}`);
    const promise=(async()=>{
      let complete=0;
      const total=group.files.length;
      if(options.loader!==false&&window.D2Loader){
        D2Loader.show(group.label,options.detail||'Loading only the components this workspace needs…',{blocking:options.blocking!==false});
        D2Loader.progress(0);
      }
      try{
        // Insert all scripts immediately. Classic async=false keeps execution order,
        // while the browser downloads them in parallel.
        const promises=group.files.map(src=>loadScript(src,()=>{
          complete++;
          if(options.loader!==false&&window.D2Loader){
            D2Loader.progress(complete/total);
            D2Loader.update(group.label,`${complete} of ${total} components ready`);
          }
        }));
        await Promise.all(promises);
        return true;
      }finally{
        if(options.loader!==false&&window.D2Loader)D2Loader.hide(true);
      }
    })().catch(error=>{groupPromises.delete(name);throw error;});
    groupPromises.set(name,promise);
    return promise;
  }

  async function boot(options={}){
    if(ready&&options.mode!=='bungie')return window.D2App;
    if(bootPromise)return bootPromise;
    const mode=options.mode||'offline';
    bootPromise=(async()=>{
      await ensureGroup('builder',{detail:'Preparing the editor, saved loadouts, and workspace shell…'});
      ready=true;
      document.documentElement.dataset.d2AppReady='1';
      window.dispatchEvent(new CustomEvent('d2synergy:ready',{detail:{mode,build:BUILD}}));
      if(mode==='bungie')await ensureGroup('account',{detail:'Preparing authentication and live Guardian sync…'});
      // Warm likely next actions only after the visible app is ready.
      if('requestIdleCallback' in window){
        requestIdleCallback(()=>hintGroup('inventory'),{timeout:2500});
        requestIdleCallback(()=>hintGroup('operations'),{timeout:3500});
      }else{
        setTimeout(()=>hintGroup('inventory'),1000);
        setTimeout(()=>hintGroup('operations'),1800);
      }
      return window.D2App;
    })().catch(error=>{bootPromise=null;ready=false;console.error('[D2Synergy] bootstrap failed',error);throw error;});
    return bootPromise;
  }

  window.D2App={
    BUILD,boot,ensureGroup,hintGroup,
    get ready(){return ready;},
    get loadedScripts(){return [...loaded];},
    get loadedGroups(){return [...groupPromises.keys()];}
  };
  // Do not preload the full Builder before the user chooses a launch mode.
  // This keeps the startup gate interactive and avoids downloading unused code.
})();
