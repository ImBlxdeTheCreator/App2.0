(function(){
  'use strict';
  function mount(){
    if(document.documentElement.dataset.presentation!=='desktop')return;
    const shell=document.getElementById('builderDesktopShell');
    const mobile=document.getElementById('builderMobileShell');
    const readoutToggle=document.getElementById('readoutToggle');
    const readout=document.getElementById('readoutCol');
    const statsToggle=document.getElementById('statsToggle');
    const stats=document.getElementById('statsCol');
    const editor=document.getElementById('builderCol');
    if(!shell||!readout||!stats||!editor)return;
    mobile?.setAttribute('hidden','');shell.removeAttribute('hidden');
    document.getElementById('builderDesktopReadoutSlot')?.append(readoutToggle,readout);
    document.getElementById('builderDesktopStatsSlot')?.append(statsToggle,stats);
    document.getElementById('builderDesktopEditorSlot')?.append(editor);
    document.documentElement.dataset.builderLayout='desktop';
  }
  window.addEventListener('d2synergy:presentationchange',mount);
  window.addEventListener('d2synergy:ready',mount);
  requestAnimationFrame(mount);
})();
