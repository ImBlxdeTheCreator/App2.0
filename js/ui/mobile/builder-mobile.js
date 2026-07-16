(function(){
  'use strict';
  function mount(){
    if(document.documentElement.dataset.presentation!=='mobile')return;
    const shell=document.getElementById('builderMobileShell');
    const desktop=document.getElementById('builderDesktopShell');
    const readoutToggle=document.getElementById('readoutToggle');
    const readout=document.getElementById('readoutCol');
    const statsToggle=document.getElementById('statsToggle');
    const stats=document.getElementById('statsCol');
    const editor=document.getElementById('builderCol');
    if(!shell||!readout||!stats||!editor)return;
    desktop?.setAttribute('hidden','');shell.removeAttribute('hidden');
    document.getElementById('builderMobileReadoutSlot')?.append(readoutToggle,readout);
    document.getElementById('builderMobileStatsSlot')?.append(statsToggle,stats);
    document.getElementById('builderMobileEditorSlot')?.append(editor);
    document.documentElement.dataset.builderLayout='mobile';
  }
  window.addEventListener('d2synergy:presentationchange',mount);
  window.addEventListener('d2synergy:ready',mount);
  requestAnimationFrame(mount);
})();
