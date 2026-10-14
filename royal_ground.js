// Display calibration from the recovered1024² royal ground image.
// Slab centres210/822 and205/817 match the fixed tower footprint centres595/605.
// These are not native mesh transforms; source raster pixels are unchanged.
export const ROYAL_GROUND=Object.freeze({file:'royal-ground-source-known.png',width:1024,height:1024,
  a:1/61.2,b:0,c:0,d:-1/61.2,e:595-210/61.2,f:605+205/61.2});
export function royalGroundPoint(u,v){const m=ROYAL_GROUND;return{x:m.a*u+m.c*v+m.e,y:m.b*u+m.d*v+m.f};}
// Browser-only edge blend into the reconstructed background. The original
// PNG stays byte-identical. This cosmetic96px fade is NOT a recovered shader.
export function prepareRoyalGround(image){
  if(!image||image.width!==1024||image.height!==1024)return image;
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(1024,1024):typeof document!=='undefined'&&typeof document.createElement==='function'?document.createElement('canvas'):null;
  const ctx=canvas?.getContext?.('2d');if(!ctx)return image;
  canvas.width=canvas.height=1024;ctx.drawImage(image,0,0);ctx.globalCompositeOperation='destination-in';
  for(const [x,y] of [[1024,0],[0,1024]]){
    const fade=ctx.createLinearGradient(0,0,x,y);fade.addColorStop(0,'transparent');fade.addColorStop(96/1024,'#fff');fade.addColorStop(1-96/1024,'#fff');fade.addColorStop(1,'transparent');ctx.fillStyle=fade;ctx.fillRect(0,0,1024,1024);
  }
  return canvas;
}
export function drawRoyalGround(ctx,image,{showRoyalGround=true,plan=false,backgroundMode='reconstructed'}={}){
  if(!showRoyalGround||plan||backgroundMode!=='reconstructed'||!image||image.width!==ROYAL_GROUND.width||image.height!==ROYAL_GROUND.height)return false;
  const m=ROYAL_GROUND;ctx.save();ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);
  ctx.drawImage(image,0,0,m.width,m.height);ctx.restore();return true;
}
