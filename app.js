import {LAYERS,QUICK_FILTERS,quickLayers,normalize,category,glyph,name,displayName,visualPosition,objectFootprint,coordinateCell,originKingdom,isForeign,filterMapRows,tabLayers,sprite,allianceColor,validateSnapshot} from './logic.js';
import {WorldMap} from './map.js';
import {decodeTerrain,checkFootprint,verifyOriginalTerrain,validateSiteZones} from './terrain.js';
import {validMapPoint,mapDistance,mapZone,overlapsZone,snapshotAge} from './map_tools.js';
import {setupResponsive} from './responsive.js';
import {initializeI18n,t,formatNumber,formatDate,formatTime,translateSource} from './i18n.js';

const $=id=>document.getElementById(id);
const msg=(key,fallback,variables={})=>{const translated=t(key,variables);return translated===key?String(fallback).replace(/{{\s*([\w.-]+)\s*}}/g,(_,name)=>variables[name]??''):translated;};
const loadStored=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};
const saveStored=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{toast(msg('storage.unavailable','Le navigateur ne permet pas la sauvegarde locale.'));}};
let world,allRows=[],filtered=[],results=[],alliances=new Map(),tab='all',selected=null,limit=100,timer=null,poll=null,lastRefresh='idle';
let terrain=null,freshnessTimer=null,zoneLimit=100,mobileUI=null,canRefresh=false;
const pageSize=()=>mobileUI?.narrow?20:100;
const favorites=new Set(loadStored('atlas690-favorites',[]));
const customColors=loadStored('atlas690-colors',{});
const homeStorageKey='atlas690-home-castle';
let homeId=loadStored(homeStorageKey,null),locatedHome=false;
if(typeof homeId!=='string')homeId=null;
const filters={query:'',alliance:'',min:0,max:0,invasions:false,origin:'',kingdom:690,quick:'everything',layers:tabLayers('all')};
const quickButtons=new Map();
const map=new WorldMap($('map'),{
  select:(row,center=true)=>select(row,center),
  coordinates:p=>{const cell=coordinateCell(p.x,p.y);$('coordinates').textContent=cell.x>=0&&cell.y>=0&&cell.x<1200&&cell.y<1200?`X ${cell.x} · Y ${cell.y}`:'Hors du royaume';},
  color:row=>allianceColor(row,alliances,customColors),
  inspect:(x,y)=>inspectTerrain(x,y),
  toolChange:()=>{zoneLimit=pageSize();renderTools(true);}
});
mobileUI=setupResponsive({map,onLayoutChange:()=>{limit=pageSize();zoneLimit=pageSize();if(world){renderResults();renderTools();}}});
limit=zoneLimit=pageSize();
map.showHoverCoordinates=loadStored('atlas690-hover-coordinates',true)!==false;
$('hover-coordinates').checked=map.showHoverCoordinates;
map.showRoyalGround=loadStored('atlas690-royal-ground',true)!==false;
$('royal-ground').checked=map.showRoyalGround;
$('show-freshness').checked=loadStored('atlas690-show-freshness',false)===true;
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
function toast(message){clearTimeout(timer);$('toast').textContent=message;$('toast').hidden=false;timer=setTimeout(()=>$('toast').hidden=true,3500);}
async function copy(value){try{await navigator.clipboard.writeText(value);toast(msg('clipboard.copied','Copié dans le presse-papiers.'));}catch{toast(msg('clipboard.unavailable','Copie indisponible ; sélectionnez les coordonnées dans la fiche.'));}}
function action(label,handler,cls=''){const node=el('button',cls,label);node.type='button';node.addEventListener('click',handler);return node;}
async function loadTerrain(){
  try{const response=await fetch('./data/terrain-mask.json',{cache:'no-store'});if(!response.ok)throw new Error();const spec=await response.json();await verifyOriginalTerrain(spec);terrain=decodeTerrain(spec);$('terrain-result').textContent=msg('terrain.ready','Masque original 1200² · fichier identique au cache de l’émulateur. Choisissez une ancre X,Y.');}
  catch{terrain=null;map.showObstacles=false;map.draw();$('obstacles').checked=false;$('terrain-result').textContent=msg('terrain.unavailable','Masque indisponible : aucun avis de placement possible.');}
}
function refreshTerrainStatus(){
  if(!terrain){$('terrain-result').textContent=msg('terrain.unavailable','Masque indisponible : aucun avis de placement possible.');return;}
  const x=$('terrain-x').value,y=$('terrain-y').value;
  if($('terrain-result').dataset.status&&x!==''&&y!==''){inspectTerrain(Number(x),Number(y));return;}
  $('terrain-result').textContent=msg('terrain.ready','Masque original 1200² · fichier identique au cache de l’émulateur. Choisissez une ancre X,Y.');
}
function inspectTerrain(x,y,center=false){
  if(!terrain){toast(msg('terrain.unavailable_toast','Masque de terrain indisponible.'));return;}
  const result=checkFootprint(terrain,x,y);map.probe=result;$('terrain-x').value=x;$('terrain-y').value=y;
  const summary=result.status==='static_exclusion'?msg('terrain.static_exclusion','Exclusion statique : {{reasons}}',{reasons:[...new Set(result.reasons.map(r=>translateSource(r.name)))].join(', ')}):result.status==='unknown'?msg('terrain.unknown','Catégorie de terrain non établie.'):msg('terrain.clear','Aucune exclusion dans ce masque ; autres conditions non vérifiées.');
  $('terrain-result').textContent=msg('terrain.result',`Ancre ${x},${y} · empreinte 2×2. ${summary} TP non validé.`,{x,y,summary});
  $('terrain-result').dataset.status=result.status;
  if(center)map.center(x+(map.plan?1:.5),y+(map.plan?1:.5),Math.max(12,map.zoom));else map.draw();
}
async function loadSiteZones(){
  try{if(!terrain)throw new Error();const response=await fetch('./data/site-zones.json',{cache:'no-store'});if(!response.ok)throw new Error();map.siteZones=validateSiteZones(await response.json());map.draw();}
  catch{map.siteZones=null;$('site-zones').checked=false;$('site-zones').disabled=true;map.draw();}
}

for(const [key,label,color] of LAYERS){
  const localizedLabel=translateSource(label);
  const wrapper=el('label','layer'),input=el('input');input.type='checkbox';input.checked=filters.layers[key];input.dataset.layer=key;input.setAttribute('aria-label',localizedLabel);
  const dot=el('span','swatch');dot.style.backgroundColor=color;wrapper.append(input,dot,el('span','',localizedLabel));$('layers').append(wrapper);
  input.addEventListener('change',()=>{filters.quick='';filters.layers[key]=input.checked;update();});
}
function applyTabLayers(){filters.layers=filters.quick?quickLayers(filters.quick):tabLayers(tab,allRows,favorites);for(const input of $('layers').querySelectorAll('input'))input.checked=filters.layers[input.dataset.layer];}
for(const [i,preset] of QUICK_FILTERS.entries()){
  const button=action(translateSource(preset.label),()=>preset.unfiltered?showEverything():setTab('buildings',filters.quick===preset.id?'':preset.id),'quick-filter');
  button.dataset.quick=preset.id;button.setAttribute('aria-pressed','false');quickButtons.set(preset.id,button);
  $(i<7?'quick-filters':'quick-filters-more').append(button);
}

async function loadWorld(){
  const response=await fetch('./data/world.json',{cache:'no-store'});if(!response.ok)throw new Error(msg('snapshot.unavailable','Instantané local indisponible.'));
  world=validateSnapshot(await response.json());
  allRows=[...world.castles,...world.buildings,...(world.fixed || []).map(row=>({...row,kind:'fixed'}))];
  $('all-count').textContent=formatNumber(allRows.length);
  alliances=new Map(world.alliances.map(a=>[String(a.id),a]));
  $('players-count').textContent=formatNumber(world.castles.length);$('buildings-count').textContent=formatNumber(world.buildings.length);
  const outsiders=world.castles.filter(c=>isForeign(c,world.meta.kingdom)),unknown=world.castles.filter(c=>originKingdom(c)===null).length;
  $('invasions-count').textContent=formatNumber(outsiders.length);
  $('invasion-summary').textContent=msg('invasion.summary',`${outsiders.length} envahisseur${outsiders.length>1?'s':''} repéré${outsiders.length>1?'s':''} (origine extérieure) · ${unknown} origine${unknown>1?'s':''} inconnue${unknown>1?'s':''}.`,{outsiders:formatNumber(outsiders.length),unknown:formatNumber(unknown),outsiderPlural:outsiders.length>1?'s':'',unknownPlural:unknown>1?'s':''});
  $('origin-kingdom').replaceChildren(el('option','',t('origin.all')));$('origin-kingdom').firstChild.value='';
  for(const origin of [...new Set(outsiders.map(originKingdom))].sort((a,b)=>a-b)){const option=el('option','',t('origin.option',{kingdom:origin}));option.value=origin;$('origin-kingdom').append(option);}
  $('origin-kingdom').value=filters.origin;
  $('alliance').replaceChildren(el('option','',t('alliance.none')));$('alliance').firstChild.value='';
  for(const a of world.alliances){const alliance=a.abbr?`[${a.abbr}]`:t('detail.alliance')+' '+a.id;const option=el('option','',t('alliance.option',{alliance,count:formatNumber(a.castles)}));option.value=a.id;$('alliance').append(option);}
  $('alliance').value=filters.alliance;
  const stamp=world.meta.updated_at_utc?new Date(world.meta.updated_at_utc):null;
  $('snapshot-date').textContent=(world.meta.source_complete?t('status.snapshot')+' · ':t('status.partial')+' · ')+(stamp?formatDate(stamp,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):t('status.unknown_date'));
  updateFreshness();
  const owned=world.buildings.filter(b=>b.alliance_id).length;
  const traps=world.buildings.filter(b=>b.type===33).length;
  $('map-summary').textContent=t('map.summary',{castles:formatNumber(world.castles.length),owned:formatNumber(owned),traps:formatNumber(traps),partial:world.meta.source_complete?'':t('map.partial')});
  if(tab==='favorites')applyTabLayers();update();$('loading').hidden=true;
  if(selected){const renewed=allRows.find(row=>row.id===selected.id);if(renewed)select(renewed,false);else{$('detail').hidden=true;selected=map.selected=null;}}
}
function renderLocaleDependentWorldUI(){
  if(!world)return;
  const outsiders=world.castles.filter(c=>isForeign(c,world.meta.kingdom)),unknown=world.castles.filter(c=>originKingdom(c)===null).length;
  $('invasion-summary').textContent=msg('invasion.summary',`${outsiders.length} envahisseur${outsiders.length>1?'s':''} repéré${outsiders.length>1?'s':''} (origine extérieure) · ${unknown} origine${unknown>1?'s':''} inconnue${unknown>1?'s':''}.`,{outsiders:formatNumber(outsiders.length),unknown:formatNumber(unknown),outsiderPlural:outsiders.length>1?'s':'',unknownPlural:unknown>1?'s':''});
  $('origin-kingdom').replaceChildren(el('option','',t('origin.all')));$('origin-kingdom').firstChild.value='';
  for(const origin of [...new Set(outsiders.map(originKingdom))].sort((a,b)=>a-b)){const option=el('option','',t('origin.option',{kingdom:origin}));option.value=origin;$('origin-kingdom').append(option);}
  $('origin-kingdom').value=filters.origin;
  $('alliance').replaceChildren(el('option','',t('alliance.none')));$('alliance').firstChild.value='';
  for(const a of world.alliances){const alliance=a.abbr?`[${a.abbr}]`:t('detail.alliance')+' '+a.id;const option=el('option','',t('alliance.option',{alliance,count:formatNumber(a.castles)}));option.value=a.id;$('alliance').append(option);}
  $('alliance').value=filters.alliance;
  const stamp=world.meta.updated_at_utc?new Date(world.meta.updated_at_utc):null;
  $('snapshot-date').textContent=(world.meta.source_complete?t('status.snapshot')+' · ':t('status.partial')+' · ')+(stamp?formatDate(stamp,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):t('status.unknown_date'));
  const owned=world.buildings.filter(b=>b.alliance_id).length,traps=world.buildings.filter(b=>b.type===33).length;
  $('map-summary').textContent=t('map.summary',{castles:formatNumber(world.castles.length),owned:formatNumber(owned),traps:formatNumber(traps),partial:world.meta.source_complete?'':t('map.partial')});
  updateFreshness();
}
function update(){
  if(!world)return;
  filtered=filterMapRows(allRows,filters,tab,favorites);
  if(selected&&!filtered.some(row=>row.id===selected.id)){$('detail').hidden=true;selected=map.selected=null;}
  const home=homeRow();map.homeTarget=locatedHome&&home&&!filtered.some(row=>row.id===home.id)?home:null;
  map.setRows(filtered);
  updateHomeButton();
  results=filtered.filter(row=>tab==='all'?true:tab==='players'?category(row)==='players':tab==='invasions'?isForeign(row,world.meta.kingdom):tab==='buildings'?row.uid==null: favorites.has(row.id));
  // Populated alliances and owned buildings first; no fabricated ranks.
  results.sort((a,b)=>{
    const players=(b.level||0)-(a.level||0)||normalize(name(a)).localeCompare(normalize(name(b)));
    if(tab==='players'||tab==='invasions')return players;
    if(tab==='all'&&(a.uid!=null||b.uid!=null))return Number(b.uid!=null)-Number(a.uid!=null)||players;
    return Number(!!b.alliance_id)-Number(!!a.alliance_id)||(a.type??0)-(b.type??0)||a.x-b.x||a.y-b.y;
  });
  const activeLayers=LAYERS.filter(([key])=>filters.layers[key]).map(([,label])=>translateSource(label));
  const quick=QUICK_FILTERS.find(p=>p.id===filters.quick);
  for(const [id,button] of quickButtons){const active=id===filters.quick;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active);}
  const scope=tab==='favorites'?t('scope.favorites'):tab==='invasions'?t('scope.invaders'):quick?translateSource(quick.label):t('scope.map');
  $('scope-summary').textContent=t('scope.summary',{scope,layers:activeLayers.join(', ')||t('scope.no_layers')});
  limit=pageSize();renderResults();$('empty-map').hidden=filtered.length>0||!!map.homeTarget;$('empty-message').textContent=tab==='invasions'?msg('empty.invaders','Aucun envahisseur connu avec ces filtres.'):tab==='favorites'?msg('empty.favorites','Aucun favori avec ces filtres. Ajoutez une étoile depuis une fiche.'):msg('empty.general','Aucun objet avec ces filtres.');
  renderTools();
}
function updateFreshness(){
  const show=$('show-freshness').checked;$('snapshot-age').hidden=!show;$('snapshot-info').hidden=!show;
  if(!show){if(freshnessTimer)clearInterval(freshnessTimer);freshnessTimer=null;return;}
  const stamp=world?.meta.updated_at_utc;
  $('snapshot-age').textContent=msg('snapshot.age',snapshotAge(stamp)+(world?.meta.source_complete===false?' · lecture partielle':'')+' · pas en temps réel',{age:snapshotAge(stamp),partial:world?.meta.source_complete===false?msg('map.partial',' · lecture partielle'):'',realtime:msg('snapshot.not_realtime','pas en temps réel')});
  const time=stamp?new Date(stamp):null;
  $('snapshot-age').title=time&&Number.isFinite(time.getTime())?msg('snapshot.timestamp','Horodatage de l’instantané : '+time.toLocaleString('fr-FR',{timeZone:'Europe/Paris'})+' (Paris). Lecture séquentielle ; chaque objet peut avoir été observé avant cette date.',{time:formatDate(time,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Paris'})}):msg('snapshot.timestamp_unknown','Horodatage indisponible.');
  $('snapshot-age-date').textContent=$('snapshot-age').title;
  if(!freshnessTimer){freshnessTimer=setInterval(updateFreshness,60000);freshnessTimer?.unref?.();}
}
function setMapTool(mode){
  if(mode){map.inspectMode=false;$('inspect-terrain').checked=false;}
  map.setTool(mode);
}
function renderTools(syncInputs=false){
  const mode=map.toolMode,points=map.toolPoints;
  if(world)$('empty-map').hidden=filtered.length>0||!!map.homeTarget||!!mode;
  $('tool-map-note').hidden=!mode;
  $('tool-map-hint').textContent=msg('tool.map_hint',(mode==='distance'?'Distance':'Zone')+' · '+(points.length<2?'choisissez '+(points.length?'B':'A'):'deux points définis · clic pour recommencer'),{mode:mode==='distance'?msg('tool.distance','Distance'):msg('tool.area','Zone'),state:points.length<2?msg('tool.choose_point','choisissez {{point}}',{point:points.length?'B':'A'}):msg('tool.restart','deux points définis · clic pour recommencer')});
  for(const [id,value] of [['tool-none',''],['tool-distance','distance'],['tool-zone','zone']]){const active=mode===value;$(id).setAttribute('aria-pressed',active);$(id).classList.toggle('active',active);}
  $('tool-panel').hidden=!mode;$('zone-panel').hidden=mode!=='zone';
  $('tool-hint').textContent=mode==='zone'?msg('tool.zone_hint','Cliquez sur deux coins pour sélectionner les cases entre eux. Glisser déplace toujours la carte.'):msg('tool.distance_hint','Cliquez sur deux lieux : objet visible ou case libre. Glisser déplace toujours la carte.');
  if(syncInputs)for(const [index,prefix] of [[0,'a'],[1,'b']])for(const axis of ['x','y'])$('tool-'+prefix+'-'+axis).value=points[index]?.[axis]??'';
  if(!mode)return;
  const label=p=>`${p.label?p.label+' · ':''}X ${p.x} / Y ${p.y}`;
  if(points.length<2){$('tool-output').textContent=points.length?msg('tool.choose_b','A: {{a}} · choose B.',{a:label(points[0])}):msg('tool.choose_ab','Choose A then B, or enter their coordinates.');}
  else if(mode==='distance'){
    const distance=mapDistance(...points);
    $('tool-output').textContent=msg('tool.distance_result',`${distance.cases.toLocaleString('fr-FR',{maximumFractionDigits:2})} cases en ligne droite · écart X ${Math.abs(distance.dx)} / Y ${Math.abs(distance.dy)}. A : ${label(points[0])}. B : ${label(points[1])}. Coordonnées d’ancre pour les objets ; ni trajet ni temps de marche.`,{distance:formatNumber(distance.cases,{maximumFractionDigits:2}),dx:Math.abs(distance.dx),dy:Math.abs(distance.dy),a:label(points[0]),b:label(points[1])});
  }else {
    const zone=mapZone(...points);$('tool-output').textContent=msg('tool.zone_result',`Zone : X ${zone.minX}–${zone.maxX} / Y ${zone.minY}–${zone.maxY} · ${zone.width}×${zone.height} cases (bornes incluses).`,zone);
  }
  if(mode!=='zone')return;
  const zone=points.length===2?mapZone(...points):null,rows=zone?filtered.filter(row=>overlapsZone(row,zone)):[];
  const players=rows.filter(row=>row.uid!=null).length,fixed=rows.filter(row=>row.kind==='fixed').length,groups=new Map();
  for(const row of rows)if(row.alliance_id){const key=String(row.alliance_id),group=groups.get(key)??{name:row.alliance_abbr?'['+row.alliance_abbr+']':'Alliance '+key,count:0};group.count++;groups.set(key,group);}
  $('zone-summary').textContent=zone?msg('zone.summary',`${rows.length.toLocaleString('fr')} objets · ${players} joueurs · ${rows.length-players-fixed} bâtiments · ${fixed} sites fixes · ${groups.size} alliances. Filtres actifs conservés ; empreintes intersectant la zone (ancre seule si taille inconnue).`,{objects:formatNumber(rows.length),players:formatNumber(players),buildings:formatNumber(rows.length-players-fixed),fixed:formatNumber(fixed),alliances:formatNumber(groups.size)}):msg('zone.awaiting','La liste apparaîtra après le choix des deux coins.');
  $('zone-alliances').textContent=[...groups.values()].sort((a,b)=>b.count-a.count).map(g=>`${g.name} : ${g.count}`).join(' · ');
  $('zone-results').replaceChildren();
  for(const row of rows.slice(0,zoneLimit)){const button=el('button','zone-result');button.type='button';button.dataset.id=row.id;button.append(el('span','result-name',displayName(row)),el('span','result-meta',`X ${row.x} · Y ${row.y}`));button.addEventListener('click',()=>{select(row);mobileUI.close();});$('zone-results').append(button);}
  if(zone&&!rows.length)$('zone-results').append(el('p','empty',msg('zone.empty','Aucun objet connu correspondant aux filtres dans cette zone.')));
  $('zone-more').hidden=rows.length<=zoneLimit;
}
for(const [id,mode] of [['tool-none',''],['tool-distance','distance'],['tool-zone','zone']])$(id).addEventListener('click',()=>setMapTool(map.toolMode===mode?'':mode));
$('tool-clear').addEventListener('click',()=>map.clearTool());
$('tool-stop').addEventListener('click',()=>setMapTool(''));
$('zone-more').addEventListener('click',()=>{zoneLimit+=pageSize();renderTools();});
$('show-freshness').addEventListener('change',()=>{saveStored('atlas690-show-freshness',$('show-freshness').checked);updateFreshness();});
$('tool-form').addEventListener('submit',event=>{
  event.preventDefault();const values=['a','b'].map(prefix=>['x','y'].map(axis=>$('tool-'+prefix+'-'+axis).value));
  const points=values.map(([x,y])=>({x:Number(x),y:Number(y)}));
  if(values.flat().some(v=>String(v).trim()==='')||!points.every(validMapPoint)){toast(msg('coordinates.invalid_pair','Saisissez deux coordonnées entières entre 0 et 1199.'));return;}
  map.setToolPoints(points);
});
function renderResults(){
  $('result-count').textContent=t('result.count',{count:results.length,formattedCount:formatNumber(results.length)});
  $('results').replaceChildren();
  if(!results.length){$('results').append(el('p','empty',tab==='invasions'?msg('results.empty_invaders','Aucun envahisseur repéré avec ces filtres. Cet instantané ne garantit pas l’absence de joueurs d’un autre royaume.'):tab==='favorites'?msg('results.empty_favorites','Ajoutez une étoile depuis une fiche pour retrouver vos lieux favoris.'):msg('results.empty','Aucun résultat. Essayez un nom, un UID ou une autre alliance.')));}
  for(const row of results.slice(0,limit)){
    const button=el('button','result'+(selected?.id===row.id?' selected':''));button.type='button';button.dataset.id=row.id;
    const icon=el('span','result-glyph',glyph(row));icon.style.color=allianceColor(row,alliances,customColors);
    if(row.uid==null&&sprite(row)){const image=el('img');image.src='./assets/'+sprite(row);image.alt='';icon.replaceChildren(image);}
    const info=el('span','result-info');info.append(el('span','result-name',displayName(row)),el('span','result-meta',tab==='invasions'?msg('result.origin_coordinates','Origin K{{kingdom}} · X {{x}} · Y {{y}}',{kingdom:originKingdom(row),x:row.x,y:row.y}):`X ${row.x} · Y ${row.y}`));
    button.append(icon,info,el('span','result-level',row.level?t('result.level',{level:row.level}):row.alliance_id?t('detail.alliance'):''));
    button.setAttribute('aria-label',`${displayName(row)}, X ${row.x}, Y ${row.y}`);
    button.addEventListener('click',()=>{if(map.toolMode==='distance')map.addToolPoint({x:row.x,y:row.y,label:displayName(row)});else select(row);mobileUI.close();});$('results').append(button);
  }
  $('more').hidden=limit>=results.length;
}
function stat(container,label,value){const group=el('div');group.append(el('dt','',label),el('dd','',value));container.append(group);}
function select(row,center=true){
  selected=row;map.selected=row;const position=map.objectPosition(row);if(center)map.center(position.x,position.y,Math.max(map.zoom,map.plan?24:7));else map.draw();
  $('detail').hidden=false;const content=$('detail-content');content.replaceChildren();
  const file=sprite(row);if(file){const art=el('div','detail-art'),image=el('img');image.src='./assets/'+file;image.alt=file==='building2001-rgba-source-known.png'?msg('art.royal','Image originale détaillée du Château Royal, sans bouclier'):row.art_kind==='original-scene-sprite'?msg('art.major_fort','Sprite original du fort majeur extrait du cache du jeu'):row.kind==='fixed'?msg('art.fixed','Logo original de mini-carte extrait du cache du jeu'):msg('art.building','Illustration du bâtiment à partir des sprites récupérés');art.append(image);content.append(art);}
  content.append(el('span','eyebrow',row.uid!=null?(isForeign(row)?msg('detail.foreign_player','JOUEUR D’UN AUTRE ROYAUME'):msg('detail.player_castle','CHÂTEAU DE JOUEUR')):row.kind==='fixed'?msg('detail.kingdom_site','SITE DU ROYAUME'):msg('detail.alliance_building','BÂTIMENT D’ALLIANCE')),el('h2','',displayName(row)));
  const badge=el('span','alliance-badge'),dot=el('span','color-dot');dot.style.backgroundColor=allianceColor(row,alliances,customColors);
  badge.append(dot,document.createTextNode(row.alliance_abbr?'['+row.alliance_abbr+']':row.alliance_id?msg('detail.alliance_id','Alliance {{id}}',{id:row.alliance_id}):msg('detail.no_alliance','Sans alliance connue')));content.append(badge);
  const stats=el('dl','detail-stats');stat(stats,msg('detail.position','POSITION'),`${row.x}, ${row.y}`);stat(stats,msg('detail.kingdom','ROYAUME'),'690');
  const footprint=objectFootprint(row);
  stat(stats,msg('detail.footprint','EMPREINTE'),footprint.known?msg('detail.footprint_value',`${footprint.width}×${footprint.height} cases`,footprint):msg('detail.footprint_unknown','Inconnue · ancre seule'));
  if(footprint.known){stat(stats,msg('detail.cells_x','CASES X'),msg('detail.range',`${footprint.x} à ${footprint.maxX}`,{start:footprint.x,end:footprint.maxX}));stat(stats,msg('detail.cells_y','CASES Y'),msg('detail.range',`${footprint.y} à ${footprint.maxY}`,{start:footprint.y,end:footprint.maxY}));}
  if(row.level)stat(stats,msg('detail.level','NIVEAU'),row.level);if(row.uid)stat(stats,'UID',row.uid);if(row.fid)stat(stats,msg('detail.public_fid','FID PUBLIC'),row.fid);
  if(row.uid!=null)stat(stats,msg('detail.origin','ORIGINE'),originKingdom(row)===null?msg('detail.unknown','Inconnue'):'K'+originKingdom(row));
  if(row.resource_id)stat(stats,msg('detail.resource_id','RESSOURCE (ID)'),row.resource_id);
  if([34,36,37,38].includes(row.type))stat(stats,msg('detail.building_level','NIVEAU DU BÂTIMENT'),row.building_level==null?msg('detail.unknown_m','Inconnu'):row.building_level);
  if(row.type)stat(stats,'TYPE',row.type);if(row.flag_bg!=null)stat(stats,msg('detail.native_background','FOND NATIF'),row.flag_bg);if(row.conf_id!=null)stat(stats,msg('detail.configuration','CONFIGURATION'),row.conf_id);
  content.append(stats);
  const actions=el('div','detail-actions');actions.append(action(msg('detail.coordinates','⌖ Coordonnées'),()=>copy(`K690 X:${row.x} Y:${row.y}`)),action(favorites.has(row.id)?msg('detail.favorite','★ Favori'):msg('detail.add_favorite','☆ Ajouter'),()=>{favorites.has(row.id)?favorites.delete(row.id):favorites.add(row.id);saveStored('atlas690-favorites',[...favorites]);if(tab==='favorites')applyTabLayers();select(row,false);update();}),action(msg('detail.local_link','↗ Lien local'),()=>copy(location.origin+'/#object='+encodeURIComponent(row.id))));
  if(row.alliance_id)actions.append(action(msg('detail.view_alliance','Voir l’alliance'),()=>{filters.alliance=String(row.alliance_id);$('alliance').value=filters.alliance;filters.query='';$('search').value='';update();map.fit();toast(msg('detail.alliance_filtered','Carte filtrée sur cette alliance.'));}));content.append(actions);
  if(row.alliance_id){const edit=el('label','color-edit',msg('detail.alliance_colour','Couleur locale de l’alliance')),input=el('input');input.type='color';input.value=allianceColor(row,alliances,customColors);input.setAttribute('aria-label',msg('detail.alliance_colour_aria','Couleur locale de cette alliance'));input.addEventListener('input',()=>{customColors[row.alliance_id]=input.value;saveStored('atlas690-colors',customColors);dot.style.backgroundColor=input.value;map.draw();renderResults();});edit.append(input);content.append(edit);}
  let note=msg('note.colour','Couleur locale personnalisable, pas une couleur native certifiée.');
  if(row.type===31)note+=' '+msg('note.hq','Image du QG attribuée par ressemblance (inférence).');
  if(row.type===35)note+=' '+msg('note.deposit','Gisement qui produit des ressources pour l’alliance ; ce n’est pas une mine de récolte sécurisée.');
  if(row.type===39)note+=' '+msg('note.safe_mine','Centre de récolte sécurisé construit par l’alliance, distinct des gisements de production et des ressources classiques.');
  if(row.uid!=null)note+=' '+msg('note.player_sprite','Sprite de base illustratif ; le skin actif n’est pas reproduit.');
  if(row.kind==='fixed')note=file?msg('note.fixed_logo','Logo original de mini-carte récupéré dans le cache du jeu, pas le modèle 3D natif. Le format de texture est inféré ; les pixels sources sont connus.'):msg('note.missing_logo','Logo original non récupéré : données sources protégées. Aucun autre logo n’est substitué.');
  if(row.kind==='fixed'&&file==='building2101.png')note=msg('note.major_fort','Sprite original du fort majeur récupéré dans le cache du jeu : texture RGBA32 et découpage Sprite intacts. Ce n’est pas le petit logo de mini-carte005, qui reste non récupéré, ni un rendu natif animé.');
  if(file==='building2001-rgba-source-known.png')note=msg('note.royal','Image originale détaillée du Château Royal, avec roche et cascade, sans bouclier. Pixels intégralement récupérés ; seules 26 lignes de marge transparente sont exclues. Le décor original de sol/remparts est disponible sur le fond reconstruit, avec une option dédiée. Encodages et placements d’affichage corroborés, pas une reproduction certifiée des shaders et de la scène native complète.');
  if(row.kind==='fixed'&&row.logo_offset_inferred&&file!=='building2001-rgba-source-known.png')note+=' '+msg('note.offset','Le décalage de la texture est aussi inféré depuis l’agencement des données (voir provenance).');
  if(row.kind!=='fixed'&&row.logo_file)note+=' '+msg('note.interface_logo','Logo original d’interface récupéré dans le cache, pas le modèle 3D natif ; format de texture inféré.');
  if(row.logo_level_fallback)note+=' '+msg('note.level_fallback','Niveau non reçu dans cet instantané : logo de base affiché, sans prétendre reproduire le niveau actuel.');
  if(row.build_finish===false)note+=' '+msg('note.construction','Construction non terminée au moment de la lecture.');
  if(row.observed_at_utc)note+=' '+msg('note.observed','Observé à {{time}}.',{time:formatTime(new Date(row.observed_at_utc),{hour:'2-digit',minute:'2-digit'})});
  note+=' '+msg('note.footprint','X,Y désignent le coin de coordonnées minimales de l’empreinte. La vue Plan montre les cases de l’objet reçu ; occupation actuelle et placement/TP restent non validés.');
  content.append(el('p','detail-note',note));renderResults();
}
function clearFilterValues(){filters.query=filters.alliance=filters.origin=filters.quick='';filters.min=filters.max=0;$('search').value=$('alliance').value=$('min-level').value=$('max-level').value=$('origin-kingdom').value='';}
function reset(){clearFilterValues();if(tab==='all')filters.quick='everything';applyTabLayers();update();}
function showEverything(){clearFilterValues();setTab('all','everything');}
function clearEverythingPreset(){if(filters.quick==='everything')filters.quick='';}
$('search').addEventListener('input',()=>{filters.query=$('search').value;clearEverythingPreset();update();});
$('alliance').addEventListener('change',()=>{filters.alliance=$('alliance').value;clearEverythingPreset();update();});
for(const [id,key] of [['min-level','min'],['max-level','max']])$(id).addEventListener('input',()=>{filters[key]=Number($(id).value)||0;clearEverythingPreset();update();});
function setTab(value,quick=''){tab=value;filters.quick=quick;filters.invasions=tab==='invasions';$('invasion-tools').hidden=!filters.invasions;applyTabLayers();for(const other of document.querySelectorAll('[data-tab]')){const active=other.dataset.tab===tab;other.classList.toggle('active',active);other.setAttribute('aria-selected',active);}update();}
for(const button of document.querySelectorAll('[data-tab]'))button.addEventListener('click',()=>button.dataset.tab==='all'?showEverything():setTab(button.dataset.tab));
$('origin-kingdom').addEventListener('change',()=>{filters.origin=$('origin-kingdom').value;update();});
$('more').addEventListener('click',()=>{limit+=pageSize();renderResults();});
$('clear-filters').addEventListener('click',reset);$('reset-empty').addEventListener('click',reset);
$('labels').addEventListener('change',()=>{if(map.plan)map.planLabels=$('labels').checked;else map.labels=$('labels').checked;map.draw();});
$('hq-labels').addEventListener('change',()=>{map.hqLabels=$('hq-labels').checked;map.draw();});
function updateGroundCaption(){$('ground-caption').textContent=map.plan?t('map.plan_caption'):map.backgroundMode==='mask'?t('map.mask_caption'):t('map.reconstructed_caption');$('royal-ground').disabled=map.plan||map.backgroundMode==='mask';}
$('background-style').addEventListener('change',()=>{map.backgroundMode=$('background-style').value==='mask'?'mask':'reconstructed';updateGroundCaption();map.draw();});
$('royal-ground').addEventListener('change',()=>{map.showRoyalGround=$('royal-ground').checked;saveStored('atlas690-royal-ground',map.showRoyalGround);map.draw();});
$('show-grid').addEventListener('change',()=>{map.showGrid=$('show-grid').checked;map.draw();});
$('hover-coordinates').addEventListener('change',()=>{map.showHoverCoordinates=$('hover-coordinates').checked;saveStored('atlas690-hover-coordinates',map.showHoverCoordinates);map.draw();});
$('obstacles').addEventListener('change',()=>{map.showObstacles=$('obstacles').checked;map.draw();});
$('site-zones').addEventListener('change',()=>{map.showSiteZones=$('site-zones').checked;map.draw();});
$('inspect-terrain').addEventListener('change',()=>{if($('inspect-terrain').checked)setMapTool('');map.inspectMode=$('inspect-terrain').checked;map.hovered=null;map.draw();});
$('terrain-form').addEventListener('submit',event=>{event.preventDefault();inspectTerrain(Number($('terrain-x').value),Number($('terrain-y').value),true);});
$('zoom-in').addEventListener('click',()=>map.zoomAt(1.5));$('zoom-out').addEventListener('click',()=>map.zoomAt(1/1.5));$('fit').addEventListener('click',()=>map.fit());
$('map-target').addEventListener('click',()=>map.tap());
function homeRow(){return world?.castles.find(row=>row.id===homeId)??null;}
function updateHomeButton(){
  const row=homeRow(),label=row?msg('home.current','Mon château · {{name}}',{name:displayName(row)}):homeId?msg('home.missing','Mon château absent · choisir un personnage'):t('home.configure');
  $('home').title=label;$('home').setAttribute('aria-label',label);$('home').classList.toggle('configured',!!row);
}
function locateHome(){
  const row=homeRow();if(!row){openHomeDialog();return;}
  locatedHome=true;
  if(filtered.some(candidate=>candidate.id===row.id)){map.homeTarget=null;select(row);}
  else {map.homeTarget=row;selected=map.selected=null;$('detail').hidden=true;$('empty-map').hidden=true;const position=map.objectPosition(row);map.center(position.x,position.y,Math.max(map.zoom,map.plan?24:7));renderResults();toast(msg('home.hidden_by_filters','Château masqué par les filtres : repère affiché sans les modifier.'));}
}
function renderHomeChoices(){
  const query=normalize($('home-search').value);
  const rows=(world?.castles??[]).filter(row=>normalize([displayName(row),row.uid,row.fid].join(' ')).includes(query)).sort((a,b)=>normalize(displayName(a)).localeCompare(normalize(displayName(b))));
  $('home-count').textContent=msg('home.count',`${rows.length.toLocaleString('fr')} personnage${rows.length>1?'s':''} · liste indépendante des filtres de la carte`,{count:formatNumber(rows.length),plural:rows.length>1?'s':''});
  $('home-choices').replaceChildren();
  for(const row of rows){
    const button=el('button','home-choice');button.type='button';button.addEventListener('click',()=>{homeId=row.id;saveStored(homeStorageKey,homeId);updateHomeButton();$('home-dialog').close();locateHome();});
    button.dataset.id=row.id;button.setAttribute('aria-pressed',row.id===homeId);
    button.append(el('span','result-name',displayName(row)),el('span','result-meta',msg('home.choice_meta',`UID ${row.uid}${row.fid?' · FID '+row.fid:''} · X ${row.x} · Y ${row.y}${row.level?' · Niv. '+row.level:''}`,{uid:row.uid,fid:row.fid??'',fidPart:row.fid?' · FID '+row.fid:'',x:row.x,y:row.y,levelPart:row.level?' · '+msg('result.level','Niv. {{level}}',{level:row.level}):''})));
    $('home-choices').append(button);
  }
  if(!rows.length)$('home-choices').append(el('p','empty',msg('home.none','Aucun personnage trouvé dans cet instantané.')));
}
function openHomeDialog(){
  if(!world){toast(msg('snapshot.not_loaded','L’instantané n’est pas encore chargé.'));return;}
  const row=homeRow();$('home-current').textContent=row?msg('home.selected','Choix actuel : {{name}}',{name:displayName(row)}):homeId?msg('home.saved_missing','Le personnage enregistré est absent de cet instantané. Choisissez-en un autre.'):msg('home.none_configured','Aucun château configuré.');
  $('home-clear').hidden=!homeId;$('home-search').value='';renderHomeChoices();$('home-dialog').showModal();$('home-search').focus();
}
$('home').addEventListener('click',locateHome);
$('home-settings').addEventListener('click',openHomeDialog);
$('home-search').addEventListener('input',renderHomeChoices);
$('home-cancel').addEventListener('click',()=>$('home-dialog').close());
$('home-dismiss').addEventListener('click',()=>$('home-dialog').close());
$('home-clear').addEventListener('click',()=>{homeId=null;locatedHome=false;map.homeTarget=null;saveStored(homeStorageKey,null);updateHomeButton();$('empty-map').hidden=filtered.length>0||!!map.toolMode;map.draw();openHomeDialog();});
$('jump-form').addEventListener('submit',event=>{event.preventDefault();map.center(Number($('jump-x').value),Number($('jump-y').value),8);mobileUI.close();toast(msg('map.centered','Carte centrée sur ces coordonnées.'));});
for(const [id,mode] of [['view-flat','flat'],['view-plan','plan']])$(id).addEventListener('click',()=>{
  map.plan=mode==='plan';map.iso=false;map.hovered=null;map.hoveredCell=null;
  for(const [buttonId,buttonMode] of [['view-flat','flat'],['view-plan','plan']]){const active=mode===buttonMode;$(buttonId).classList.toggle('active',active);$(buttonId).setAttribute('aria-pressed',active);}
  $('plan-note').hidden=!map.plan;$('background-style').disabled=map.plan;$('show-grid').disabled=map.plan;$('show-grid').checked=map.plan||map.showGrid;$('labels').checked=map.plan?map.planLabels:map.labels;updateGroundCaption();
  if(selected){const pos=map.objectPosition(selected);map.center(pos.x,pos.y,Math.max(map.zoom,map.plan?24:7));}else map.draw();
});
$('detail-close').addEventListener('click',()=>{$('detail').hidden=true;selected=map.selected=null;map.draw();renderResults();});
$('detail-expand').addEventListener('click',()=>{const expanded=!$('detail').classList.contains('expanded');$('detail').classList.toggle('expanded',expanded);$('detail-expand').setAttribute('aria-expanded',expanded);$('detail-expand').textContent=expanded?t('detail.reduce'):t('detail.expand');});
$('about').addEventListener('click',()=>$('about-dialog').showModal());$('about-close').addEventListener('click',()=>$('about-dialog').close());
$('about-dismiss').addEventListener('click',()=>$('about-dialog').close());
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)){event.preventDefault();mobileUI.setSidebar(true);$('search').focus();}if(event.key==='Escape'){if(map.toolMode)setMapTool('');mobileUI.close();$('detail').hidden=true;selected=map.selected=null;map.draw();}});
$('export').addEventListener('click',()=>{if(!world)return;const value={kingdom:690,snapshot_at:world.meta.updated_at_utc,filters,colors:customColors,objects:results};const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='kingdom-690-selection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(msg('export.done',`${results.length} objets exportés.`,{count:formatNumber(results.length)}));});

async function status(){
  canRefresh=false;
  $('refresh').hidden=true;$('refresh').disabled=true;$('cancel').disabled=true;
  $('topbar').classList.add('refresh-disabled');
  $('access-mode').hidden=false;
  $('access-mode').textContent=t('access.disabled');
  $('progress').hidden=true;
}
$('refresh').addEventListener('click',()=>toast(msg('refresh.disabled_access','Actualisation désactivée pour cet accès.')));
$('refresh-no').addEventListener('click',()=>$('refresh-dialog').close());
$('refresh-yes').addEventListener('click',()=>toast(msg('refresh.disabled_access','Actualisation désactivée pour cet accès.')));
$('cancel').addEventListener('click',()=>toast(msg('refresh.disabled_access','Actualisation désactivée pour cet accès.')));


try{
  await initializeI18n();
  updateGroundCaption();
  setTab(tab,filters.quick);
  await loadWorld();await loadTerrain();await loadSiteZones();await status();
  const id=new URLSearchParams(location.hash.slice(1)).get('object');
  if(id){const row=allRows.find(row=>row.id===id);if(row)select(row);else toast(msg('object.absent','Objet absent de cet instantané.'));}
}catch(error){$('loading').replaceChildren(el('p','',error.message),action(msg('retry','Réessayer'),()=>location.reload(),'primary'));}

document.addEventListener('atlas:localechange',()=>{
  if(!world)return;
  for(const preset of QUICK_FILTERS){const button=quickButtons.get(preset.id);if(button)button.textContent=translateSource(preset.label);}
  renderLocaleDependentWorldUI();
  refreshTerrainStatus();void status();
  updateGroundCaption();update();
  if(selected)select(selected,false);
});
