/* D2Synergy staged application bootstrap.
   The startup gate and Ghost loader paint first. The large builder, Bungie,
   inventory, and data scripts are fetched at idle priority and evaluated only
   after the user chooses Offline or Bungie mode. Script execution order stays
   identical to the previous all-at-once index.html. */
(function(){
  'use strict';

  const BUILD='20260715-performance-9';
  const phases=[
    {
      label:'Loading build definitions',
      files:[
        'js/data/subclasses.js','js/data/abilities.js','js/data/exotics.js',
        'js/data/weapons.js','js/data/armor.js','js/data/artifacts.js'
      ]
    },
    {
      label:'Starting the build engine',
      files:['js/core/state.js','js/core/synergy-engine.js','js/ui/builder.js','js/ui/readout.js']
    },
    {
      label:'Connecting companion features',
      files:[
        'js/api/bungie.js','js/features/vault.js','js/features/activities-vendors.js',
        'js/features/live-character-sync.js','js/features/item-detail.js',
        'js/features/finalize-loadout.js','js/features/loadouts.js','js/ui/workspaces.js'
      ]
    }
  ];
  const allFiles=phases.flatMap(phase=>phase.files);
  const loaded=new Set();
  let bootPromise=null;
  let ready=false;

  function versioned(src){return `${src}?v=${BUILD}`;}

  function prefetch(){
    if(document.documentElement.dataset.d2PrefetchStarted==='1') return;
    document.documentElement.dataset.d2PrefetchStarted='1';
    allFiles.forEach(src=>{
      const link=document.createElement('link');
      link.rel='prefetch';
      link.as='script';
      link.href=versioned(src);
      document.head.appendChild(link);
    });
  }

  function loadScript(src){
    if(loaded.has(src)) return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=versioned(src);
      script.async=false;
      script.dataset.d2Dynamic='true';
      script.onload=()=>{loaded.add(src);resolve();};
      script.onerror=()=>reject(new Error(`Unable to load ${src}`));
      document.body.appendChild(script);
    });
  }

  async function boot(options={}){
    if(ready) return window.D2App;
    if(bootPromise) return bootPromise;
    const mode=options.mode||'offline';
    bootPromise=(async()=>{
      let completed=0;
      const total=allFiles.length;
      if(window.D2Loader){
        D2Loader.show(mode==='bungie'?'Preparing Bungie mode':'Preparing offline mode','Loading the D2Synergy app shell…');
        D2Loader.progress(0);
      }
      for(const phase of phases){
        if(window.D2Loader) D2Loader.update(phase.label,`${completed} of ${total} components ready`);
        for(const file of phase.files){
          await loadScript(file);
          completed++;
          if(window.D2Loader){
            D2Loader.progress(completed/total);
            D2Loader.update(phase.label,`${completed} of ${total} components ready`);
          }
        }
        // Give the browser one paint opportunity between large phases.
        await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
      }
      ready=true;
      document.documentElement.dataset.d2AppReady='1';
      window.dispatchEvent(new CustomEvent('d2synergy:ready',{detail:{mode,build:BUILD}}));
      return window.D2App;
    })().catch(error=>{
      bootPromise=null;
      ready=false;
      console.error('[D2Synergy] application bootstrap failed',error);
      throw error;
    });
    return bootPromise;
  }

  window.D2App={
    BUILD,
    boot,
    prefetch,
    get ready(){return ready;},
    get loadedScripts(){return [...loaded];}
  };

  const schedule=window.requestIdleCallback||((fn)=>setTimeout(fn,700));
  schedule(prefetch,{timeout:2500});
})();
