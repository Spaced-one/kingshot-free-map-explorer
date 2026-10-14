// Original mask constraints, NOT an authorization to send a teleport request.
import {sha256Hex} from './sha256.js';
export const EXCLUSIONS = {1:'Montagne',2:'Eau',3:'Bordure d’eau',5:'Décor/bâtiment fixe',6:'Terrain interdit',9:'Zone noire interdite'};
export const MASK_NAMES = {0:'Sans obstacle dans le masque',1:'Montagne',2:'Eau',3:'Bordure d’eau',4:'Forêt',5:'Bâtiment/décor',6:'Terrain interdit',7:'Ville',8:'Zone centrale/tour',9:'Zone noire'};
export const ORIGINAL_MASK_SHA256='5548360f7fa681a11ca428414106d340e73e294c6a445285b179f6ad24f3787d';
export async function verifyOriginalTerrain(spec){
  if(spec?.size!==1200||spec.packed_file_sha256!==ORIGINAL_MASK_SHA256||spec.runtime_disk_file_matches!==true)throw new Error('Source de terrain non validée.');
  const raw=atob(spec.packed_base64);if(raw.length!==720000)throw new Error('Longueur de terrain invalide.');
  const bytes=new Uint8Array(raw.length+4);bytes[0]=1;
  for(let i=0;i<raw.length;i++)bytes[i+4]=raw.charCodeAt(i);
  const hash=await sha256Hex(bytes);
  if(hash!==ORIGINAL_MASK_SHA256)throw new Error('Empreinte du terrain incorrecte.');
}
export function decodeTerrain(spec) {
  if(spec?.version!==1||!Number.isInteger(spec.size)||spec.size<1||spec.size>1200||spec.encoding!=='row-major low-nibble-first'||typeof spec.packed_base64!=='string')throw new Error('Masque de terrain invalide.');
  const raw=atob(spec.packed_base64),size=spec.size;
  if(raw.length!==Math.ceil(size*size/2))throw new Error('Longueur de terrain invalide.');
  const cells=new Uint8Array(size*size);
  for(let i=0;i<cells.length;i++)cells[i]=(raw.charCodeAt(i>>1)>>(4*(i&1)))&15;
  return {size,cells,source:spec};
}
export function checkFootprint(terrain,x,y) {
  if(!Number.isInteger(x)||!Number.isInteger(y))throw new Error('Coordonnées entières requises.');
  const reasons=[],unknown=[],cells=[];
  for(let cy=y;cy<y+2;cy++)for(let cx=x;cx<x+2;cx++){
    if(cx<0||cy<0||cx>=terrain.size||cy>=terrain.size){reasons.push({x:cx,y:cy,name:'Hors de la carte'});continue;}
    const mask=terrain.cells[cy*terrain.size+cx];cells.push({x:cx,y:cy,mask,name:MASK_NAMES[mask]??'Catégorie non établie'});
    if(EXCLUSIONS[mask])reasons.push({x:cx,y:cy,mask,name:EXCLUSIONS[mask]});
    else if(![0,8].includes(mask))unknown.push({x:cx,y:cy,mask});
  }
  return {x,y,width:2,height:2,cells,reasons,unknown,status:reasons.length?'static_exclusion':unknown.length?'unknown':'static_clear',teleport_authorized:null};
}
export function validateSiteZones(spec){
  if(spec?.version!==1||spec.size!==1200||spec.mask_sha256!==ORIGINAL_MASK_SHA256||spec.native_colors!==false||spec.teleport_authorized!==null||!Array.isArray(spec.regions)||spec.regions.length!==91)throw new Error('Zones de sites non validées.');
  for(const region of spec.regions){
    if(!Array.isArray(region.paths)||!region.paths.length||!Array.isArray(region.fixed_ids))throw new Error('Contour de site invalide.');
    for(const path of region.paths){
      if(!Array.isArray(path)||path.length<4||path.length>10000)throw new Error('Contour de site invalide.');
      for(const p of path)if(!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isInteger(n)||n<0||n>1200))throw new Error('Coordonnées de contour invalides.');
    }
  }
  return spec;
}
