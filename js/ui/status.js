/* Local workspace freshness indicators. Status stays beside the data it describes. */
(function(){
  'use strict';
  const KEY='d2synergy_workspace_status_v1';
  const scopes=['builder','inventory','activities','vendors','collections'];
  const states={};
  try{Object.assign(states,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(_){ }
  const labels={live:'Live',cached:'Cached',refreshing:'Refreshing',offline:'Offline',error:'Unavailable',ready:'Ready'};
  function now(){return new Date().toISOString();}
  function relative(iso){
    if(!iso)return '';
    const ms=Date.now()-new Date(iso).getTime();
    if(!Number.isFinite(ms)||ms<0)return '';
    const min=Math.floor(ms/60000);
    if(min<1)return 'just now';
    if(min<60)return `${min}m ago`;
    const hr=Math.floor(min/60);if(hr<24)return `${hr}h ago`;
    const day=Math.floor(hr/24);return `${day}d ago`;
  }
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(states));}catch(_){ }}
  function host(scope){return document.querySelector(`[data-status-scope="${scope}"]`);}
  function render(scope){
    const el=host(scope);if(!el)return;
    const value=states[scope]||{state:sessionStorage.getItem('d2synergy_launch_mode')==='offline'?'offline':'cached',detail:'Not refreshed this session'};
    const stamp=value.updatedAt?` · ${relative(value.updatedAt)}`:'';
    el.className=`workspaceLocalStatus is-${value.state||'cached'}`;
    el.replaceChildren();
    const dot=document.createElement('span');dot.className='workspaceStatusDot';dot.setAttribute('aria-hidden','true');
    const strong=document.createElement('strong');strong.textContent=labels[value.state]||String(value.state||'Cached');
    el.append(dot,strong);
    if(value.detail){const detail=document.createElement('span');detail.textContent=` · ${String(value.detail)}`;el.appendChild(detail);}
    if(stamp){const time=document.createElement('time');time.textContent=stamp;el.appendChild(time);}
    const date=value.updatedAt?new Date(value.updatedAt):null;
    el.title=date&&Number.isFinite(date.getTime())?`Last updated ${date.toLocaleString()}`:(value.detail||'');
  }
  function set(scope,state,detail,options={}){
    if(!scopes.includes(scope))return;
    states[scope]={state,detail:detail||'',updatedAt:options.preserveTime?states[scope]?.updatedAt:(options.updatedAt||now())};
    persist();render(scope);
  }
  function refreshing(scope,detail='Refreshing'){set(scope,'refreshing',detail,{preserveTime:true});}
  function fail(scope,detail='Refresh failed'){set(scope,'error',detail,{preserveTime:true});}
  function renderAll(){scopes.forEach(render);}
  window.D2Status={set,refreshing,fail,render:renderAll,get(scope){return states[scope]||null;}};
  window.addEventListener('d2synergy:ready',event=>{
    const offline=event.detail?.mode==='offline';
    set('builder',offline?'offline':'cached',offline?'Local build data':'Waiting for Guardian sync',{preserveTime:!offline});
    renderAll();
  });
  window.addEventListener('d2synergy:syncerror',event=>fail('builder',event.detail?.message||'Guardian sync failed'));
  document.addEventListener('DOMContentLoaded',renderAll,{once:true});

  // Offline Builder mode intentionally does not load Bungie's account module.
  // Provide a lightweight icon fallback so the shared Builder can still
  // render instead of failing on its account-only icon helper dependency.
  if(typeof window.attachLiveIcon!=='function'){
    window.attachLiveIcon=function(container,source,itemType,options={}){
      if(!container||!source)return null;
      const name=String(source?.name||source||'').trim();
      if(!name||container.querySelector('.bungieIconFallback'))return null;
      const fallback=document.createElement('span');fallback.className='bungieIconFallback';
      if(options.size)fallback.style.setProperty('--bungie-icon-size',`${Number(options.size)}px`);
      fallback.textContent=name.split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()||'?';
      fallback.title=`${name} · live icon available after Bungie sign-in`;
      container.insertBefore(fallback,container.firstChild);return fallback;
    };
  }
})();
