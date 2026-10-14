import {SPRITE_GEOMETRY} from './sprite_geometry.js';
import {SPRITE_GROUND_ANCHORS,SPRITE_DISPLAY_LIFTS} from './sprite_anchors.js';
import {FOOTPRINT_SIZES} from './footprint_sizes.js';
import {translateSource} from './i18n.js';

export const MAX_ZOOM = 40;
export const QUICK_FILTERS = [
  {id:'everything',label:'Tout afficher',unfiltered:true},
  {id:'all',label:'Tous les bâtiments'},
  {id:'hq',label:'QG',types:[31]}, {id:'bears',label:'Pièges à ours',types:[33]},
  {id:'flags',label:'Drapeaux',types:[32]},
  {id:'deposits',label:'Gisements · production',types:[35]},
  {id:'safe-mines',label:'Mines · récolte sécurisée',types:[39]},
  {id:'arsenal',label:'Arsenal',types:[37]}, {id:'mobilization',label:'Mobilisation',types:[34]},
  {id:'confrontation',label:'Confrontation',types:[36]}, {id:'duel',label:'Duel',types:[38]},
  {id:'forts',label:'Forts',types:[21,22],fixed:true},
  {id:'sanctuaries',label:'Sanctuaires',types:[23],fixed:true},
  {id:'capital',label:'Château du royaume',types:[20],fixed:true},
  {id:'towers',label:'Tours',types:[24],fixed:true},
  {id:'mills',label:'Moulins',types:[35],conf:101},
  {id:'sawmills',label:'Scieries',types:[35],conf:201},
  {id:'quarries',label:'Carrières',types:[35],conf:301},
  {id:'foundries',label:'Fonderies',types:[35],conf:401}
];
export function matchesQuickFilter(row,id){
  const preset=QUICK_FILTERS.find(p=>p.id===id);
  if(!preset)return true;
  if(preset.unfiltered)return true;
  return row.uid==null&&(!preset.types||(preset.types.includes(row.type)&&
    (row.kind==='fixed')===!!preset.fixed))&&(preset.conf==null||row.conf_id===preset.conf);
}
export function quickLayers(id){
  const preset=QUICK_FILTERS.find(p=>p.id===id);
  if(preset?.unfiltered)return tabLayers('all');
  if(!preset?.types)return tabLayers('buildings');
  const categories=new Set(preset.types.map(type=>category({type,kind:preset.fixed?'fixed':null})));
  return Object.fromEntries(LAYERS.map(([key])=>[key,categories.has(key)]));
}

export const LAYERS = [
  ['players','Châteaux','#d9b77e'], ['flags','Drapeaux','#89b4a5'],
  ['hq','QG','#af9bcd'], ['bears','Pièges à ours','#dd986d'],
  ['alliance','Autres bâtiments','#91b4cd'], ['mines','Gisements · production','#a2af93'],
  ['resources','Mines · récolte sécurisée','#79bdc6'],
  ['fixed','Sites fixes','#ccc4ac']
];
export const PALETTE = ['#dfb86c','#d97b74','#7fb6a4','#83a9d5','#ab92cf','#cda887','#87b979','#cf8cbd'];
export const MAP_ROTATION = 45; // Previous 135° anticlockwise, then 90° clockwise.
export function normalize(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLocaleLowerCase();
}
export function category(row) {
  if (row.kind === 'fixed') return 'fixed';
  if (row.uid != null) return 'players';
  return ({31:'hq',32:'flags',33:'bears',35:'mines',39:'resources'})[row.type] ?? 'alliance';
}
export function glyph(row) {return ({players:'♜',flags:'⚑',hq:'♜',bears:'◈',mines:'⬡',resources:'▧',alliance:'▥',fixed:'◆'})[category(row)];}
export function name(row) {return row.name || (row.uid != null ? `Joueur ${row.uid}` : 'Bâtiment');}
export function displayName(row) {const alliance=row.alliance_name||row.alliance_abbr;return (alliance?`[${alliance}] `:row.alliance_id?`[Alliance ${row.alliance_id}] `:'')+translateSource(name(row));}
export function isUILogo(row){return row.kind==='fixed'||/^worldfield_allianceterritory_\d{3}\.png$/.test(row.logo_file??'');}
// Display-only calibration from the supplied game screenshots (13 Oct 2026).
// Full PNG widths at zoom 24, NOT occupied cells or recovered Unity scales.
// Alpha widths: castle5 ~46px, HQ ~75px, bear ~87px, quarry ~57px,
// Arsenal ~55px, Mobilisation ~51px, flag ~20px. Keep native aspect ratios.
export const MARKER_REFERENCE_WIDTHS=Object.freeze({
  players:50,hq:84,bears:90,flags:24,mines:64,
  arsenal:76,mobilization:62,quarry:62,foundry:62,
  // High-resolution capital: reference transferred from the screenshot-matched
  // 480px logo through two matching source details (scale3.475, NCC>.93).
  // This is display calibration, not a recovered native pivot or mesh scale.
  royalCapital:220,royalTower:78,
});
export function markerDisplaySize(row,zoom,iso=false){
  const cat=category(row);
  // Royal capital/towers now have screenshot references; other fixed sites
  // lack comparable views and keep their previous display calibration.
  if(cat==='fixed'){
    if([20,24].includes(row.type))return Math.max(17,MARKER_REFERENCE_WIDTHS[row.type===20?'royalCapital':'royalTower']*zoom/24*(iso?Math.SQRT2*.85:1));
    const cap=({20:140,21:120,22:110,23:82,24:70}[row.type]??70);
    return Math.max(17,Math.min(cap*Math.max(1,zoom/24),zoom*16));
  }
  // Unmatched categories/artwork retain the earlier fallback. In particular,
  // safe alliance mines are not conflated with the pictured production deposits.
  if(!SPRITE_GEOMETRY[sprite(row)]||(!Object.hasOwn(MARKER_REFERENCE_WIDTHS,cat)&&![34,37].includes(row.type))){
    const cap=isUILogo(row)?90:cat==='flags'?52:cat==='hq'?100:cat==='bears'?90:cat==='players'?85:cat==='mines'?70:46;
    return Math.max(17,Math.min(cap*Math.max(1,zoom/24),zoom*(isUILogo(row)?12:cat==='flags'?5:cat==='mines'?8:cat==='resources'?4:10)));
  }
  const key=row.type===37?'arsenal':row.type===34?'mobilization':cat==='mines'&&row.conf_id===301?'quarry':cat==='mines'&&row.conf_id===401?'foundry':cat;
  const reference=MARKER_REFERENCE_WIDTHS[key];
  // Track ground scale continuously: no cap plateau between zoom 7 and 24.
  // Both illustrated views have the same sprite-to-ground proportions.
  return Math.max(17,reference*zoom/24*(iso?Math.SQRT2*.85:1));
}
export function visualPosition(row){return isUILogo(row)?{x:row.x+(row.width??0)/2,y:row.y+(row.height??0)/2}:{x:row.x,y:row.y};}
export function objectFootprint(row){
  const type=row.uid!=null?1:row.type;
  const spec=Number.isInteger(type)&&Object.hasOwn(FOOTPRINT_SIZES,type)?FOOTPRINT_SIZES[type]:null;
  const width=spec?.width??1,height=spec?.height??1;
  return {x:row.x,y:row.y,width,height,known:!!spec,maxX:row.x+width-1,maxY:row.y+height-1};
}
export function footprintCenter(row){const f=objectFootprint(row);return {x:f.x+f.width/2,y:f.y+f.height/2};}
// Recover exact grid boundaries after floating-point projection round trips.
export function coordinateCell(x,y){const index=n=>{const nearest=Math.round(n);return Math.floor(Math.abs(n-nearest)<1e-9?nearest:n);};return {x:index(x),y:index(y)};}
export function containsFootprint(row,x,y){const f=objectFootprint(row),cell=coordinateCell(x,y);return cell.x>=f.x&&cell.y>=f.y&&cell.x<f.x+f.width&&cell.y<f.y+f.height;}
export function footprintLabel(row){if(row.uid!=null)return 'C';if(!Number.isInteger(row.type))return '?';return ({20:'CH',21:'F+',22:'F',23:'S',24:'T',31:'QG',32:'D',33:'O',34:'MOB',35:'G',36:'CON',37:'AR',38:'DU',39:'MS'})[row.type]??(objectFootprint(row).known?'B':'?');}
// Local display calibration only: never changes map coordinates/native pixels.
// Anchor the centre of the visible base, not the lowest opaque pixel (which
// often belongs to the front edge or shadow), including Arsenal/Mobilisation.
// Alpha bounds are still used for picking/culling, never as a native pivot.
export function markerArtwork(row,image,size){
  const height=image?size*image.height/image.width:size*.5;
  const legacyTop=isUILogo(row)?-height/2:-height+size*.12;
  const file=sprite(row),record=SPRITE_GEOMETRY[file];
  const measured=image&&record?.width===image.width&&record?.height===image.height;
  const unchanged=[34,37].includes(row.type)&&!measured; // Legacy fallback only for an unmeasured/missing image.
  const bounds=measured?record.bounds:[0,0,size,height];
  const scale=measured?size/image.width:1;
  const foot=measured?record.foot_y*scale:height;
  const anchor=measured&&!unchanged?SPRITE_GROUND_ANCHORS[file]:null;
  const displayLift=anchor?(SPRITE_DISPLAY_LIFTS[file]??0)*scale:0;
  const left=anchor?-anchor[0]*scale:-size/2;
  const top=image&&!unchanged?-(anchor?anchor[1]*scale:foot)-displayLift:legacyTop;
  const inkBottom=top+bounds[3]*scale;
  const legacyLabel=size*(isUILogo(row)?.55:.17)+4;
  return {width:size,height,left,top,groundY:0,unchanged,displayLift,
    inkLeft:left+bounds[0]*scale,inkRight:left+bounds[2]*scale,
    inkTop:top+bounds[1]*scale,inkBottom,
    labelY:unchanged||!image?legacyLabel:Math.max(size*.14,inkBottom)+4};
}
export function originKingdom(row) {return Number.isInteger(row.origin_kid)&&row.origin_kid>0?row.origin_kid:null;}
export function isForeign(row,kingdom=690) {const origin=originKingdom(row);return row.uid!=null&&origin!==null&&origin!==kingdom;}
export function matches(row, query) {
  return normalize([displayName(row),row.alliance_abbr,row.alliance_id,row.uid,row.fid,row.object_id,row.x+','+row.y].join(' ')).includes(normalize(query));
}
export function filterRows(rows, filters) {
  return rows.filter(row => filters.layers[category(row)] !== false &&
    matchesQuickFilter(row,filters.quick)&&
    (!filters.invasions || (isForeign(row,filters.kingdom??690)&&(!filters.origin || originKingdom(row)===Number(filters.origin)))) &&
    (!filters.alliance || String(row.alliance_id) === String(filters.alliance)) && matches(row,filters.query) &&
    (row.uid == null || ((!filters.min || row.level >= filters.min) && (!filters.max || row.level <= filters.max))));
}
export function tabLayers(tab,rows=[],favorites=new Set()){
  const favoriteLayers=new Set(rows.filter(row=>favorites.has(row.id)).map(category));
  return Object.fromEntries(LAYERS.map(([key])=>[key,tab==='all'?true:tab==='favorites'?favoriteLayers.has(key):tab==='buildings'?key!=='players':key==='players']));
}
export function filterMapRows(rows,filters,tab,favorites){
  const filtered=filterRows(rows,filters);
  return tab==='favorites'?filtered.filter(row=>favorites.has(row.id)):filtered;
}
export function sprite(row) {
  if(row.kind==='fixed'&&row.type===20)return 'building2001-rgba-source-known.png';
  if(row.kind==='fixed')return /^worldfield_tronghold_bg_00[1-8]\.png$/.test(row.logo_file??'')?row.logo_file:row.type===21&&row.art_kind==='original-scene-sprite'&&row.logo_file==='building2101.png'?row.logo_file:null;
  if(/^worldfield_allianceterritory_\d{3}\.png$/.test(row.logo_file??''))return row.logo_file;
  if (row.uid != null) {
    const level = row.level || 1;
    return `castle${level < 13 ? 1 : level < 35 ? 3 : level < 50 ? 5 : level < 60 ? 6 : 7}.png`;
  }
  if (row.type===35) return ({101:'mine_meat.png',201:'mine_wood.png',301:'mine_coal.png',401:'mine_iron.png'})[row.conf_id]??null;
  return ({31:'sprite-34272.png',32:row.build_finish === false ? 'alliance_flag_broken.png':'alliance_flag.png',
           33:'alliance_trap_open.png',38:'alliance_duel.png'})[row.type] ?? null;
}
export function allianceColor(row, alliances, custom={}) {
  const aid = row.alliance_id;
  if (!aid) return '#a5b1a0';
  if (/^#[0-9a-f]{6}$/i.test(custom[aid] || '')) return custom[aid];
  const bg = alliances.get(String(aid))?.flag_backgrounds?.[0];
  return PALETTE[Number.isInteger(bg) && bg >= 1 && bg <= 8 ? bg-1 : Math.abs(Number(aid)) % PALETTE.length];
}
// Saved game territory edges measure Y/X ~0.706 (visual estimate, not a
// recovered native camera transform). Tilt follows SCREEN axes after rotation;
// sprites/labels remain upright. Plan alone keeps an undistorted metric grid.
export const GAME_GROUND_ASPECT=Math.SQRT1_2;
export function projectionMatrix(zoom,iso=false,rotation=MAP_ROTATION,plan=false) {
  const theta=rotation*Math.PI/180,co=Math.cos(theta),si=Math.sin(theta);
  const horizontal=!plan&&iso?Math.SQRT2*.85:1,vertical=horizontal*(plan?1:GAME_GROUND_ASPECT);
  return {a:co*zoom*horizontal,b:-si*zoom*vertical,c:-si*zoom*horizontal,d:-co*zoom*vertical};
}
export function projectPoint(x,y,cx,cy,zoom,width,height,iso=false,rotation=MAP_ROTATION,plan=false) {
  const dx=x-cx,dy=y-cy,m=projectionMatrix(zoom,iso,rotation,plan);
  return {x:width/2+m.a*dx+m.c*dy,y:height/2+m.b*dx+m.d*dy};
}
export function unprojectPoint(x,y,cx,cy,zoom,width,height,iso=false,rotation=MAP_ROTATION,plan=false) {
  const dx=x-width/2,dy=y-height/2,m=projectionMatrix(zoom,iso,rotation,plan),det=m.a*m.d-m.b*m.c;
  return {x:cx+(m.d*dx-m.c*dy)/det,y:cy+(-m.b*dx+m.a*dy)/det};
}
export function validateSnapshot(world) {
  if (!world || world.meta?.kingdom !== 690 || world.dimensions?.size !== 1200 || !Array.isArray(world.castles) || !Array.isArray(world.buildings) || !Array.isArray(world.alliances)) throw new Error('Instantané du royaume 690 invalide.');
  for (const row of [...world.castles,...world.buildings,...(world.fixed || [])]) {
    if (!Number.isInteger(row.x) || !Number.isInteger(row.y) || row.x<0 || row.y<0 || row.x>=1200 || row.y>=1200 || typeof row.id !== 'string') throw new Error('Coordonnées invalides.');
  }
  return world;
}
