/* Offline-first internationalisation. Packs are read-only backend plugins. */
const STORAGE_KEY='atlas690-locale';
const EXPLICIT_STORAGE_KEY='atlas690-locale-explicit';
const FALLBACK_LOCALE='fr';
const LOCALE_FLAGS={fr:'🇫🇷',en:'🇬🇧',es:'🇪🇸',de:'🇩🇪','pt-BR':'🇧🇷',it:'🇮🇹',nl:'🇳🇱',pl:'🇵🇱',tr:'🇹🇷',ru:'🇷🇺',uk:'🇺🇦',ar:'🇸🇦',hi:'🇮🇳',id:'🇮🇩',ja:'🇯🇵',ko:'🇰🇷','zh-CN':'🇨🇳','zh-TW':'🇹🇼'};
const BUILTIN_FR={
  'result.count':{one:'{{formattedCount}} résultat',other:'{{formattedCount}} résultats'},
  'map.summary':'{{castles}} châteaux · {{owned}} bâtiments associés · {{traps}} pièges à ours repérés{{partial}}',
  'map.scale':'{{count}} cases / 100 px','map.distance_label':'{{distance}} cases · ligne droite','map.unknown_footprint':'empreinte inconnue','layers.heading':'Calques de la carte','background.reconstructed':'Reconstruction · captures du jeu','background.mask':'Masque logique · ancien fond',
  'alignment.position':'{{label}} : X{{x}} / Y{{y}} · niveau{{level}}','alignment.summary':'Simulation uniquement. Écart2 = empreintes2×2 voisines sans case vide. Comparez les bases, pas les toits. L’essai du gris reste local à cette page.',
  'map.partial':' · lecture partielle','origin.all':'Tous les royaumes extérieurs','origin.option':'Royaume {{kingdom}}','alliance.none':'Toutes les alliances','alliance.option':'{{alliance}} · {{count}} joueurs','result.level':'Niv. {{level}}',
  'scope.summary':'{{scope}} · {{layers}}.','scope.map':'Carte','scope.favorites':'Favoris uniquement','scope.invaders':'Envahisseurs uniquement','scope.no_layers':'aucun calque',
  'access.disabled':'Actualisation désactivée pour ce site. L’instantané reste consultable.','access.read_only':'Accès Wi-Fi en lecture seule. Actualisez depuis le Mac si cette fonction y est activée, puis rechargez cette page.',
  'map.plan_caption':'Plan · empreintes sur grille','map.reconstructed_caption':'Fond reconstruit · référence jeu','map.mask_caption':'Masque du jeu · terrain stylisé',
  'snapshot_age.unknown':'Date de l’instantané inconnue','snapshot_age.future':'Horodatage futur · vérifier l’horloge','snapshot_age.less_than_minute':'moins d’une minute','snapshot_age.days_ago':'il y a {{days}} j {{hours}} h','snapshot_age.hours_ago':'il y a {{hours}} h {{minutes}} min','snapshot_age.minutes_ago':'il y a {{minutes}} min','snapshot_age.prefix':'Instantané : {{value}}',
  'detail.expand':'Agrandir la fiche','detail.reduce':'Réduire la fiche','home.configure':'Configurer mon château'
};
let manifest={default:FALLBACK_LOCALE,locales:[]};
let activeLocale=FALLBACK_LOCALE;
let messages={...BUILTIN_FR};
let fallbackMessages={...BUILTIN_FR};
let sources={};
let fallbackSources={};
const originalText=new WeakMap(),originalAttributes=new WeakMap();

const storedLocale=()=>{try{return localStorage.getItem(STORAGE_KEY)||'';}catch{return '';}};
const hasExplicitLocale=()=>{try{return localStorage.getItem(EXPLICIT_STORAGE_KEY)==='1';}catch{return false;}};
const saveLocale=value=>{try{localStorage.setItem(STORAGE_KEY,value);localStorage.setItem(EXPLICIT_STORAGE_KEY,'1');}catch{/* Preferences are optional. */}};
const pickLocale=available=>{
  const codes=new Set(available.map(item=>item.code));
  const browser=[...(globalThis.navigator?.languages??[]),globalThis.navigator?.language].filter(Boolean);
  const saved=storedLocale();
  const preferred=hasExplicitLocale()?[saved,...browser].filter(Boolean):[...browser,saved].filter(Boolean);
  for(const raw of preferred){
    if(codes.has(raw))return raw;
    const base=String(raw).split('-')[0],matched=available.find(item=>item.code===base||item.code.startsWith(base+'-'));
    if(matched)return matched.code;
  }
  return codes.has(manifest.default)?manifest.default:FALLBACK_LOCALE;
};
const interpolate=(value,variables)=>String(value).replace(/{{\s*([\w.-]+)\s*}}/g,(_,key)=>key==='count'&&variables.formattedCount!=null?variables.formattedCount:variables[key]??'');
const resolve=(catalogue,key,variables)=>{
  const value=catalogue[key];
  if(value==null)return null;
  if(typeof value==='string')return interpolate(value,variables);
  if(typeof value==='object'){
    const count=Number(variables.count);
    const form=new Intl.PluralRules(activeLocale).select(Number.isFinite(count)?count:0);
    return interpolate(value[form]??value.other??value.one??'',variables);
  }
  return null;
};

export const t=(key,variables={})=>resolve(messages,key,variables)??resolve(fallbackMessages,key,variables)??key;
export const locale=()=>activeLocale;
export const formatNumber=(value,options={})=>new Intl.NumberFormat(activeLocale,options).format(value);
export const formatDate=(value,options={})=>new Intl.DateTimeFormat(activeLocale,options).format(value);
export const formatTime=(value,options={})=>new Intl.DateTimeFormat(activeLocale,options).format(value);
export const isRtl=()=>manifest.locales.find(item=>item.code===activeLocale)?.direction==='rtl';
export const translateSource=value=>{
  const raw=String(value),exact=sources[raw]??fallbackSources[raw];
  if(exact!=null)return exact;
  const trimmed=raw.trim();
  if(!trimmed||trimmed===raw)return raw;
  const translated=sources[trimmed]??fallbackSources[trimmed];
  if(translated==null)return raw;
  const leading=raw.match(/^\s*/)?.[0]??'',trailing=raw.match(/\s*$/)?.[0]??'';
  return leading+translated+trailing;
};

function localizeElement(node){
  const key=node.dataset?.i18n;
  if(key)node.textContent=t(key);
  for(const [attribute,datasetKey] of [['aria-label','i18nAriaLabel'],['title','i18nTitle'],['placeholder','i18nPlaceholder'],['content','i18nContent']]){
    const attributeKey=node.dataset?.[datasetKey];
    if(attributeKey)node.setAttribute(attribute,t(attributeKey));
    else if(node.hasAttribute?.(attribute)){
      const remembered=originalAttributes.get(node)??{};
      if(remembered[attribute]===undefined){remembered[attribute]=node.getAttribute(attribute);originalAttributes.set(node,remembered);}
      node.setAttribute(attribute,translateSource(remembered[attribute]));
    }
  }
}
function localizeTextNodes(root){
  if(!root?.ownerDocument?.createTreeWalker)return;
  const walker=root.ownerDocument.createTreeWalker(root,globalThis.NodeFilter?.SHOW_TEXT??4);
  const nodes=[];let node;
  while((node=walker.nextNode())){
    if(['SCRIPT','STYLE','OPTION'].includes(node.parentElement?.tagName)||!node.nodeValue.trim())continue;
    nodes.push(node);
  }
  for(const text of nodes){
    if(!originalText.has(text))originalText.set(text,text.nodeValue);
    text.nodeValue=translateSource(originalText.get(text));
  }
}
export function localizeDocument(root=globalThis.document){
  if(!root?.querySelectorAll)return;
  root.querySelectorAll('[data-i18n],[data-i18n-aria-label],[data-i18n-title],[data-i18n-placeholder],[aria-label],[title],[placeholder],[content]').forEach(localizeElement);
  localizeTextNodes(root.body);
  const html=root.documentElement;
  if(html){html.lang=activeLocale;html.dir=isRtl()?'rtl':'ltr';}
  if(root.title)root.title=t('document.title');
}

function renderPicker(root){
  const picker=root?.getElementById?.('locale');
  if(!picker)return;
  picker.replaceChildren();
  for(const item of manifest.locales){
    const option=root.createElement('option'),flag=LOCALE_FLAGS[item.code]??'🌐';option.value=item.code;option.textContent=flag+' '+item.name;option.selected=item.code===activeLocale;picker.append(option);
  }
  picker.value=activeLocale;
}
async function fetchJSON(path){
  const response=await fetch(path,{cache:'no-store'});
  if(!response.ok)throw new Error('i18n unavailable');
  return response.json();
}
async function loadPack(code){
  const pack=await fetchJSON('./data/i18n/'+encodeURIComponent(code)+'.json');
  return pack&&typeof pack.messages==='object'?{...pack,sources:pack.sources&&typeof pack.sources==='object'?pack.sources:{}}:{locale:code,fallback:FALLBACK_LOCALE,messages:{},sources:{}};
}
async function activate(code){
  const pack=await loadPack(code);
  messages=pack.messages;
  sources=pack.sources;
  if(code===FALLBACK_LOCALE){fallbackMessages=pack.messages;fallbackSources=pack.sources;return;}
  const fallback=manifest.locales.some(item=>item.code===pack.fallback)&&pack.fallback!==code?await loadPack(pack.fallback):await loadPack(FALLBACK_LOCALE);
  fallbackMessages=fallback.messages;
  fallbackSources=fallback.sources;
}
export async function setLocale(code,{root=globalThis.document,persist=true}={}){
  if(!manifest.locales.some(item=>item.code===code))return false;
  try{await activate(code);}catch{return false;}
  activeLocale=code;
  if(persist)saveLocale(code);
  localizeDocument(root);renderPicker(root);
  root?.dispatchEvent?.(new CustomEvent('atlas:localechange',{detail:{locale:code}}));
  return true;
}
export async function initializeI18n(root=globalThis.document){
  // The server test DOM intentionally has no documentElement; do not make its
  // application boot depend on an extra mocked request.
  if(!root?.documentElement||typeof root.documentElement!=='object')return {locale:activeLocale,available:[]};
  try{
    const received=await fetchJSON('./data/i18n/manifest.json');
    if(!Array.isArray(received.locales)||!received.locales.length)throw new Error('empty registry');
    manifest={default:received.default||FALLBACK_LOCALE,locales:received.locales};
    const desired=pickLocale(manifest.locales);
    await activate(desired);
    activeLocale=desired;
  }catch{
    manifest={default:FALLBACK_LOCALE,locales:[{code:FALLBACK_LOCALE,name:'Français',direction:'ltr'}]};
    activeLocale=FALLBACK_LOCALE;
  }
  renderPicker(root);localizeDocument(root);
  if(root.body&&globalThis.MutationObserver){
    new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes){
        if(node.nodeType===(globalThis.Node?.TEXT_NODE??3)){if(!originalText.has(node))originalText.set(node,node.nodeValue);node.nodeValue=translateSource(originalText.get(node));}
        else if(node.nodeType===(globalThis.Node?.ELEMENT_NODE??1)){node.querySelectorAll?.('[data-i18n],[data-i18n-aria-label],[data-i18n-title],[data-i18n-placeholder],[aria-label],[title],[placeholder],[content]').forEach(localizeElement);localizeTextNodes(node);}
      }
    }).observe(root.body,{childList:true,subtree:true});
  }
  root.getElementById?.('locale')?.addEventListener('change',event=>{setLocale(event.target.value,{root});});
  return {locale:activeLocale,available:manifest.locales};
}
