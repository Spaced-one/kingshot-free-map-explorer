import {initializeI18n,t,formatNumber,translateSource} from './i18n.js';

await initializeI18n();
const $=id=>document.getElementById(id);
const msg=(key,fallback,variables={})=>{const translated=t(key,variables);return translated===key?fallback:translated;};
const normalize=value=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let rows=[],limit=24;
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
    info.append(element('h2',name),element('p',translateSource(row.kind),'kind'),element('p',row.size.join(' × ')+' px · '+translateSource(row.format)),element('p',translateSource(row.note)),open);card.append(link,info);$('art-grid').append(card);
  }
  const shown=Math.min(limit,matched.length);$('art-status').textContent=msg('library.status',`${matched.length} image${matched.length>1?'s':''} · ${shown} affichée${shown>1?'s':''}`,{count:formatNumber(matched.length),countPlural:matched.length>1?'s':'',shown:formatNumber(shown),shownPlural:shown>1?'s':''});
  $('art-more').hidden=limit>=matched.length;
}
for(const event of ['input','change'])$(event==='input'?'art-search':'art-category').addEventListener(event,()=>{limit=24;render();});
$('art-more').addEventListener('click',()=>{limit+=24;render();});
try{
  const response=await fetch('./assets/recovered-library.json');if(!response.ok)throw Error('Inventaire indisponible');
  rows=await response.json();
  if(!Array.isArray(rows)||rows.some(row=>!/^\/assets\/(?:recovered\/[A-Za-z0-9_.-]+|building2001-rgba-source-known|royal-ground-source-known)\.png$/.test(row.file)||!Array.isArray(row.size)||row.size.length!==2))throw Error('Inventaire invalide');
  for(const category of [...new Set(rows.map(row=>row.category))]){const option=element('option',translateSource(category));option.value=category;$('art-category').append(option);}
  render();
}catch(error){$('art-status').textContent=msg('library.load_error','Impossible de charger la collection locale. {{error}}',{error:error.message});}
