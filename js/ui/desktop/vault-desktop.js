(function(){
  'use strict';
  function enhance(){
    if(document.documentElement.dataset.presentation!=='desktop')return;
    const overlay=document.getElementById('vaultFsOverlay');if(!overlay)return;
    overlay.classList.add('vaultDesktopPresentation');overlay.classList.remove('vaultMobilePresentation');
    document.getElementById('fsBody')?.setAttribute('data-vault-presentation','desktop');
  }
  window.addEventListener('d2synergy:presentationchange',enhance);
  window.addEventListener('d2synergy:vault-rendered',enhance);
  requestAnimationFrame(enhance);
})();
