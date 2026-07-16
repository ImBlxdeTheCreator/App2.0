/* Lightweight account drawer controller.
   Loaded with the core workspace so Sign in / Sign out / Go Offline / Settings
   remain available even before the heavier Bungie account module is requested. */
(function(){
  'use strict';
  const drawer=document.getElementById('syncDrawer');
  const overlay=document.getElementById('drawerOverlay');
  const openButton=document.getElementById('syncDrawerBtn');
  const closeButton=document.getElementById('drawerCloseBtn');
  const body=document.getElementById('syncCol');
  const footer=document.getElementById('syncDrawerFooter');
  if(!drawer||!overlay||!openButton||!body)return;
  const AUTH_KEY='d2synergy_bungie_auth';
  const LABEL_KEY='d2synergy_account_label';

  function readAuth(){
    if(typeof window.getStoredAuth==='function')return window.getStoredAuth();
    try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null');}catch(e){return null;}
  }
  function accountLabel(){
    try{return localStorage.getItem(LABEL_KEY)||'Bungie account';}catch(e){return 'Bungie account';}
  }
  function row(label,handler,testid){
    const button=document.createElement('button');
    button.type='button';button.className='drawerRow';
    if(testid)button.dataset.testid=testid;
    const text=document.createElement('span');text.className='rowLabel';text.textContent=label;
    const arrow=document.createElement('span');arrow.className='rowChev';arrow.setAttribute('aria-hidden','true');arrow.textContent='❯';
    button.append(text,arrow);button.addEventListener('click',handler);return button;
  }
  function open(){refresh();drawer.classList.add('open');overlay.classList.add('open');drawer.setAttribute('aria-hidden','false');}
  function close(){drawer.classList.remove('open');overlay.classList.remove('open');drawer.setAttribute('aria-hidden','true');}
  async function loadAccountActions(){
    await window.D2App?.ensureGroup?.('account',{blocking:false});
    return window.D2AccountActions||null;
  }
  async function signIn(){
    close();
    try{
      const actions=await loadAccountActions();
      if(actions?.signIn)actions.signIn();
      else if(typeof window.startBungieSignIn==='function')window.startBungieSignIn();
      else throw new Error('Bungie sign-in could not be initialized.');
    }catch(error){console.error(error);window.fsToast?.(error.message||'Unable to start Bungie sign-in.','error');}
  }
  async function signOut(){
    try{
      const actions=await loadAccountActions();
      if(actions?.signOut)actions.signOut();
      else{
        try{localStorage.removeItem(AUTH_KEY);localStorage.removeItem(LABEL_KEY);}catch(e){}
        window.dispatchEvent(new CustomEvent('d2synergy:accountchange'));
      }
    }catch(error){console.error(error);window.fsToast?.(error.message||'Unable to sign out.','error');}
    refresh();close();
  }
  async function goOffline(){
    try{
      const actions=await loadAccountActions();
      if(actions?.goOffline)actions.goOffline();
      else{
        // Offline mode pauses live account work but deliberately preserves the
        // stored Bungie session and cached Guardian data. Sign Out is the only
        // action that removes account credentials.
        try{localStorage.setItem('d2synergy_start_mode','offline');sessionStorage.setItem('d2synergy_launch_mode','offline');}catch(e){}
        document.documentElement.dataset.connectionMode='offline';
        window.dispatchEvent(new CustomEvent('d2synergy:accountchange',{detail:{mode:'offline'}}));
      }
      window.D2Status?.set?.('builder','offline','Using cached Guardian data',{preserveTime:true});
    }catch(error){console.error(error);window.fsToast?.(error.message||'Unable to switch offline.','error');}
    refresh();close();
  }
  function refresh(){
    const auth=readAuth();const label=accountLabel();
    body.replaceChildren();
    if(auth){
      body.appendChild(row(`Signed in · ${label}`,async()=>{
        close();
        try{
          await loadAccountActions();
          try{sessionStorage.setItem('d2synergy_launch_mode','bungie');localStorage.setItem('d2synergy_start_mode','bungie');}catch(e){}
          document.documentElement.dataset.connectionMode='bungie';
          document.getElementById('globalSyncBtn')?.click();
        }catch(error){console.error(error);}
      },'signed-in-account-menu'));
      body.appendChild(row('Sign Out',signOut,'sign-out-menu'));
    }else body.appendChild(row('Sign in with Bungie',signIn,'signin-bungie-menu'));
    body.appendChild(row('Go Offline',goOffline,'go-offline-menu'));
    body.appendChild(row('Settings',()=>{close();window.D2Settings?.open?.();},'open-settings-menu'));
    if(footer){footer.replaceChildren();const note=document.createElement('div');note.className='empty-note';note.textContent=auth?`Connected as ${label}.`:'Offline mode or Bungie sign-in available.';footer.appendChild(note);}
    window.D2Settings?.refreshAccount?.();
  }
  openButton.addEventListener('click',open);
  closeButton?.addEventListener('click',close);
  overlay.addEventListener('click',close);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drawer.classList.contains('open'))close();});
  window.addEventListener('d2synergy:accountchange',refresh);

  // Right-edge swipe is available only when full-screen tools are closed.
  let startX=null,startY=null,tracking=false;
  document.addEventListener('touchstart',event=>{
    const touch=event.touches?.[0];if(!touch)return;
    if(document.querySelector('.fsOverlay.open,.settingsOverlay.open,.equipmentEditorOverlay.open')){tracking=false;return;}
    tracking=window.innerWidth-touch.clientX<=24;
    if(tracking){startX=touch.clientX;startY=touch.clientY;event.preventDefault();}
  },{passive:false});
  document.addEventListener('touchend',event=>{
    if(!tracking)return;tracking=false;const touch=event.changedTouches?.[0];if(!touch)return;
    if(touch.clientX-startX < -60 && Math.abs(touch.clientY-startY)<80)open();
  },{passive:true});

  window.D2AccountMenu={open,close,refresh,readAuth};
  refresh();
})();
