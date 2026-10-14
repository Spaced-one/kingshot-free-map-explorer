import {WorldMap} from './map.js';
import {sprite} from './logic.js';
import {SPRITE_GEOMETRY} from './sprite_geometry.js';
import {ALIGNMENT_SCENES,sampleRows,sampleMetrics} from './alignment_samples.js';
import {initializeI18n,t,translateSource} from './i18n.js';

await initializeI18n();

const $=id=>document.getElementById(id),scenes=[];
const node=(tag,text)=>{const value=document.createElement(tag);if(text!==undefined)value.textContent=text;return value;};
const controls=()=>({zoom:Number($('zoom').value),iso:$('projection').value==='iso',orientation:$('orientation').value,spacing:Number($('spacing').value),candidate:$('candidate').checked,hover:$('hover').value});
for(const scene of ALIGNMENT_SCENES.filter(scene=>scene.id==='mixed')){
  const card=node('section');card.className='scene';const head=node('div');head.className='scene-head';const positions=node('p');head.append(node('h2',translateSource(scene.title)),positions);
  const scroll=node('div');scroll.className='canvas-scroll';const canvas=node('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label',scene.title);scroll.append(canvas);
  const tableScroll=node('div');tableScroll.className='table-scroll';const table=node('table'),thead=node('thead'),titles=node('tr');
  for(const text of ['Exemple','X / Y','Image','Hauteur visible','Milieu horizontal / croix','Bas visible / croix'])titles.append(node('th',translateSource(text)));thead.append(titles);const tbody=node('tbody');table.append(thead,tbody);tableScroll.append(table);card.append(head,scroll,tableScroll);$('scenes').append(card);
  const map=new WorldMap(canvas,{select(){},coordinates(){},color:()=> '#d9b77e'});
  map.labels=false;map.showObstacles=false;map.showSiteZones=false;
  // Mouse position/clicks cannot unintentionally raise/recentre a sample.
  map.hover=()=>{};map.hit=()=>{};map.tap=()=>{};
  const originalDraw=map.draw.bind(map),originalImage=map.ctx.drawImage.bind(map.ctx);
  map.ctx.drawImage=function(image,x,y,width,height){
    if($('candidate').checked&&image===map.images.get('castle3.png')){
      const record=SPRITE_GEOMETRY['castle3.png'];x+=12*width/record.width;y+=16*height/record.height;
    }
    return originalImage(image,x,y,width,height);
  };
  map.draw=()=>{
    // Neutral background removes terrain/site effects from this comparison.
    map.terrain=map.reconstructedTerrain=null;map.selected=null;
    const state=controls();map.hovered=state.hover==='none'?null:map.rows[Number(state.hover)];
    originalDraw();if(!map.width||!map.rows.length)return;
    const metrics=map.rows.map(row=>sampleMetrics(row,{...state,zoom:map.zoom,cx:map.cx,cy:map.cy,width:map.width,height:map.height,hovered:row===map.hovered}));
    if($('guides').checked){
      const ctx=map.ctx;ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(metrics[0].ground.x,metrics[0].ground.y);ctx.lineTo(metrics[2].ground.x,metrics[2].ground.y);ctx.stroke();ctx.setLineDash([]);
      for(const m of metrics){
        const {x,y}=m.ground;ctx.strokeStyle='#ffffffb0';ctx.setLineDash([3,3]);ctx.beginPath();ctx.ellipse(x,y+1,m.size*.52,m.size*.24,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
        ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);ctx.stroke();
        ctx.strokeStyle='#eea85c';ctx.strokeRect(m.bounds.left,m.bounds.top,m.bounds.right-m.bounds.left,m.visibleHeight);
        ctx.beginPath();ctx.moveTo(m.alphaMidX,y-7);ctx.lineTo(m.alphaMidX,y+7);ctx.stroke();
        ctx.fillStyle='#5aff92';ctx.beginPath();ctx.arc(m.configuredAnchor.x,m.configuredAnchor.y,3,0,Math.PI*2);ctx.fill();
      }ctx.restore();
    }
    positions.textContent=map.rows.map((row,i)=>t('alignment.position',{label:'ABC'[i],x:row.x,y:row.y,level:row.level})).join(' — ');
    tbody.replaceChildren();metrics.forEach((m,i)=>{const tr=node('tr');for(const text of ['ABC'[i],`${map.rows[i].x} / ${map.rows[i].y}`,m.file,m.visibleHeight.toFixed(1)+'px',m.alphaMidOffset.toFixed(1)+'px',m.frontBelowGround.toFixed(1)+'px'])tr.append(node('td',text));tbody.append(tr);});
    $('summary').textContent=t('alignment.summary');
  };
  scenes.push({map,scene});
}
function reset(){
  const state=controls();for(const {map,scene} of scenes){map.iso=state.iso;map.rows=sampleRows(scene.levels,state);map.resize();map.center(600,600,state.zoom);}
}
for(const id of ['projection','orientation','zoom','spacing','hover','candidate','guides'])$(id).addEventListener('change',reset);
$('reset').addEventListener('click',()=>{$('projection').value='flat';$('orientation').value='world';$('zoom').value='40';$('spacing').value='2';$('hover').value='none';$('candidate').checked=false;$('guides').checked=true;reset();});
reset();
