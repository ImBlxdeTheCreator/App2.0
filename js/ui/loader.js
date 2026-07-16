/* Unified D2Synergy loading system. Supports blocking startup work and
   non-blocking background refreshes so account sync does not freeze the app. */
(function(){
  'use strict';
  const overlay=document.getElementById('d2GlobalLoader');
  const message=document.getElementById('d2GlobalLoaderMessage');
  const detail=document.getElementById('d2GlobalLoaderDetail');
  const progressTrack=document.getElementById('d2GlobalLoaderProgress');
  const progressFill=document.getElementById('d2GlobalLoaderProgressFill');
  let depth=0;let hideTimer=null;let safetyTimer=null;

  function show(text,subtext,options={}){
    clearTimeout(hideTimer);clearTimeout(safetyTimer);depth++;
    if(message)message.textContent=text||'Loading…';
    if(detail)detail.textContent=subtext||'';
    if(overlay){
      overlay.classList.toggle('nonBlocking',options.blocking===false);
      overlay.hidden=false;requestAnimationFrame(()=>{if(!overlay.hidden)overlay.classList.add('open');});
      safetyTimer=setTimeout(()=>hide(true),30000);
    }
  }
  function update(text,subtext){if(message&&text!=null)message.textContent=text;if(detail&&subtext!=null)detail.textContent=subtext;}
  function progress(value){
    if(!progressTrack||!progressFill)return;
    if(value==null||Number.isNaN(Number(value))){progressTrack.hidden=true;progressFill.style.width='0%';return;}
    const pct=Math.max(0,Math.min(1,Number(value)))*100;
    progressTrack.hidden=false;progressFill.style.width=`${pct}%`;progressTrack.setAttribute('aria-valuenow',String(Math.round(pct)));
  }
  function hide(force){
    clearTimeout(safetyTimer);depth=force?0:Math.max(0,depth-1);if(depth||!overlay)return;
    overlay.classList.remove('open');
    hideTimer=setTimeout(()=>{if(!depth){overlay.hidden=true;overlay.classList.remove('nonBlocking');progress(null);}},90);
  }
  function inline(text){
    const wrap=document.createElement('div');wrap.className='d2InlineLoader';
    const img=document.createElement('img');img.src='assets/brand/ghost-loader.webp';img.alt='';img.decoding='async';
    const span=document.createElement('span');span.textContent=text||'Loading…';wrap.append(img,span);return wrap;
  }
  function reset(){depth=0;clearTimeout(hideTimer);clearTimeout(safetyTimer);if(overlay){overlay.classList.remove('open','nonBlocking');overlay.hidden=true;}progress(null);}
  window.addEventListener('pageshow',()=>{if(overlay?.hidden)overlay.classList.remove('open','nonBlocking');});
  window.addEventListener('d2synergy:ready',()=>setTimeout(()=>{if(overlay?.classList.contains('open')&&!depth)reset();},0));
  window.D2Loader={show,update,progress,hide,reset,inline};
})();

/* Shared toast API. Account and live-sync modules load before Vault in some
   launch paths, so notifications cannot depend on vault.js defining fsToast. */
(function(){
  'use strict';
  function toast(message,kind){
    const node=document.createElement('div');
    node.className='fsToast'+(kind?` ${kind}`:'');
    node.textContent=String(message||'');
    document.body.appendChild(node);
    setTimeout(()=>{node.style.opacity='0';node.style.transform='translate(-50%,8px)';setTimeout(()=>node.remove(),260);},2600);
  }
  window.fsToast=window.fsToast||toast;
  if(window.D2Loader)window.D2Loader.toast=toast;
})();
