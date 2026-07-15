/* Canonical responsive Build Workspace mounting.
   The same live DOM/state is moved between desktop and mobile shells, so only
   one layout is rendered and there are no duplicate controls or IDs. */
(function(){
  'use strict';
  const mq=window.matchMedia('(max-width: 820px)');
  let mountedMode='';

  function toolbarMarkup(){
    return '<div class="builderToolbarTitle">Build Editor</div>'+
      '<div class="builderToolbarActions">'+
      '<button class="builderToolButton" data-builder-action="save"><span class="toolIcon">▣</span><span class="toolText">Save Build</span></button>'+
      '<button class="builderToolButton" data-builder-action="load"><span class="toolIcon">⇩</span><span class="toolText">Load Build</span></button>'+
      '<button class="builderToolButton" data-builder-action="share"><span class="toolIcon">⌯</span><span class="toolText">Share</span></button>'+
      '</div>';
  }

  function wireToolbar(toolbar){
    if(!toolbar || toolbar.dataset.wired==='1') return;
    toolbar.dataset.wired='1';
    toolbar.innerHTML=toolbarMarkup();
    toolbar.addEventListener('click',event=>{
      const button=event.target.closest('[data-builder-action]');
      if(!button)return;
      const action=button.dataset.builderAction;
      if(action==='save'){
        const input=document.getElementById('loadoutNameInput');
        if(input && !input.value) input.value=`${window.state?.element||''} ${window.state?.cls||''} Build`.trim();
        document.getElementById('loadoutsBtn')?.click();
      }else if(action==='load'){
        document.getElementById('loadoutsBtn')?.click();
      }else if(action==='share'){
        const payload={version:1,build:(typeof state!=='undefined'?state:{})};
        const text=JSON.stringify(payload);
        if(navigator.share){
          navigator.share({title:'D2Synergy Build',text}).catch(()=>{});
        }else if(navigator.clipboard){
          navigator.clipboard.writeText(text).then(()=>window.D2Loader?.toast?.('Build copied to clipboard')).catch(()=>{});
        }
      }
    });
  }

  function mount(){
    const mode=mq.matches?'mobile':'desktop';
    if(mode===mountedMode)return;
    const readoutToggle=document.getElementById('readoutToggle');
    const readoutCol=document.getElementById('readoutCol');
    const statsToggle=document.getElementById('statsToggle');
    const statsCol=document.getElementById('statsCol');
    const builderCol=document.getElementById('builderCol');
    if(!readoutToggle||!readoutCol||!statsToggle||!statsCol||!builderCol)return;

    const readoutSlot=document.getElementById(mode==='mobile'?'builderMobileReadoutSlot':'builderDesktopReadoutSlot');
    const statsSlot=document.getElementById(mode==='mobile'?'builderMobileStatsSlot':'builderDesktopStatsSlot');
    const editorSlot=document.getElementById(mode==='mobile'?'builderMobileEditorSlot':'builderDesktopEditorSlot');
    const toolbar=document.getElementById(mode==='mobile'?'builderMobileToolbar':'builderDesktopToolbar');
    readoutSlot.append(readoutToggle,readoutCol);
    statsSlot.append(statsToggle,statsCol);
    editorSlot.append(builderCol);
    wireToolbar(toolbar);
    mountedMode=mode;
    document.documentElement.dataset.builderLayout=mode;
    window.dispatchEvent(new CustomEvent('d2synergy:builder-layout',{detail:{mode}}));
  }

  mq.addEventListener?.('change',mount);
  window.addEventListener('resize',()=>requestAnimationFrame(mount),{passive:true});
  window.addEventListener('d2synergy:ready',()=>requestAnimationFrame(mount));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
