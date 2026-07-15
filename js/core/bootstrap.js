/* D2Synergy staged application bootstrap.
   v12 starts every script download in a phase together while retaining classic
   script execution order. This removes the previous one-network-round-trip-at-
   a-time startup without changing the existing global-script architecture. */
(function(){
  'use strict';

  const BUILD='20260715-operations-workspaces-12';
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
  const loading=new Map();
  let bootPromise=null;
  let ready=false;

  function versioned(src){return `${src}?v=${BUILD}`;}

  function prefetch(){
    if(document.documentElement.dataset.d2PrefetchStarted==='1')return;
    document.documentElement.dataset.d2PrefetchStarted='1';
    allFiles.forEach(src=>{
      const link=document.createElement('link');
      link.rel='preload';link.as='script';link.fetchPriority='low';link.href=versioned(src);
      document.head.appendChild(link);
    });
  }

  function scheduleScript(src,onReady){
    if(loaded.has(src)){onReady?.();return Promise.resolve();}
    if(loading.has(src))return loading.get(src);
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=versioned(src);
      // Dynamically-created classic scripts default to async. Explicitly false
      // preserves insertion/execution order while all requests download together.
      script.async=false;
      script.fetchPriority='high';
      script.dataset.d2Dynamic='true';
      script.onload=()=>{loaded.add(src);loading.delete(src);onReady?.();resolve();};
      script.onerror=()=>{loading.delete(src);reject(new Error(`Unable to load ${src}`));};
      document.body.appendChild(script);
    });
    loading.set(src,promise);
    return promise;
  }

  async function loadPhase(phase,onFileReady){
    // Appending the whole phase immediately allows HTTP/2/browser caching to
    // fetch in parallel. async=false keeps dependent globals in source order.
    const promises=phase.files.map(src=>scheduleScript(src,()=>onFileReady(src)));
    await Promise.all(promises);
  }

  async function boot(options={}){
    prefetch();
    if(ready)return window.D2App;
    if(bootPromise)return bootPromise;
    const mode=options.mode||'offline';
    bootPromise=(async()=>{
      let completed=0;
      const total=allFiles.length;
      if(window.D2Loader){
        D2Loader.show(mode==='bungie'?'Preparing Bungie mode':'Preparing offline mode','Loading the D2Synergy app shell…');
        D2Loader.progress(0);
      }
      for(const phase of phases){
        if(window.D2Loader)D2Loader.update(phase.label,`${completed} of ${total} components ready`);
        await loadPhase(phase,()=>{
          completed++;
          if(window.D2Loader){
            D2Loader.progress(completed/total);
            D2Loader.update(phase.label,`${completed} of ${total} components ready`);
          }
        });
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
      ready=true;
      document.documentElement.dataset.d2AppReady='1';
      window.dispatchEvent(new CustomEvent('d2synergy:ready',{detail:{mode,build:BUILD}}));
      return window.D2App;
    })().catch(error=>{
      bootPromise=null;ready=false;
      console.error('[D2Synergy] application bootstrap failed',error);
      throw error;
    });
    return bootPromise;
  }

  window.D2App={
    BUILD,boot,prefetch,
    get ready(){return ready;},
    get loadedScripts(){return [...loaded];}
  };
  prefetch();
})();
