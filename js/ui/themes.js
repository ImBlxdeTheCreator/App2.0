/* D2Synergy Legacy Themes — persistent, previewable application theming. */
(function(){
  'use strict';
  const STORAGE_KEY='d2synergy_legacy_theme';
  const AMBIENT_KEY='d2synergy_ambient_effects';
  const THEMES=[
    {id:'original',name:'D2Synergy Original',era:'Default',swatches:['#d4af37','#52d9ff','#12161b']},
    {id:'red-war',name:'The Red War',era:'Year 1',swatches:['#d75a46','#f0b46b','#15171c']},
    {id:'curse-osiris',name:'Curse of Osiris',era:'Year 1',swatches:['#c98b3c','#f1d38b','#17130e']},
    {id:'warmind',name:'Warmind',era:'Year 1',swatches:['#b64f38','#eaa071','#151316']},
    {id:'forsaken',name:'Forsaken',era:'Year 2',swatches:['#6c75a8','#c2a464','#12131a']},
    {id:'shadowkeep',name:'Shadowkeep',era:'Year 3',swatches:['#b23f4b','#ded7cf','#151012']},
    {id:'beyond-light',name:'Beyond Light',era:'Year 4',swatches:['#5db7d4','#b8e4ef','#0d151a']},
    {id:'witch-queen',name:'The Witch Queen',era:'Year 5',swatches:['#73b49b','#e8dbc6','#101715']},
    {id:'lightfall',name:'Lightfall',era:'Year 6',swatches:['#e452a5','#55d9da','#17101a']},
    {id:'final-shape',name:'The Final Shape',era:'Year 7',swatches:['#f0d6b4','#b690cf','#151316']},
    {id:'prophecy',name:'Year of Prophecy',era:'Year 8',swatches:['#e77e45','#78b7d5','#141417']}
  ];
  const valid=new Set(THEMES.map(theme=>theme.id));

  function read(key,fallback){try{return localStorage.getItem(key)||fallback;}catch(e){return fallback;}}
  function write(key,value){try{localStorage.setItem(key,value);}catch(e){}}
  function applyTheme(id,{persist=true,preview=false}={}){
    const chosen=valid.has(id)?id:'original';
    document.documentElement.dataset.theme=chosen;
    document.documentElement.dataset.themePreview=preview?'true':'false';
    const meta=document.querySelector('meta[name="theme-color"]');
    const theme=THEMES.find(item=>item.id===chosen)||THEMES[0];
    if(meta)meta.content=theme.swatches[2];
    if(persist)write(STORAGE_KEY,chosen);
    window.dispatchEvent(new CustomEvent('d2synergy:themechange',{detail:{theme:chosen,preview}}));
    return chosen;
  }
  function applyAmbient(enabled,{persist=true}={}){
    const on=enabled===true||enabled==='true';
    document.documentElement.dataset.ambient=on?'on':'off';
    if(persist)write(AMBIENT_KEY,String(on));
    return on;
  }
  function render(container){
    if(!container)return;
    const active=read(STORAGE_KEY,'original');
    container.replaceChildren(...THEMES.map(theme=>{
      const button=document.createElement('button');
      button.type='button';button.className='themePreviewCard';button.dataset.themeChoice=theme.id;button.style.setProperty('--preview-accent',theme.swatches[0]);button.style.setProperty('--preview-accent-2',theme.swatches[1]);button.style.setProperty('--preview-bg',theme.swatches[2]);
      button.setAttribute('aria-pressed',String(theme.id===active));
      button.innerHTML=`<span class="themePreviewScene" aria-hidden="true"><span class="themePreviewGlow"></span><span class="themePreviewLine"></span><span class="themePreviewBar"></span></span><span class="themePreviewInfo"><strong>${theme.name}</strong><small>${theme.era}</small><span class="themeSwatches">${theme.swatches.map(color=>`<i style="--swatch:${color}"></i>`).join('')}</span></span>`;
      button.addEventListener('mouseenter',()=>applyTheme(theme.id,{persist:false,preview:true}));
      button.addEventListener('focus',()=>applyTheme(theme.id,{persist:false,preview:true}));
      button.addEventListener('mouseleave',()=>applyTheme(read(STORAGE_KEY,'original'),{persist:false,preview:false}));
      button.addEventListener('blur',()=>applyTheme(read(STORAGE_KEY,'original'),{persist:false,preview:false}));
      button.addEventListener('click',()=>{
        applyTheme(theme.id);
        container.querySelectorAll('[data-theme-choice]').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));
      });
      return button;
    }));
  }
  function initialize(){
    applyTheme(read(STORAGE_KEY,'original'),{persist:false});
    applyAmbient(read(AMBIENT_KEY,'true')!=='false',{persist:false});
    const grid=document.getElementById('legacyThemeGrid');
    render(grid);
    const ambient=document.getElementById('settingAmbient');
    if(ambient){ambient.checked=document.documentElement.dataset.ambient!=='off';ambient.addEventListener('change',()=>applyAmbient(ambient.checked));}
  }
  window.D2Themes={THEMES,applyTheme,applyAmbient,render,initialize};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
