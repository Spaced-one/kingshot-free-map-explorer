import {MAP_ROTATION,MAX_ZOOM,projectPoint,unprojectPoint,projectionMatrix,category,sprite,displayName,glyph,visualPosition,isUILogo,markerArtwork,markerDisplaySize,objectFootprint,footprintCenter,containsFootprint,footprintLabel,coordinateCell} from './logic.js';
import {validMapPoint,mapDistance,mapZone} from './map_tools.js';
import {ROYAL_GROUND,drawRoyalGround,prepareRoyalGround} from './royal_ground.js';
import {t,formatNumber} from './i18n.js';

export class WorldMap {
  constructor(canvas,{select,coordinates,color,inspect,toolChange}) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.select=select; this.coordinates=coordinates; this.color=color;
    this.inspect=inspect;this.inspectMode=false;this.showObstacles=true;this.probe=null;
    this.showSiteZones=true;this.siteZones=null;
    this.showRoyalGround=true;this.royalGround=null;
    this.cx=600;this.cy=600;this.zoom=2.8;this.iso=false;this.plan=false;this.planLabels=false;this.rotation=MAP_ROTATION;this.rows=[];this.images=new Map();this.labels=true;this.hqLabels=false;this.selected=null;this.hovered=null;this.pointers=new Map();
    this.homeTarget=null;
    this.toolMode='';this.toolPoints=[];this.toolCursor=null;this.toolChange=toolChange;
    this.hoveredCell=null;this.showHoverCoordinates=true;this.aimHover=false;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);
    const terrain=new Image();terrain.onload=()=>{this.terrain=terrain;this.draw();};terrain.src='./assets/terrain.jpg';
    this.backgroundMode='reconstructed';this.showGrid=false;
    const styled=new Image();styled.onload=()=>{this.reconstructedTerrain=styled;this.draw();};styled.src='./assets/terrain-game-style.jpg';
    const obstacles=new Image();obstacles.onload=()=>{this.obstacles=obstacles;this.draw();};obstacles.src='./assets/static-obstacles.png';
    const zones=new Image();zones.onload=()=>{this.zoneFill=zones;this.draw();};zones.src='./assets/site-zones.png';
    const royalGround=new Image();royalGround.onload=()=>{this.royalGround=prepareRoyalGround(royalGround);this.draw();};royalGround.src='./assets/'+ROYAL_GROUND.file;
    for(const file of ['castle1.png','castle3.png','castle5.png','castle6.png','castle7.png','alliance_flag.png','alliance_flag_broken.png','alliance_trap_open.png','alliance_duel.png','sprite-34272.png','mine_meat.png','mine_wood.png','mine_coal.png','mine_iron.png','building2101.png','building2001-rgba-source-known.png',...[1,2,3,4,6,7,8].map(i=>`worldfield_tronghold_bg_00${i}.png`),...[1,2,3,4,18,19,20,21,22,24,25,26,27].map(i=>`worldfield_allianceterritory_${String(i).padStart(3,'0')}.png`)]) {
      const img=new Image();img.onload=()=>{this.images.set(file,img);this.draw();};img.src='./assets/'+file;
    }
    canvas.addEventListener('wheel',e=>{e.preventDefault();const p=this.local(e);this.zoomAt(Math.exp(-e.deltaY*.0015),p.x,p.y);},{passive:false});
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,this.local(e));
      this.hovered=null;this.hoveredCell=null;
      this.toolCursor=null;
      this.drag={point:this.local(e),cx:this.cx,cy:this.cy,moved:false};
      if(this.pointers.size===2){const ps=[...this.pointers.values()];this.pinch={distance:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y),x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2};this.drag.moved=true;}
    });
    canvas.addEventListener('pointermove',e=>{
      const p=this.local(e),world=this.unproject(p.x,p.y);this.coordinates(world);
      if(!this.pointers.has(e.pointerId)){if(e.pointerType!=='touch')this.hover(p);return;}
      this.pointers.set(e.pointerId,p);
      if(this.pointers.size===2){const ps=[...this.pointers.values()],distance=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y),x=(ps[0].x+ps[1].x)/2,y=(ps[0].y+ps[1].y)/2;
        if(this.pinch?.distance>0){const before=this.unproject(this.pinch.x,this.pinch.y),after=this.unproject(x,y);this.cx+=before.x-after.x;this.cy+=before.y-after.y;this.zoomAt(distance/this.pinch.distance,x,y);}
        this.pinch={distance,x,y};this.drag.moved=true;return;}
      if(this.drag){const initial=this.unproject(this.drag.point.x,this.drag.point.y,this.drag.cx,this.drag.cy),current=this.unproject(p.x,p.y,this.drag.cx,this.drag.cy);this.cx=this.drag.cx+initial.x-current.x;this.cy=this.drag.cy+initial.y-current.y;this.drag.moved ||= Math.hypot(p.x-this.drag.point.x,p.y-this.drag.point.y)>5;this.clamp();this.draw();}
    });
    const release=e=>{if(!this.pointers.has(e.pointerId))return;const p=this.local(e),clicked=this.drag&&!this.drag.moved&&this.pointers.size===1;this.pointers.delete(e.pointerId);this.pinch=null;this.drag=null;if(clicked){if(e.pointerType==='touch')this.tap(p);else this.hit(p);}if(this.pointers.size){const remaining=[...this.pointers.values()][0];this.drag={point:remaining,cx:this.cx,cy:this.cy,moved:true};}};
    const cancel=()=>{this.pointers.clear();this.drag=null;this.pinch=null;this.toolCursor=null;this.draw();};
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',cancel);
    canvas.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))cancel();});
    canvas.addEventListener('pointerleave',e=>{if(e?.pointerType==='touch')return;if(this.hovered||this.hoveredCell||this.toolCursor){this.hovered=null;this.hoveredCell=null;this.toolCursor=null;canvas.style.cursor=this.toolMode?'crosshair':'grab';this.draw();}});
    canvas.addEventListener('keydown',e=>{const pan={ArrowLeft:[-40,0],ArrowRight:[40,0],ArrowUp:[0,-40],ArrowDown:[0,40]}[e.key];if(pan){const center=this.unproject(this.width/2+pan[0],this.height/2+pan[1]);this.cx=center.x;this.cy=center.y;}else if(e.key==='+')this.zoomAt(1.4);else if(e.key==='-')this.zoomAt(1/1.4);else return;e.preventDefault();this.hovered=null;this.hoveredCell=null;this.clamp();this.draw();});
  }
  local(e){const r=this.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  resize(){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*this.dpr);this.canvas.height=Math.round(r.height*this.dpr);this.draw();}
  get viewIso(){return !this.plan&&this.iso;}
  get viewRotation(){return this.rotation;}
  planGeometry(row){
    const f=objectFootprint(row),points=[[f.x,f.y],[f.x+f.width,f.y],[f.x+f.width,f.y+f.height],[f.x,f.y+f.height]].map(([x,y])=>this.project(x,y));
    return {f,points,center:this.project(f.x+f.width/2,f.y+f.height/2),minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
  }
  objectPosition(row){return this.plan?footprintCenter(row):visualPosition(row);}
  project(x,y){return projectPoint(x,y,this.cx,this.cy,this.zoom,this.width,this.height,this.viewIso,this.viewRotation,this.plan);}
  unproject(x,y,cx=this.cx,cy=this.cy){return unprojectPoint(x,y,cx,cy,this.zoom,this.width,this.height,this.viewIso,this.viewRotation,this.plan);}
  clamp(){this.cx=Math.max(-200,Math.min(1400,this.cx));this.cy=Math.max(-200,Math.min(1400,this.cy));}
  zoomAt(factor,x=this.width/2,y=this.height/2){const before=this.unproject(x,y);this.zoom=Math.max(.24,Math.min(MAX_ZOOM,this.zoom*factor));const after=this.unproject(x,y);this.cx+=before.x-after.x;this.cy+=before.y-after.y;this.clamp();this.draw();}
  center(x,y,zoom=6){this.cx=x;this.cy=y;this.zoom=Math.max(.24,Math.min(MAX_ZOOM,zoom));this.hovered=null;this.hoveredCell=null;this.canvas.style.cursor='grab';this.draw();}
  fit(){this.cx=this.cy=600;const m=projectionMatrix(1,this.viewIso,this.viewRotation,this.plan);this.zoom=Math.min(this.width*.90/(1200*(Math.abs(m.a)+Math.abs(m.c))),this.height*.86/(1200*(Math.abs(m.b)+Math.abs(m.d))));this.hovered=null;this.hoveredCell=null;this.draw();}
  setRows(rows){this.rows=rows;if(this.hovered&&!rows.some(r=>r.id===this.hovered.id)){this.hovered=null;this.canvas.style.cursor='grab';}this.draw();}
  markerSize(row){return markerDisplaySize(row,this.zoom,this.viewIso??!!this.iso);}
  pick(p,touch=false){
    if(this.plan){const world=this.unproject(p.x,p.y);return [...this.rows].filter(row=>containsFootprint(row,world.x,world.y)).sort((a,b)=>{const fa=objectFootprint(a),fb=objectFootprint(b);return fa.width*fa.height-fb.width*fb.height||String(a.id).localeCompare(String(b.id));})[0]??null;}
    let best=null,min=Infinity;
    for(const row of this.rows){const pos=visualPosition(row),s=this.project(pos.x,pos.y),size=this.markerSize(row),image=this.images.get(sprite(row));
      const art=markerArtwork(row,image,size),ih=art.height,dx=p.x-s.x,dy=p.y-s.y;
      const padding=touch?12:3,inside=this.zoom>=1.35&&dx>=art.inkLeft-padding&&dx<=art.inkRight+padding&&dy>=art.inkTop-padding&&dy<=art.inkBottom+padding;
      const distance=Math.hypot(dx,dy),score=inside?Math.hypot(dx-(art.left+art.width/2),dy-(art.top+ih/2))*.6:distance;
      if((inside||distance<Math.max(touch?22:8,this.zoom*2))&&score<min){min=score;best=row;}
    }return best;
  }
  hover(p){if(this.toolMode){const world=this.unproject(p.x,p.y),cell=coordinateCell(world.x,world.y),next=validMapPoint(cell)?cell:null,changed=next?.x!==this.toolCursor?.x||next?.y!==this.toolCursor?.y;this.toolCursor=next;this.canvas.style.cursor='crosshair';if(changed&&this.toolPoints.length===1)this.draw();return;}
    const row=this.pick(p),world=this.unproject(p.x,p.y),cell=this.plan?coordinateCell(world.x,world.y):null,valid=cell&&cell.x>=0&&cell.y>=0&&cell.x<1200&&cell.y<1200?cell:null;
    if(row?.id!==this.hovered?.id||valid?.x!==this.hoveredCell?.x||valid?.y!==this.hoveredCell?.y){this.hovered=row;this.hoveredCell=valid;this.canvas.style.cursor=row?'pointer':'grab';this.draw();}}
  setTool(mode){this.toolMode=['distance','zone'].includes(mode)?mode:'';this.clearTool();}
  clearTool(){this.toolPoints=[];this.toolCursor=null;this.hovered=null;this.hoveredCell=null;this.canvas.style.cursor=this.toolMode?'crosshair':'grab';this.draw();this.toolChange?.();}
  setToolPoints(points){if(!this.toolMode||points.length>2||!points.every(validMapPoint))return false;this.toolPoints=points.map(p=>({...p}));this.toolCursor=null;this.draw();this.toolChange?.();return true;}
  addToolPoint(point){return this.setToolPoints(this.toolPoints.length===1?[this.toolPoints[0],point]:[point]);}
  tap(p={x:this.width/2,y:this.height/2}){this.coordinates(this.unproject(p.x,p.y));if(!this.toolMode)this.hover(p);this.hit(p,true,false);}
  hit(p,touch=false,center=true){
    if(this.toolMode){const world=this.unproject(p.x,p.y),cell=coordinateCell(world.x,world.y);if(!validMapPoint(cell))return;
      const row=this.toolMode==='distance'?this.pick(p,touch):null,point=row?{x:row.x,y:row.y,label:displayName(row)}:cell;
      this.addToolPoint(point);return;}
    if(this.inspectMode&&this.inspect){const world=this.unproject(p.x,p.y),cell=coordinateCell(world.x,world.y);this.inspect(cell.x,cell.y);return;}const best=this.plan?this.pick(p):touch||this.aimHover?this.pick(p,touch,true):this.hovered||this.pick(p);if(best)this.select(best,center);}
  drawTool(){
    if(!this.toolMode||!this.toolPoints.length)return;
    const ctx=this.ctx,a=this.toolPoints[0],b=this.toolPoints[1]??this.toolCursor;
    ctx.save();ctx.strokeStyle='#7ce8ef';ctx.lineWidth=2;ctx.fillStyle='#7ce8ef26';
    if(b&&this.toolMode==='zone'){const zone=mapZone(a,b),points=[[zone.minX,zone.minY],[zone.maxX+1,zone.minY],[zone.maxX+1,zone.maxY+1],[zone.minX,zone.maxY+1]].map(p=>this.project(...p));
      ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fill();ctx.stroke();}
    if(b&&this.toolMode==='distance'){const p=this.project(a.x+.5,a.y+.5),q=this.project(b.x+.5,b.y+.5);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.setLineDash(this.toolPoints.length===2?[]:[5,4]);ctx.stroke();ctx.setLineDash([]);
      const text=t('map.distance_label',{distance:formatNumber(mapDistance(a,b).cases,{maximumFractionDigits:2})});ctx.font=`${this.rulerFontSize>=12?13:11}px -apple-system,sans-serif`;ctx.textAlign='center';const width=Math.min(this.width-16,ctx.measureText(text).width+16),x=Math.max(width/2+8,Math.min(this.width-width/2-8,(p.x+q.x)/2)),y=Math.max(24,Math.min(this.height-80,(p.y+q.y)/2-12));
      ctx.fillStyle='#10231ff5';ctx.fillRect(x-width/2,y-14,width,20);ctx.fillStyle='#7ce8ef';ctx.fillText(text,x,y,width-8);}
    ctx.font='bold 11px -apple-system,sans-serif';ctx.textAlign='center';
    for(const [index,point] of this.toolPoints.entries()){const p=this.project(point.x+.5,point.y+.5);ctx.fillStyle='#10231f';ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#7ce8ef';ctx.fillText(index?'B':'A',p.x,p.y+4);}
    ctx.restore();
  }
  planHoverRulers(){
    if(!this.showHoverCoordinates||!this.hoveredCell)return [];
    const ctx=this.ctx,w=this.width,h=this.height;
    return ['X','Y'].flatMap(axis=>{
      const value=this.hoveredCell[axis.toLowerCase()],text=axis+' '+value,width=ctx.measureText(text).width+10;
      const a=axis==='X'?this.project(value+.5,0):this.project(0,value+.5),b=axis==='X'?this.project(value+.5,1200):this.project(1200,value+.5);
    const left=8+width/2,right=w-8-width/2,top=34,bottom=h-(this.rulerBottom??57);
      // Use the usual ruler edge when possible, otherwise the opposite edge.
      // Each badge centre remains on the real coordinate line, never a clamped value.
      const edges=axis==='X'?[['y',bottom],['y',top],['x',right],['x',left]]:[['x',left],['x',right],['y',top],['y',bottom]];
      for(const [dimension,edge] of edges){
        const t=(edge-a[dimension])/(b[dimension]-a[dimension]),x=a.x+t*(b.x-a.x),y=a.y+t*(b.y-a.y);
        // Extend the ruler line outside the kingdom at overview zoom, without
        // changing its coordinate (the terrain itself may not reach an edge).
        if(!Number.isFinite(t)||x<left-1e-7||x>right+1e-7||y<top-1e-7||y>bottom+1e-7)continue;
        return [{axis,text,x,y,width,color:axis==='X'?'#7ce8ef':'#ffd180'}];
      }
      return [];
    });
  }
  drawCoordinateGrid(labelsOnly=false){
    const ctx=this.ctx,m=projectionMatrix(this.zoom,this.viewIso,this.viewRotation,this.plan);
    const stretch=Math.min(Math.hypot(m.a,m.c),Math.hypot(m.b,m.d));
    const step=this.plan&&this.zoom>=8?1:[1,2,5,10,20,50,100,200,400].find(n=>n*stretch>=32)??400;
    const corners=[[0,0],[this.width,0],[0,this.height],[this.width,this.height]].map(([x,y])=>this.unproject(x,y));
    const startX=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x))/step)*step),endX=Math.min(1200,Math.ceil(Math.max(...corners.map(p=>p.x))/step)*step);
    const startY=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y))/step)*step),endY=Math.min(1200,Math.ceil(Math.max(...corners.map(p=>p.y))/step)*step);
    const lines=[];
    for(let i=startX;i<=endX;i+=step)lines.push([this.project(i,0),this.project(i,1200)]);
    for(let i=startY;i<=endY;i+=step)lines.push([this.project(0,i),this.project(1200,i)]);
    // Screen-space strokes keep the contrast/thickness stable in 2D and 2.5D.
    ctx.save();
    if(!labelsOnly){ctx.beginPath();for(const [a,b] of lines){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}
      ctx.strokeStyle=this.plan?'#10251d55':'#10251d99';ctx.lineWidth=this.plan?1:2.5;ctx.stroke();ctx.strokeStyle='#f1e8c580';ctx.lineWidth=this.plan?.5:1;ctx.stroke();}
    // Rulers live on the viewport edges, not across the map cells.  This is
    // particularly important in 2D: an in-map label between two rows made it
    // unclear whether it described the row above or below it.
    if(labelsOnly){
        ctx.font=`${this.rulerFontSize??9}px -apple-system,sans-serif`;ctx.textAlign='center';let previousX=-Infinity;
        const bottom=this.height-(this.rulerBottom??57),labelHeight=Math.max(17,(this.rulerFontSize??9)+8);
        const active=this.plan?this.planHoverRulers():[];
        const overlaps=(x,y,width)=>active.some(p=>Math.abs(p.x-x)<(p.width+width)/2+6&&Math.abs(p.y-y)<22);
        for(let i=startX;i<Math.min(1200,endX+1);i+=step){const a=this.project(i+.5,0),b=this.project(i+.5,1200),t=(bottom-a.y)/(b.y-a.y),px=a.x+t*(b.x-a.x),text='X '+i,width=ctx.measureText(text).width+10;
          // At overview zoom the terrain may not reach the screen edge. Keep
          // the ruler on this line's natural extension, rather than dropping
          // its coordinate or placing it between two map cells.
          if(!Number.isFinite(t))continue;
          if(px<width/2+8||px>this.width-width/2-8||px-previousX<width+6)continue;previousX=px;
          if(overlaps(px,bottom,width))continue;
          ctx.fillStyle='#10231fe8';ctx.fillRect(px-width/2,bottom-8,width,labelHeight);ctx.fillStyle='#f3e9ce';ctx.fillText(text,px,bottom+4);
        }
        ctx.textAlign='left';let previousY=Infinity;
        for(let i=startY;i<Math.min(1200,endY+1);i+=step){const text='Y '+i,width=ctx.measureText(text).width+10,a=this.project(0,i+.5),b=this.project(1200,i+.5),t=(8+width/2-a.x)/(b.x-a.x),py=a.y+t*(b.y-a.y);
          if(!Number.isFinite(t))continue;
          if(py<26||py>bottom-23||Math.abs(py-previousY)<labelHeight+3)continue;previousY=py;
          if(overlaps(8+width/2,py,width))continue;
          ctx.fillStyle='#10231fe8';ctx.fillRect(8,py-8,width,labelHeight);ctx.fillStyle='#f3e9ce';ctx.fillText(text,13,py+4);
        }
        if(this.plan&&this.hoveredCell){const cell=this.project(this.hoveredCell.x+.5,this.hoveredCell.y+.5);
          for(const p of active){ctx.beginPath();ctx.moveTo(cell.x,cell.y);ctx.lineTo(p.x,p.y);ctx.strokeStyle=p.color+'88';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);
            ctx.fillStyle=p.color;ctx.fillRect(p.x-p.width/2,p.y-8,p.width,labelHeight);ctx.fillStyle='#10231f';ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y+4);}
        }
    }
    ctx.restore();
  }
  drawHomeTarget(){
    const row=this.homeTarget;if(!row)return;
    const {points,center,minY,maxX,minX,maxY}=this.planGeometry(row);
    if(maxX<0||minX>this.width||maxY<0||minY>this.height)return;
    const ctx=this.ctx;ctx.save();ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.strokeStyle='#ffd180';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.stroke();ctx.setLineDash([]);
    ctx.font='11px -apple-system,sans-serif';const text='⌂ '+displayName(row),width=Math.min(this.width-16,ctx.measureText(text).width+16),x=Math.max(width/2+8,Math.min(this.width-width/2-8,center.x)),y=Math.max(24,Math.min(this.height-80,minY-18));
    ctx.fillStyle='#10231ff5';ctx.fillRect(x-width/2,y-14,width,20);ctx.fillStyle='#ffd180';ctx.textAlign='center';ctx.fillText(text,x,y,width-8);ctx.restore();
  }
  drawPlanObjects(){
    const ctx=this.ctx,z=this.zoom,w=this.width,h=this.height;
    const visible=[];
    for(const row of this.rows){const geometry=this.planGeometry(row);if(geometry.maxX>=0&&geometry.minX<=w&&geometry.maxY>=0&&geometry.minY<=h)visible.push({row,...geometry});}
    const priority=row=>this.hovered?.id===row.id?2:this.selected?.id===row.id?1:0;
    visible.sort((a,b)=>priority(a.row)-priority(b.row)||a.f.width*a.f.height-b.f.width*b.f.height||String(a.row.id).localeCompare(String(b.row.id)));
    for(const {row,f,points,center,minY} of visible){
      const selected=this.selected?.id===row.id,hovered=this.hovered?.id===row.id,active=selected||hovered;
      const width=f.width*z,height=f.height*z;
      ctx.save();ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();
      ctx.fillStyle=this.color(row);ctx.globalAlpha=active?.58:.38;ctx.fill();ctx.globalAlpha=1;
      ctx.strokeStyle=active?'#ffe1a3':this.color(row);ctx.lineWidth=active?2.5:1;ctx.setLineDash(f.known?[]:[3,3]);ctx.stroke();ctx.setLineDash([]);
      // The minimum X,Y corner rotates with the grid, never with sprite art.
      if(z>=8){const anchor=this.project(f.x,f.y);ctx.fillStyle=active?'#ffe1a3':'#e9eee8';ctx.fillRect(anchor.x-1.5,anchor.y-1.5,3,3);}
      ctx.textAlign='center';ctx.fillStyle='#f3f4e9';
      if(width>=22&&height>=18&&!(active&&f.known&&z>=24)){ctx.font='bold 10px -apple-system,sans-serif';ctx.fillText(footprintLabel(row),center.x,center.y+3,width-4);}
      if(active&&f.known&&z>=24){ctx.font=`${this.rulerFontSize>=12?(z>=32?12:10):(z>=32?9:7)}px monospace`;for(let y=f.y;y<f.y+f.height;y++)for(let x=f.x;x<f.x+f.width;x++){const center=this.project(x+.5,y+.5);ctx.fillText('X'+x,center.x,center.y-2,z-2);ctx.fillText('Y'+y,center.x,center.y+9,z-2);}}
      if((active||(this.planLabels&&z>=12&&category(row)!=='flags'&&category(row)!=='mines')||(this.hqLabels&&category(row)==='hq'))&&!(hovered&&this.hasHoverName(row))){
        const label=active?`${displayName(row)} · ${f.known?f.width+'×'+f.height:t('map.unknown_footprint')} · X ${f.x} / Y ${f.y}`:displayName(row);
        ctx.font=active?'bold 11px -apple-system,sans-serif':'10px -apple-system,sans-serif';
        const labelWidth=Math.min(w-16,ctx.measureText(label).width+12),lx=Math.max(labelWidth/2+8,Math.min(w-labelWidth/2-8,center.x)),ly=Math.max(20,Math.min(h-30,minY-8));
        ctx.fillStyle='#142722ed';ctx.fillRect(lx-labelWidth/2,ly-14,labelWidth,19);ctx.fillStyle='#f3eee0';ctx.fillText(label,lx,ly,labelWidth-8);
      }
      ctx.restore();
    }
    if(this.hoveredCell){const {x,y}=this.hoveredCell,points=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([cx,cy])=>this.project(cx,cy));
      ctx.save();ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fillStyle='#ffffff18';ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();}
  }
  hasHoverName(row=this.hovered){return typeof row?.name==='string'&&row.name.trim().length>0;}
  drawHoveredName(){
    const row=this.hovered;if(!this.hasHoverName(row))return;
    const ctx=this.ctx,w=this.width,h=this.height;ctx.save();ctx.textAlign='center';
    if(this.plan){
      const geometry=this.planGeometry(row);if(geometry.maxX<0||geometry.minX>w||geometry.maxY<0||geometry.minY>h){ctx.restore();return;}
      const {f,center,minY}=geometry,label=`${displayName(row)} · ${f.known?f.width+'×'+f.height:t('map.unknown_footprint')} · X ${f.x} / Y ${f.y}`;
      ctx.font='bold 11px -apple-system,sans-serif';const width=Math.min(w-16,ctx.measureText(label).width+12),x=Math.max(width/2+8,Math.min(w-width/2-8,center.x)),y=Math.max(20,Math.min(h-30,minY-8));
      ctx.fillStyle='#142722ed';ctx.fillRect(x-width/2,y-14,width,19);ctx.fillStyle='#f3eee0';ctx.fillText(label,x,y,width-8);
    }else {
      const position=visualPosition(row),p=this.project(position.x,position.y),label=displayName(row),art=markerArtwork(row,this.images.get(sprite(row)),this.markerSize(row));
      if(p.x+art.inkRight<=-20||p.x+art.inkLeft>=w+20||p.y+Math.max(art.inkBottom,art.labelY+22)<=-20||p.y+art.inkTop>=h+20){ctx.restore();return;}
      ctx.font='bold 12px -apple-system,sans-serif';const width=Math.min(w-24,ctx.measureText(label).width+16),x=Math.max(width/2+8,Math.min(w-width/2-8,p.x)),y=Math.max(20,Math.min(h-42,p.y+art.labelY));
      ctx.fillStyle='#10231ff5';ctx.fillRect(x-width/2,y,width,22);ctx.fillStyle='#f0ecd8';ctx.fillText(label,x,y+16,width-12);
    }
    ctx.restore();
  }
  draw(){
    if(!this.width||!this.height)return;
    const ctx=this.ctx,{width:w,height:h,dpr:d}=this;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#23352c';ctx.fillRect(0,0,w,h);
    if(this.aimHover&&!this.toolMode&&!this.inspectMode){
      const world=this.unproject(w/2,h/2),cell=coordinateCell(world.x,world.y);
      // The stationary phone crosshair acts like a mouse on stable sprite bounds.
      this.hovered=this.pick({x:w/2,y:h/2},false,true);
      this.hoveredCell=this.plan&&validMapPoint(cell)?cell:null;this.coordinates(world);
    }
    const origin=this.project(0,0),z=this.zoom;
    const matrix=projectionMatrix(z,this.viewIso,this.viewRotation,this.plan);
    ctx.save();ctx.transform(matrix.a,matrix.b,matrix.c,matrix.d,origin.x,origin.y);
    const ground=this.plan||this.backgroundMode==='mask'?this.terrain:(this.reconstructedTerrain||this.terrain);
    const smooth=ctx.imageSmoothingEnabled;if(this.plan)ctx.imageSmoothingEnabled=false;
    if(ground)ctx.drawImage(ground,0,0,1200,1200);else{ctx.fillStyle='#7e9c53';ctx.fillRect(0,0,1200,1200);}
    ctx.imageSmoothingEnabled=smooth;
    // Original square surface follows the world projection. Static exclusions
    // and red-zone overlays remain above it; building sprites stay upright.
    drawRoyalGround(ctx,this.royalGround,this);
    if(this.showObstacles&&this.obstacles){const smoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;ctx.globalAlpha=.75;ctx.drawImage(this.obstacles,0,0,1200,1200);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=smoothing;}
    if(this.showSiteZones&&this.siteZones){
      if(this.zoneFill){const smoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;ctx.drawImage(this.zoneFill,0,0,1200,1200);ctx.imageSmoothingEnabled=smoothing;}
      ctx.strokeStyle='#f15e69';ctx.lineWidth=1.5/z;ctx.setLineDash([]);ctx.beginPath();
      for(const region of this.siteZones.regions)for(const path of region.paths){ctx.moveTo(...path[0]);for(const p of path.slice(1))ctx.lineTo(...p);ctx.closePath();}
      ctx.stroke();
    }
    if(this.probe){ctx.strokeStyle=this.probe.status==='static_exclusion'?'#ff7078':'#f5d39b';ctx.lineWidth=2/z;ctx.fillStyle=this.probe.status==='static_exclusion'?'#ff707838':'#f5d39b38';ctx.fillRect(this.probe.x,this.probe.y,2,2);ctx.strokeRect(this.probe.x,this.probe.y,2,2);}
    ctx.strokeStyle='#d6c39766';ctx.lineWidth=2/z;ctx.strokeRect(0,0,1200,1200);ctx.restore();
    // Gentle local relief treatment; no claim of recovered native shaders.
    if(!this.plan){const shade=ctx.createRadialGradient(w*.5,h*.48,0,w*.5,h*.5,Math.max(w,h)*.8);shade.addColorStop(0,'#12251a00');shade.addColorStop(1,this.backgroundMode==='mask'?'#061d184a':'#17301612');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);}
    if(this.showGrid||this.plan)this.drawCoordinateGrid();
    if(this.plan){this.drawPlanObjects();this.drawHomeTarget();this.drawTool();this.drawCoordinateGrid(true);this.drawHoveredName();document.getElementById('scale').textContent=t('map.scale',{count:Math.round(100/z)});return;}
    const visible=[];
    for(const row of this.rows){const pos=visualPosition(row),p=this.project(pos.x,pos.y),art=markerArtwork(row,this.images.get(sprite(row)),this.markerSize(row));if(p.x+art.inkRight>-20&&p.x+art.inkLeft<w+20&&p.y+Math.max(art.inkBottom,art.labelY+22)>-20&&p.y+art.inkTop<h+20)visible.push({row,p});}
    // Hover only promotes the final name label, never the building artwork.
    const priority=row=>this.selected?.id===row.id?2:this.hqLabels&&category(row)==='hq'?1:0;
    visible.sort((a,b)=>priority(a.row)-priority(b.row)||a.p.y-b.p.y);
    for(const {row,p} of visible){
      const selected=this.selected?.id===row.id,hovered=this.hovered?.id===row.id,cat=category(row),color=this.color(row),file=sprite(row),image=this.images.get(file);
      ctx.save();ctx.translate(p.x,p.y);
      const persistentHQ=this.hqLabels&&cat==='hq';
      if(z<1.35&&!selected&&!persistentHQ){ctx.fillStyle=color;ctx.globalAlpha=cat==='mines'?.52:1;ctx.beginPath();ctx.arc(0,0,cat==='hq'||cat==='bears'?3:cat==='players'?2.4:1.8,0,Math.PI*2);ctx.fill();ctx.restore();continue;}
      const size=this.markerSize(row);
      const art=markerArtwork(row,image,size),groundY=art.groundY;
      // Native sprites already contain their ground/shadow. An added ellipse
      // makes them look perched on a floating disk. Keep it only for glyphs,
      // never for illustrated buildings (including Arsenal/Mobilisation).
      if(!image){
        ctx.fillStyle='#0a1b1866';ctx.beginPath();ctx.ellipse(0,groundY+2,size*.33,size*.10,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=color;ctx.lineWidth=selected?2.5:1.6;ctx.globalAlpha=.85;ctx.beginPath();ctx.ellipse(0,groundY,size*.4,size*.17,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
      }
      if(selected){ctx.strokeStyle='#f4d79d';ctx.lineWidth=2;ctx.setLineDash([3,3]);ctx.beginPath();ctx.ellipse(0,groundY+1,size*.52,size*.24,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
      if(image){ctx.drawImage(image,art.left,art.top,art.width,art.height);if(cat==='flags'){ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,art.top+art.height*.28,4,0,Math.PI*2);ctx.fill();}}
      else{ctx.fillStyle=color;ctx.font=`${Math.max(12,size*.5)}px Georgia`;ctx.textAlign='center';ctx.fillText(glyph(row),0,0);}
      if(image&&cat!=='flags'&&row.alliance_id){ctx.fillStyle=color;ctx.strokeStyle='#142722';ctx.lineWidth=1;ctx.beginPath();ctx.arc(art.inkRight+2,art.inkBottom-3,3,0,Math.PI*2);ctx.fill();ctx.stroke();}
      if(((this.labels&&z>5&&cat!=='mines'&&cat!=='flags')||persistentHQ||selected||hovered)&&!(hovered&&this.hasHoverName(row))){
        ctx.font=hovered?'bold 12px -apple-system,sans-serif':'10px -apple-system,sans-serif';ctx.textAlign='center';
        const text=displayName(row),label=hovered?text:text.length>29?text.slice(0,28)+'…':text;
        const lw=Math.min(w-24,ctx.measureText(label).width+16),labelX=Math.max(-p.x+lw/2+8,Math.min(w-p.x-lw/2-8,0)),labelY=Math.max(-p.y+20,Math.min(h-p.y-42,art.labelY));
        ctx.fillStyle=hovered?'#10231ff5':'#142722e6';ctx.fillRect(labelX-lw/2,labelY,lw,hovered?22:17);
        ctx.fillStyle='#f0ecd8';ctx.fillText(label,labelX,labelY+(hovered?16:12),lw-12);
      }
      ctx.restore();
    }
    this.drawHomeTarget();
    this.drawTool();
    // The map is already oriented north-up; keep the compass point fixed upward.
    const nx=0,ny=-1;
    ctx.strokeStyle='#e2dcc7';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(w-44,h-68);ctx.lineTo(w-44+nx*15,h-68+ny*15);ctx.stroke();ctx.font='9px Georgia';ctx.fillStyle='#e2dcc7';ctx.textAlign='center';ctx.fillText('N',w-44+nx*23,h-65+ny*23);
    this.drawHoveredName();
    if(this.showGrid)this.drawCoordinateGrid(true);
    document.getElementById('scale').textContent=t('map.scale',{count:Math.round(100/z)});
  }
}
