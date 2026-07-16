(function(){
  'use strict';
  function enhance(){
    if(document.documentElement.dataset.presentation!=='mobile')return;
    const overlay=document.getElementById('vaultFsOverlay');if(!overlay)return;
    overlay.classList.add('vaultMobilePresentation');overlay.classList.remove('vaultDesktopPresentation');
    document.getElementById('fsBody')?.setAttribute('data-vault-presentation','mobile');
  }
  window.addEventListener('d2synergy:presentationchange',enhance);
  window.addEventListener('d2synergy:vault-rendered',enhance);
  requestAnimationFrame(enhance);
})();
