// Fictitious, isolated fixtures. Never import the kingdom snapshot or auth.
import {WorldMap} from './map.js';
import {sprite,visualPosition,projectPoint,markerArtwork} from './logic.js';
import {SPRITE_GEOMETRY} from './sprite_geometry.js';
import {SPRITE_GROUND_ANCHORS} from './sprite_anchors.js';

export const ALIGNMENT_SCENES = [
  {id:'grey',title:'Trois châteaux gris/bleus identiques',levels:[22,22,22]},
  {id:'mixed',title:'Un gris entre deux bleus',levels:[40,22,60]},
  {id:'others',title:'Trois autres modèles',levels:[1,55,60]}
];
export function sampleRows(levels,{orientation='screen',spacing=4}={}){
  return levels.map((level,i)=>({id:`sample-${i}`,uid:-(i+1),sample:true,level,
    name:`Exemple ${'ABC'[i]} · ${sprite({uid:1,level}).replace('.png','')}`,
    x:600+(i-1)*spacing,y:600+(orientation==='screen'?-(i-1)*spacing:0)}));
}
export function sampleMetrics(row,{zoom=32,iso=false,width=960,height=420,cx=600,cy=600,hovered=false,candidate=false}={}){
  const file=sprite(row),image=SPRITE_GEOMETRY[file],sourceAnchor=SPRITE_GROUND_ANCHORS[file];
  const point=visualPosition(row),ground=projectPoint(point.x,point.y,cx,cy,zoom,width,height,iso);
  const size=WorldMap.prototype.markerSize.call({zoom,iso},row);
  const art=markerArtwork(row,image,size),scale=size/image.width;
  const offset=candidate&&file==='castle3.png'?{x:12*scale,y:16*scale}:{x:0,y:0};
  const left=ground.x+art.left+offset.x,top=ground.y+art.top+offset.y;
  const bounds={left:ground.x+art.inkLeft+offset.x,right:ground.x+art.inkRight+offset.x,
    top:ground.y+art.inkTop+offset.y,bottom:ground.y+art.inkBottom+offset.y};
  return {file,ground,size,art,left,top,offset,bounds,
    configuredAnchor:{x:left+sourceAnchor[0]*scale,y:top+sourceAnchor[1]*scale},
    alphaMidX:(bounds.left+bounds.right)/2,
    alphaMidOffset:(bounds.left+bounds.right)/2-ground.x,
    frontBelowGround:bounds.bottom-ground.y,
    visibleHeight:bounds.bottom-bounds.top};
}
