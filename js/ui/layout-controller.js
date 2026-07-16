/* D2Synergy presentation router.
   Loads exactly one presentation family while preserving shared state/data. */
(function(){
  'use strict';
  const BREAKPOINT=900;
  let current=null;
  let generation=0;
  const loaded=new Set();
  const listeners=[];

  function isMobile(){return window.matchMedia(`(max-width:${BREAKPOINT}px), (pointer:coarse) and (max-width:1180px)`).matches;}
  function load(src){
    if(loaded.has(src))return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src=`${src}?v=20260716-sprint1-19`;s.async=false;
      s.onload=()=>{loaded.add(src);resolve();};s.onerror=()=>reject(new Error(`Unable to load ${src}`));document.body.appendChild(s);
    });
  }
  async function mount(){
    const next=isMobile()?'mobile':'desktop';
    if(next===current)return;
    const token=++generation;
    document.documentElement.dataset.presentation=next;
    document.body.classList.toggle('isMobilePresentation',next==='mobile');
    document.body.classList.toggle('isDesktopPresentation',next==='desktop');
    await Promise.all([
      load(`js/ui/${next}/builder-${next}.js`),
      load(`js/ui/${next}/vault-${next}.js`)
    ]);
    if(token!==generation)return;
    current=next;
    window.dispatchEvent(new CustomEvent('d2synergy:presentationchange',{detail:{mode:next}}));
  }
  const mq=window.matchMedia(`(max-width:${BREAKPOINT}px), (pointer:coarse) and (max-width:1180px)`);
  mq.addEventListener?.('change',()=>requestAnimationFrame(mount));
  window.addEventListener('resize',()=>requestAnimationFrame(mount),{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(mount,80),{passive:true});
  window.D2Presentation={mount,get mode(){return current|| (isMobile()?'mobile':'desktop');},breakpoint:BREAKPOINT};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
