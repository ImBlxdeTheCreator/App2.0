/* Startup mode chooser, staged application bootstrap, PWA installation,
   service-worker registration, and update handling. */
(function(){
  'use strict';
  const gate=document.getElementById('startupGate');
  const status=document.getElementById('startupStatus');
  const offlineBtn=document.getElementById('startupOfflineBtn');
  const bungieBtn=document.getElementById('startupBungieBtn');
  const installButtons=[document.getElementById('startupInstallBtn'),document.getElementById('installAppBtn')];
  let deferredInstall=null;
  let launching=false;

  function setStatus(text,error){
    if(!status)return;
    status.textContent=text||'';
    status.style.color=error?'var(--danger)':'var(--muted)';
  }
  function setButtonsDisabled(disabled){
    if(offlineBtn)offlineBtn.disabled=disabled;
    if(bungieBtn)bungieBtn.disabled=disabled;
  }
  function unlock(mode){
    sessionStorage.setItem('d2synergy_launch_mode',mode);
    document.body.classList.remove('startupLocked');
    gate.classList.add('closed');
    setTimeout(()=>gate.hidden=true,260);
  }
  async function prepare(mode){
    if(!window.D2App?.boot) throw new Error('The D2Synergy app bootstrap was not loaded.');
    await D2App.boot({mode});
  }
  async function launchOffline(){
    if(launching)return;launching=true;setButtonsDisabled(true);
    try{
      setStatus('Preparing the offline builder and saved loadouts…');
      await prepare('offline');
      unlock('offline');
      if(window.D2Loader)D2Loader.hide(true);
    }catch(e){
      if(window.D2Loader)D2Loader.hide(true);
      setStatus(e.message||'Unable to start offline mode.',true);
      setButtonsDisabled(false);launching=false;
    }
  }
  async function launchBungie(){
    if(launching)return;launching=true;setButtonsDisabled(true);
    try{
      setStatus('Preparing secure Bungie sign-in…');
      await prepare('bungie');
      const auth=typeof getStoredAuth==='function'&&getStoredAuth();
      if(!auth){
        if(window.D2Loader)D2Loader.hide(true);
        setStatus('Redirecting securely to Bungie.net…');
        startBungieSignIn();
        return;
      }
      setStatus('Loading your Bungie account and exact equipped build…');
      if(window.D2Loader){D2Loader.update('Syncing Guardian','Loading exact equipped build, Vault, currencies, and character data…');D2Loader.progress(null);}
      unlock('bungie');
      if(typeof syncMyLiveBuildExact==='function') await syncMyLiveBuildExact();
      if(window.D2Loader)D2Loader.hide(true);
    }catch(e){
      if(window.D2Loader)D2Loader.hide(true);
      setStatus(e.message||'Unable to load Bungie account.',true);
      gate.hidden=false;gate.classList.remove('closed');document.body.classList.add('startupLocked');
      setButtonsDisabled(false);launching=false;
    }
  }

  if(offlineBtn)offlineBtn.onclick=launchOffline;
  if(bungieBtn)bungieBtn.onclick=launchBungie;

  const returning=new URLSearchParams(location.search).has('code');
  if(returning){
    launching=true;setButtonsDisabled(true);setStatus('Completing Bungie sign-in…');
    (async()=>{
      try{
        await prepare('bungie');
        // finalize-loadout.js starts the existing OAuth exchange when it loads.
        let attempts=0;
        const timer=setInterval(async()=>{
          attempts++;
          if(typeof getStoredAuth==='function'&&getStoredAuth()){
            clearInterval(timer);unlock('bungie');
            try{if(typeof syncMyLiveBuildExact==='function')await syncMyLiveBuildExact();}catch(e){console.error(e);}
            if(window.D2Loader)D2Loader.hide(true);
          }else if(attempts>60){
            clearInterval(timer);if(window.D2Loader)D2Loader.hide(true);
            setStatus(window.__d2synergyAuthError||'Sign-in could not be completed. Try again.',true);
            setButtonsDisabled(false);launching=false;
          }
        },150);
      }catch(e){
        if(window.D2Loader)D2Loader.hide(true);
        setStatus(e.message||'Unable to initialize Bungie sign-in.',true);
        setButtonsDisabled(false);launching=false;
      }
    })();
  }

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;installButtons.forEach(b=>{if(b)b.hidden=false;});});
  async function install(){if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;installButtons.forEach(b=>{if(b)b.hidden=true;});}
  installButtons.forEach(b=>{if(b)b.onclick=install;});
  window.addEventListener('appinstalled',()=>setStatus('D2Synergy installed.'));

  if('serviceWorker' in navigator){
    window.addEventListener('load',async()=>{
      try{
        const reg=await navigator.serviceWorker.register('./service-worker.js?v=9',{scope:'./',updateViaCache:'none'});
        // Ask for an update on each launch without blocking startup.
        setTimeout(()=>reg.update().catch(()=>{}),1200);
        reg.addEventListener('updatefound',()=>{
          const worker=reg.installing;if(!worker)return;
          worker.addEventListener('statechange',()=>{
            if(worker.state==='installed'&&navigator.serviceWorker.controller){
              const reload=confirm('A new D2Synergy update is ready. Restart now?');
              if(reload)worker.postMessage({type:'SKIP_WAITING'});
            }
          });
        });
        navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
      }catch(e){console.warn('PWA service worker unavailable:',e);}
    });
  }
})();
