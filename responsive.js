// Layout/accessibility only. No snapshot, filter or network mutations.
export function setupResponsive({doc=document,map,onLayoutChange=()=>{},media=globalThis.matchMedia?.('(max-width: 800px)'),viewport=globalThis.visualViewport}){
  const $=id=>doc.getElementById(id),root=doc.documentElement;let narrow=!!media?.matches,opened=false,resizing=false,desktopOpened=true;
  const minSidebar=280,maxSidebar=520,storedSidebarWidth=()=>{try{return Number(localStorage.getItem('atlas690-sidebar-width'));}catch{return NaN;}};
  const sidebarWidth=width=>Math.max(minSidebar,Math.min(maxSidebar,Math.round(width)));
  function setSidebarWidth(width,{persist=true}={}){
    const limit=Math.max(minSidebar,Math.min(maxSidebar,(globalThis.innerWidth||Infinity)*.48)),value=Math.max(minSidebar,Math.min(limit,sidebarWidth(width)));
    root?.style?.setProperty('--side',value+'px');
    if(persist)try{localStorage.setItem('atlas690-sidebar-width',String(value));}catch{/* Local preference is optional. */}
    map.resize?.();map.draw();
  }
  const close=()=>setSidebar(false);
  function setSidebar(value,focus=false){
    if(narrow){
      opened=!!value;
      $('sidebar').classList.toggle('open',opened);$('sidebar').inert=!opened;
      $('sidebar').setAttribute('aria-hidden',!opened);
      $('map-area').inert=opened;$('detail').inert=opened;
      $('menu-shade').hidden=!opened;$('menu').setAttribute('aria-expanded',opened);$('open-sidebar').hidden=true;
      if(root?.dataset)root.dataset.sidebarCollapsed='false';
      if(focus&&opened)$('close-menu').focus();
      if(focus&&!opened)$('menu').focus();
      return;
    }
    desktopOpened=!!value;
    $('sidebar').classList.toggle('open',false);$('sidebar').inert=!desktopOpened;
    $('sidebar').setAttribute('aria-hidden',!desktopOpened);
    $('map-area').inert=false;$('detail').inert=false;
    $('menu-shade').hidden=true;$('menu').setAttribute('aria-expanded',false);$('open-sidebar').hidden=desktopOpened;
    if(root?.dataset)root.dataset.sidebarCollapsed=desktopOpened?'false':'true';
    if(focus)(desktopOpened?$('close-menu'):$('open-sidebar')).focus();
    map.resize?.();map.draw();
  }
  function syncViewport(){
    const height=viewport?.height??globalThis.innerHeight;
    if(Number.isFinite(height)&&(!viewport.scale||viewport.scale===1)){
      doc.documentElement?.style.setProperty('--app-height',height+'px');
      if(doc.documentElement)doc.documentElement.dataset.shortViewport=height<500?'true':'false';
    }
    map.rulerFontSize=narrow?12:9;
    const canvas=$('map').getBoundingClientRect(),controls=$('map-controls').getBoundingClientRect(),footer=$('map-bottom').getBoundingClientRect();
    const reserved=controls.height>80?footer.height+14:canvas.bottom-controls.top+14;
    map.rulerBottom=narrow&&Number.isFinite(reserved)?Math.max(57,Math.min(canvas.height-80,reserved)):57;
    map.draw();
  }
  function applyLayout(){
    if(narrow)setSidebar(false);
    else {setSidebar(desktopOpened);const saved=storedSidebarWidth();if(Number.isFinite(saved))setSidebarWidth(saved,{persist:false});}
    map.aimHover=narrow;map.hovered=null;map.hoveredCell=null;
    $('plan-note').open=!narrow;
    // Collapsible sections, not removed features or changed filter values.
    if(narrow)for(const section of doc.querySelectorAll('.quick-tools,.layers,.terrain-tools'))section.open=false;
    syncViewport();
  }
  const change=event=>{narrow=event.matches;applyLayout();onLayoutChange();};
  const resize=()=>{syncViewport();const active=doc.activeElement;if(opened&&active?.matches?.('input,select,textarea'))active.scrollIntoView?.({block:'nearest'});};
  const beginResize=event=>{
    if(narrow||event.button!==0)return;
    resizing=true;$('sidebar-resizer').classList.toggle('resizing',true);doc.body?.classList?.toggle('sidebar-resizing',true);$('sidebar-resizer').setPointerCapture?.(event.pointerId);event.preventDefault?.();
  };
  const moveResize=event=>{
    if(!resizing)return;
    const rightToLeft=root?.dir==='rtl',width=rightToLeft?(globalThis.innerWidth-event.clientX):event.clientX;setSidebarWidth(width);
  };
  const endResize=event=>{
    if(!resizing)return;
    resizing=false;$('sidebar-resizer').classList.toggle('resizing',false);doc.body?.classList?.toggle('sidebar-resizing',false);$('sidebar-resizer').releasePointerCapture?.(event.pointerId);
  };
  $('menu').addEventListener('click',()=>setSidebar(!opened,true));
  $('close-menu').addEventListener('click',()=>setSidebar(false,true));
  $('open-sidebar').addEventListener('click',()=>setSidebar(true,true));
  $('menu-shade').addEventListener('click',()=>setSidebar(false,true));
  $('sidebar-resizer').addEventListener('pointerdown',beginResize);$('sidebar-resizer').addEventListener('pointermove',moveResize);$('sidebar-resizer').addEventListener('pointerup',endResize);$('sidebar-resizer').addEventListener('pointercancel',endResize);
  media?.addEventListener?.('change',change);viewport?.addEventListener?.('resize',resize);
  globalThis.addEventListener?.('resize',resize);
  applyLayout();
  return {get narrow(){return narrow;},setSidebar,close,syncViewport,setSidebarWidth,dispose(){media?.removeEventListener?.('change',change);viewport?.removeEventListener?.('resize',resize);globalThis.removeEventListener?.('resize',resize);}};
}
