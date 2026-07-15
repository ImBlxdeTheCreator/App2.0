/* D2Synergy workspace navigation. Existing features remain the source of truth. */
(function(){
  'use strict';
  const nav=document.getElementById('workspaceNav');
  const placeholder=document.getElementById('workspacePlaceholder');
  if(!nav)return;
  const labels={
    fireteam:['Fireteam','Fireteam composition, buff overlap, champion coverage, and role planning will live here.'],
    collections:['Collections','A focused browser for owned gear, patterns, cosmetics, and records is being prepared.'],
    fashion:['Fashion','Shaders, ornaments, transmog, and saved appearance sets will live here.']
  };
  function activate(name){
    nav.querySelectorAll('[data-workspace]').forEach(b=>b.classList.toggle('active',b.dataset.workspace===name));
    localStorage.setItem('d2synergy_workspace',name);
  }
  function closePlaceholder(){placeholder.hidden=true;placeholder.innerHTML='';}
  nav.addEventListener('click',e=>{
    const b=e.target.closest('[data-workspace]');if(!b)return;
    const name=b.dataset.workspace;activate(name);closePlaceholder();
    if(name==='command'){window.scrollTo({top:0,behavior:'smooth'});return;}
    if(name==='inventory'&&typeof openFullScreenVault==='function'){openFullScreenVault();return;}
    if(name==='builder'){document.getElementById('builderCol')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    if(name==='loadouts'){document.getElementById('loadoutsBtn')?.click();return;}
    if(name==='operations'&&typeof openActivitiesWindow==='function'){openActivitiesWindow();return;}
    if(labels[name]){
      const [title,text]=labels[name];placeholder.hidden=false;
      placeholder.innerHTML=`<section class="workspaceEmpty"><img src="assets/brand/ghost-loader.webp" alt=""><div><h2>${title}</h2><p>${text}</p><small>This workspace is staged without changing current working features.</small></div></section>`;
      placeholder.scrollIntoView({behavior:'smooth',block:'start'});
    }
  });
  activate(localStorage.getItem('d2synergy_workspace')||'command');
})();
