import {initializeI18n,t,formatNumber,translateSource} from './i18n.js';

await initializeI18n();
const $=id=>document.getElementById(id);
const msg=(key,fallback,variables={})=>{const translated=t(key,variables);return translated===key?fallback:translated;};
const normalize=value=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let rows=[],limit=24;
let monsterViewer=null;
function element(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
function render(){
  const query=normalize($('art-search').value),category=$('art-category').value;
  const matched=rows.filter(row=>(!category||row.category===category)&&normalize([row.name,row.category,row.kind].join(' ')).includes(query));
  $('art-grid').replaceChildren();
  for(const row of matched.slice(0,limit)){
    const card=element('article'),link=element('a','','image'),image=element('img');
    const name=translateSource(row.name);link.href=row.file;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',msg('library.open_aria','Ouvrir {{name}}',{name}));
    image.src=row.file;image.alt=name;image.loading='lazy';image.decoding='async';image.width=row.size[0];image.height=row.size[1];link.append(image);
    const info=element('div','','info'),open=element('a',msg('library.open_png','Ouvrir le PNG original'),'open');open.href=row.file;open.target='_blank';open.rel='noopener';
    info.append(element('h2',name),element('p',translateSource(row.kind),'kind'),element('p',row.size.join(' × ')+' px · '+translateSource(row.format)),element('p',translateSource(row.note)));
    if(monsterViewer?.has(row.name)){
      const preview=element('button','Voir en 3D','preview-3d');preview.type='button';
      preview.addEventListener('click',()=>monsterViewer.show(row.name));info.append(preview);
    }
    info.append(open);card.append(link,info);$('art-grid').append(card);
  }
  const shown=Math.min(limit,matched.length);$('art-status').textContent=msg('library.status',`${matched.length} image${matched.length>1?'s':''} · ${shown} affichée${shown>1?'s':''}`,{count:formatNumber(matched.length),countPlural:matched.length>1?'s':'',shown:formatNumber(shown),shownPlural:shown>1?'s':''});
  $('art-more').hidden=limit>=matched.length;
}

// This is a deliberately separate consultation reconstruction.  It uses the
// recovered diffuse textures, but never claims to be the protected Unity mesh.
function matIdentity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function matMultiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return out;}
function matTranslate(x,y,z){const out=matIdentity();out[12]=x;out[13]=y;out[14]=z;return out;}
function matScale(x,y,z){const out=matIdentity();out[0]=x;out[5]=y;out[10]=z;return out;}
function matRotateX(a){const out=matIdentity(),c=Math.cos(a),s=Math.sin(a);out[5]=c;out[6]=s;out[9]=-s;out[10]=c;return out;}
function matRotateY(a){const out=matIdentity(),c=Math.cos(a),s=Math.sin(a);out[0]=c;out[2]=-s;out[8]=s;out[10]=c;return out;}
function matRotateZ(a){const out=matIdentity(),c=Math.cos(a),s=Math.sin(a);out[0]=c;out[1]=s;out[4]=-s;out[5]=c;return out;}
function matPerspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),range=1/(near-far),out=new Float32Array(16);out[0]=f/aspect;out[5]=f;out[10]=(near+far)*range;out[11]=-1;out[14]=2*near*far*range;return out;}
function matModel({x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0}){return matMultiply(matTranslate(x,y,z),matMultiply(matRotateY(ry),matMultiply(matRotateX(rx),matMultiply(matRotateZ(rz),matScale(sx,sy,sz)))));}
function createMonsterViewer(library){
  const wanted=['t_world_monster_035_d','t_monster_rose_wendigo_d','t_world_monster_015','t_world_monster_025'];
  const monsters=wanted.map(name=>library.find(row=>row.name===name)).filter(Boolean);
  if(!monsters.length)return null;
  const section=$('monster-viewer'),canvas=$('monster-canvas'),select=$('monster-select'),status=$('monster-status');
  const labels={
    t_world_monster_035_d:'Monstre 035 · prédateur ailé',
    t_monster_rose_wendigo_d:'Rose Wendigo · colosse',
    t_monster_scarlet_predator_huanse_d:'Scarlet Predator · félin',
    t_world_monster_013:'Monstre 013 · loup',
    t_world_monster_015:'Monstre 015 · sanglier',
    t_world_monster_025:'Monstre 025 · guerrier à la hache'
  };
  section.hidden=false;
  for(const item of monsters){const option=element('option',labels[item.name]||item.name);option.value=item.name;select.append(option);}
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,depth:true});
  if(!gl){status.textContent='WebGL est indisponible dans ce navigateur.';return {has:name=>monsters.some(item=>item.name===name),show:()=>section.scrollIntoView({behavior:'smooth',block:'start'})};}
  const vertexSource='attribute vec3 position;attribute vec3 normal;attribute vec2 uv;uniform mat4 projection;uniform mat4 view;uniform mat4 model;uniform vec4 uvWindow;varying vec2 texCoord;varying float light;void main(){vec3 n=normalize(mat3(model)*normal);light=.62+.38*max(dot(n,normalize(vec3(-.45,.8,.65))),0.);texCoord=uv*uvWindow.zw+uvWindow.xy;gl_Position=projection*view*model*vec4(position,1.);}';
  const fragmentSource='precision mediump float;uniform sampler2D texture;uniform vec3 tint;varying vec2 texCoord;varying float light;void main(){vec3 color=mix(texture2D(texture,texCoord).rgb,tint,.08);gl_FragColor=vec4((color*.82+vec3(.13))*light,1.);}';
  function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
  let program;
  try{program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}catch(error){status.textContent='La prévisualisation WebGL ne peut pas être initialisée.';return null;}
  const loc={position:gl.getAttribLocation(program,'position'),normal:gl.getAttribLocation(program,'normal'),uv:gl.getAttribLocation(program,'uv'),projection:gl.getUniformLocation(program,'projection'),view:gl.getUniformLocation(program,'view'),model:gl.getUniformLocation(program,'model'),texture:gl.getUniformLocation(program,'texture'),uvWindow:gl.getUniformLocation(program,'uvWindow'),tint:gl.getUniformLocation(program,'tint')};
  function upload(shape){const buffer=gl.createBuffer(),indices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,shape.vertices,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,shape.indices,gl.STATIC_DRAW);return {buffer,indices,count:shape.indices.length};}
  const nativeModels={t_world_monster_035_d:'./assets/recovered-models/t_world_monster_035_d.glb',t_monster_rose_wendigo_d:'./assets/recovered-models/t_monster_rose_wendigo_d.glb',t_world_monster_015:'./assets/recovered-models/t_world_monster_015.glb',t_world_monster_025:'./assets/recovered-models/t_world_monster_025.glb'};
  let current=monsters[0],texture=gl.createTexture(),angle=Math.PI+.46,pitch=-.13,distance=6.8,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,drag=null,ready=false,exactModel=null;
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(.035,.075,.055,1);
  function readGlb(buffer){const view=new DataView(buffer);if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw Error('GLB invalide');const jsonSize=view.getUint32(12,true),jsonStart=20,json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,jsonStart,jsonSize))),binStart=jsonStart+jsonSize+8,primitive=json.meshes[0].primitives[0];function accessor(index){const source=json.accessors[index],chunk=json.bufferViews[source.bufferView],offset=binStart+(chunk.byteOffset||0)+(source.byteOffset||0);return {source,offset};}const pos=accessor(primitive.attributes.POSITION),normal=accessor(primitive.attributes.NORMAL),uv=accessor(primitive.attributes.TEXCOORD_0),index=accessor(primitive.indices),positions=new Float32Array(buffer,pos.offset,pos.source.count*3),normals=new Float32Array(buffer,normal.offset,normal.source.count*3),uvs=new Float32Array(buffer,uv.offset,uv.source.count*2),indices=index.source.componentType===5123?new Uint16Array(buffer,index.offset,index.source.count):new Uint32Array(buffer,index.offset,index.source.count),vertices=new Float32Array(pos.source.count*8);for(let i=0;i<pos.source.count;i++){vertices.set(positions.subarray(i*3,i*3+3),i*8);vertices.set(normals.subarray(i*3,i*3+3),i*8+3);vertices.set(uvs.subarray(i*2,i*2+2),i*8+6);}const min=pos.source.min,max=pos.source.max,center=[(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2],span=Math.max(max[0]-min[0],max[1]-min[1],max[2]-min[2]);return {vertices,indices,center,scale:3.1/span};}
  function loadNativeMesh(item){exactModel=null;const file=nativeModels[item.name];if(!file)return;const requested=item.name;fetch(file).then(response=>{if(!response.ok)throw Error('maillage indisponible');return response.arrayBuffer();}).then(buffer=>{if(current.name!==requested)return;const decoded=readGlb(buffer);exactModel={...upload(decoded),center:decoded.center,scale:decoded.scale};status.textContent='Maillage et UV Unity originaux appliqués · animation de présentation WebGL.';}).catch(()=>{if(current.name===requested)status.textContent='Maillage Unity indisponible : aucune prévisualisation de substitution.';});}
  function loadTexture(item){ready=false;exactModel=null;status.textContent='Chargement de la texture et du maillage Unity d’origine…';const requested=item.name,image=new Image();image.decoding='async';image.onload=()=>{if(current.name!==requested)return;gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.generateMipmap(gl.TEXTURE_2D);ready=true;};image.onerror=()=>{if(current.name===requested)status.textContent='Texture indisponible pour la prévisualisation.';};image.src=item.file;loadNativeMesh(item);}
  function draw(part,model,material={}){const uv=material.uv||[0,0,1,1],tint=material.tint||[1,1,1];gl.bindBuffer(gl.ARRAY_BUFFER,part.buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,part.indices);const stride=32;gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,stride,12);gl.enableVertexAttribArray(loc.uv);gl.vertexAttribPointer(loc.uv,2,gl.FLOAT,false,stride,24);gl.uniformMatrix4fv(loc.model,false,model);gl.uniform4f(loc.uvWindow,...uv);gl.uniform3f(loc.tint,...tint);gl.drawElements(gl.TRIANGLES,part.count,gl.UNSIGNED_SHORT,0);}
  function drawMonster(time){const bob=playing?Math.sin(time*.002)*.06:0;if(!exactModel)return;draw(exactModel,matModel({x:-exactModel.center[0]*exactModel.scale,y:-exactModel.center[1]*exactModel.scale+bob,z:-exactModel.center[2]*exactModel.scale,sx:exactModel.scale,sy:exactModel.scale,sz:exactModel.scale}),{uv:[0,0,1,1],tint:[1,1,1]});}
  function frame(time){const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(ready){gl.useProgram(program);gl.uniformMatrix4fv(loc.projection,false,matPerspective(.78,width/height,.1,30));gl.uniformMatrix4fv(loc.view,false,matMultiply(matTranslate(0,-.08,-distance),matMultiply(matRotateX(pitch),matRotateY(angle))));gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(loc.texture,0);drawMonster(time);}requestAnimationFrame(frame);}
  select.addEventListener('change',()=>{current=monsters.find(item=>item.name===select.value)||monsters[0];loadTexture(current);});
  $('monster-motion').addEventListener('click',()=>{playing=!playing;$('monster-motion').textContent=playing?'Mettre l’animation en pause':'Relancer l’animation';$('monster-motion').setAttribute('aria-pressed',String(playing));});
  $('monster-reset').addEventListener('click',()=>{angle=Math.PI+.46;pitch=-.13;distance=6.8;});
  canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!drag)return;angle+=(event.clientX-drag.x)*.012;pitch=Math.max(-.75,Math.min(.55,pitch+(event.clientY-drag.y)*.009));drag={x:event.clientX,y:event.clientY};});
  canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('wheel',event=>{event.preventDefault();distance=Math.max(4.1,Math.min(9.2,distance+event.deltaY*.008));},{passive:false});
  canvas.addEventListener('keydown',event=>{if(event.key==='ArrowLeft')angle-=.12;if(event.key==='ArrowRight')angle+=.12;if(event.key==='ArrowUp')pitch=Math.max(-.75,pitch-.08);if(event.key==='ArrowDown')pitch=Math.min(.55,pitch+.08);});
  loadTexture(current);requestAnimationFrame(frame);
  return {has:name=>monsters.some(item=>item.name===name),show:name=>{const item=monsters.find(value=>value.name===name);if(item&&item!==current){select.value=name;select.dispatchEvent(new Event('change'));}section.scrollIntoView({behavior:'smooth',block:'start'});canvas.focus({preventScroll:true});}};
}
for(const event of ['input','change'])$(event==='input'?'art-search':'art-category').addEventListener(event,()=>{limit=24;render();});
$('art-more').addEventListener('click',()=>{limit+=24;render();});
try{
  const response=await fetch('./assets/recovered-library.json');if(!response.ok)throw Error('Inventaire indisponible');
  rows=await response.json();
  if(!Array.isArray(rows)||rows.some(row=>!/^\/assets\/(?:recovered\/[A-Za-z0-9_.-]+|building2001-rgba-source-known|royal-ground-source-known)\.png$/.test(row.file)||!Array.isArray(row.size)||row.size.length!==2))throw Error('Inventaire invalide');
  for(const category of [...new Set(rows.map(row=>row.category))]){const option=element('option',translateSource(category));option.value=category;$('art-category').append(option);}
  monsterViewer=createMonsterViewer(rows);
  render();
}catch(error){$('art-status').textContent=msg('library.load_error','Impossible de charger la collection locale. {{error}}',{error:error.message});}
