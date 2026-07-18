
/* ============ i18n — home screen (main: FR · EN/AR/ES/ZH) ============ */
const I18N={
 fr:{dir:'ltr',search:'Tu as faim ?!',mind:"Qu'est-ce qui te tente ?",nearT:'Commande sur WhatsApp',nearS:'Les restos près de chez toi',nearCta:'📍 Voir les restos',popular:'Restos populaires près de toi',nav:['Accueil','Favoris','Commandes','Menu']},
 en:{dir:'ltr',search:'Are you hungry?!',mind:'What are you craving?',nearT:'Order on WhatsApp',nearS:'Restaurants near you',nearCta:'📍 See restaurants',popular:'Popular restaurants nearby',nav:['Home','Wishlist','Orders','Menu']},
 ar:{dir:'rtl',search:'هل أنت جائع؟!',mind:'ما الذي تشتهيه؟',nearT:'اطلب عبر واتساب',nearS:'المطاعم القريبة منك',nearCta:'📍 عرض المطاعم',popular:'مطاعم شهيرة بالقرب منك',nav:['الرئيسية','المفضلة','الطلبات','القائمة']},
 es:{dir:'ltr',search:'¿Tienes hambre?',mind:'¿Qué te apetece?',nearT:'Pide por WhatsApp',nearS:'Restaurantes cerca de ti',nearCta:'📍 Ver restaurantes',popular:'Restaurantes populares cerca',nav:['Inicio','Favoritos','Pedidos','Menú']},
 zh:{dir:'ltr',search:'饿了吗？',mind:'今天想吃什么？',nearT:'通过 WhatsApp 下单',nearS:'你附近的餐厅',nearCta:'📍 查看餐厅',popular:'附近热门餐厅',nav:['首页','收藏','订单','菜单']}
};
const LANGS=['fr','en','ar','es','zh'];let curLang='fr';
function applyLang(){
  const t=I18N[curLang];
  document.getElementById('langBtn').textContent='🌐 '+curLang.toUpperCase();
  document.getElementById('homeView').setAttribute('dir',t.dir);
  document.getElementById('hvSearchTxt').textContent=t.search;
  document.getElementById('hvMind').textContent=t.mind;
  document.getElementById('hvNearT').textContent=t.nearT;
  document.getElementById('hvNearS').textContent=t.nearS;
  document.getElementById('hvNearCta').textContent=t.nearCta;
  document.getElementById('hvPopular').textContent=t.popular;
  ['navHome','navWish','navOrders','navMenu'].forEach((id,i)=>{document.getElementById(id).textContent=t.nav[i]});
}
function cycleLang(){curLang=LANGS[(LANGS.indexOf(curLang)+1)%LANGS.length];applyLang()}

/* ================= audio ================= */
let AC=null, soundOn=true;
function toggleSound(){soundOn=!soundOn;document.getElementById('sndBtn').textContent=soundOn?'🔊 Son':'🔇 Muet'}
function beep(f=620,d=.06,f2=null){
  if(!soundOn)return;
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==='suspended')AC.resume();
    const o=AC.createOscillator(),g=AC.createGain();
    o.frequency.value=f;o.type='sine';g.gain.value=.08;
    o.connect(g);g.connect(AC.destination);o.start();
    if(f2)o.frequency.setValueAtTime(f2,AC.currentTime+d/2);
    g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+d);
    o.stop(AC.currentTime+d+.02);
  }catch(e){}
}
function enterSim(){document.getElementById('splash').classList.add('gone');beep(660,.12,880)}
const T0=Date.now();
function nowT(){const m=12+Math.floor((Date.now()-T0)/15000);return '19:'+String(Math.min(m,59)).padStart(2,'0')}
setInterval(()=>{const t=nowT();['clkC','clkR','clkW'].forEach(i=>{const e=document.getElementById(i);if(e)e.textContent=t})},3000);
const sMsg=()=>beep(620,.07), sSms=()=>beep(880,.14,1174), sCash=()=>{beep(988,.09);setTimeout(()=>beep(1318,.14),90)}, sMoto=()=>beep(180,.18,140);

/* ================= state ================= */
const $=id=>document.getElementById(id);
let costAI=0,costMsg=0,nDet=0,nAI=0,nBlk=0;
let cart=[], phase='order', payMode=null, addrSaved=false, upsellDone=false, ended=false;
let restTimer=null, restTimer2=null, restoAccepted=false, currentResto='Mama Kito';
let autoMode=false;
const WA_UTIL=0.008;let waC=0,waP=0,waW=0;const winOpen={chatR:false,chatW:false};
function waCard(){$('waC').textContent=waC+' msg · GRATUIT';
  $('waP').textContent=waP+' × $0.008 = $'+(waP*WA_UTIL).toFixed(4);
  $('waW').textContent=waW+' msg · GRATUIT';}
const FC_USD=2800;
const MENU=[
  {k:['poulet','mayo'],name:'Poulet mayo + fufu',price:15000,e:'🍗',cat:'Cuisine Locale',g:'linear-gradient(135deg,#7a3410,#e0a144)'},
  {k:['thomson','poisson'],name:'Thomson braisé',price:12000,e:'🐟',cat:'Viande et Poisson',g:'linear-gradient(135deg,#0d3b52,#4fa3c7)'},
  {k:['madesu','haricot'],name:'Madesu + riz',price:8000,e:'🥘',cat:'Cuisine Locale',g:'linear-gradient(135deg,#2c5a2e,#8fbc5a)'},
  {k:['brochette','chevre','chèvre'],name:'Brochettes chèvre',price:6000,e:'🍢',cat:'Viande et Poisson',g:'linear-gradient(135deg,#5c120e,#c74b32)'},
  {k:['taco'],name:'Taco mixte',price:10000,e:'🌮',cat:'Taco',g:'linear-gradient(135deg,#8a6d0b,#f2c94c)'},
  {k:['mikate','beignet'],name:'Mikate (beignets)',price:3000,e:'🍩',cat:'Dessert',g:'linear-gradient(135deg,#7a2242,#e88aa8)'},
  {k:['jus','gingembre','tangawisi'],name:'Jus gingembre',price:2000,e:'🥤',cat:'Boisson',g:'linear-gradient(135deg,#1b4f72,#5dade2)'},
];
/* 17 catégories réelles — export admin cd.tunakula.com (Categories.csv) */
const CATS=[
 {id:158,n:'Menu Enfant',e:'🧸',p:'haut',g:'linear-gradient(135deg,#f2994a,#8a4b0b)'},
 {id:139,n:'Épiceries',e:'🛒',p:'haut',g:'linear-gradient(135deg,#56ab2f,#0b4d1c)'},
 {id:107,n:'Promo',e:'🏷️',p:'haut',g:'linear-gradient(135deg,#E2001B,#7a0010)'},
 {id:5,n:'Restaurant',e:'🍽️',p:'haut',g:'linear-gradient(135deg,#F2820A,#8a4506)'},
 {id:4,n:'Fast Food',e:'🍔',p:'haut',g:'linear-gradient(135deg,#c74b32,#5c120e)'},
 {id:3,n:'Pizzérias',e:'🍕',p:'haut',g:'linear-gradient(135deg,#e0a144,#7a3410)'},
 {id:151,n:'Accompagnements',e:'🍚',p:'moyen',g:'linear-gradient(135deg,#d4b483,#6b5427)'},
 {id:144,n:'Boulangeries',e:'🥖',p:'moyen',g:'linear-gradient(135deg,#e8c07d,#8a5a1e)'},
 {id:110,n:'Dessert',e:'🍰',p:'moyen',g:'linear-gradient(135deg,#e88aa8,#7a2242)'},
 {id:108,n:'Végétarienne',e:'🥗',p:'moyen',g:'linear-gradient(135deg,#8fbc5a,#2c5a2e)'},
 {id:90,n:'Taco',e:'🌮',p:'moyen',g:'linear-gradient(135deg,#f2c94c,#8a6d0b)'},
 {id:7,n:'Cuisine Locale',e:'🍲',p:'moyen',g:'linear-gradient(135deg,#25D366,#075E54)'},
 {id:6,n:'Supermarché',e:'🏪',p:'moyen',g:'linear-gradient(135deg,#4fa3c7,#0d3b52)'},
 {id:138,n:'Essentiel',e:'🧺',p:'normale',g:'linear-gradient(135deg,#b8a9c9,#4a3b5c)'},
 {id:95,n:'Viande et Poisson',e:'🥩',p:'normale',g:'linear-gradient(135deg,#c0392b,#5c120e)'},
 {id:94,n:'Fruits et Légumes',e:'🍌',p:'normale',g:'linear-gradient(135deg,#f5d76e,#3f7a2c)'},
 {id:93,n:'Boisson',e:'🥤',p:'normale',g:'linear-gradient(135deg,#5dade2,#1b4f72)'},
];
const RESTOS=[
  {n:'Mama Kito',q:'Bandal',d:'1,2',e:'🍗',ok:true,r:4.8,t:'15-25 min',g:'linear-gradient(135deg,#e0a144,#7a3410)'},
  {n:'Chez Nono',q:'Bandal',d:'2,8',e:'🐟',ok:true,r:4.6,t:'25-35 min',g:'linear-gradient(135deg,#4fa3c7,#0d3b52)'},
  {n:'La Kinoise',q:'Ngiri-Ngiri',d:'4,6',e:'🥘',ok:true,r:4.5,t:'30-40 min',g:'linear-gradient(135deg,#8fbc5a,#2c5a2e)'},
  {n:'Le Gombe Grill',q:'Gombe',d:'7,9',e:'🔥',ok:false,r:4.7,t:'—',g:'linear-gradient(135deg,#c74b32,#5c120e)'},
];
const cartTotal=()=>cart.reduce((s,c)=>s+c.price*c.q,0);
const fees=()=>{const t=cartTotal();const del=3500;const wewa=Math.round(del*.70);const delCom=del-wewa;const svc=Math.round(t*.10);const proc=Math.round(t*.02);return{svc,proc,del,wewa,delCom,tot:t+svc+proc+del}};
const fmt$=x=>'$'+x.toFixed(4);
const FC=x=>x.toLocaleString('fr-FR')+' FC';

/* ================= meter ================= */
function animNum(el,to,pfx){
  const from=parseFloat(el.dataset.v||0);const t0=performance.now();
  function f(t){const p=Math.min((t-t0)/350,1);const v=from+(to-from)*p;el.textContent=pfx(v);if(p<1)requestAnimationFrame(f);else el.dataset.v=to}
  requestAnimationFrame(f);
}
function refresh(){
  const tot=costAI+costMsg,fe=fees(),rev=(fe.svc+fe.proc+fe.delCom)/FC_USD;
  // Customer side: a StackFood-style receipt only — no internal economics (FR-W4).
  const itemLines=cart.map(c=>`${c.q}× ${c.e} ${c.name} <span class="price">${FC(c.price*c.q)}</span>`).join('<br>');
  const payLabel=payMode==='momo'?'Mobile Money (M-Pesa)':'Cash à la livraison';
  await typing('chatC',900);
  bubble('chatC','in',`<div class="tt">🧾 Reçu — Commande TK-347</div>
    Date: ${nowT()} · <b>Mama Kito — Bandal</b><br>
    Type: Livraison · Statut: <b>Livrée ✅</b><br>
    Paiement: ${payLabel} — <b>payé</b> · Réf: TK-347<br>
    <div style="border-top:1px dashed #c9b98f;margin:6px 0 4px"></div>
    ${itemLines}<br>
    <div style="border-top:1px dashed #c9b98f;margin:4px 0"></div>
    Sous-total: <b>${FC(cartTotal())}</b><br>
    Frais de service (10%): ${FC(fe.svc)}<br>
    Frais de traitement (2%): ${FC(fe.proc)}<br>
    Livraison: ${FC(fe.del)}<br>
    <b>Total payé: ${FC(fe.tot)}</b><br>
    <small>Merci maman 🙏 Ton Adresse Vocale est enregistrée — prochaine commande en 4 clics.</small>`);
  // Ops side: the economic bilan lives in the Registre, not the customer chat.
  ledger('Bilan','TK-347 — coût IA+msg '+fmt$(tot)+' · marge 
// Boot in StackFood-style home mode; chat starts on first entry
let started=false;
document.querySelector('#pc .screen').classList.add('homemode');
function enterChat(openRestos){
  const sc=document.querySelector('#pc .screen');
  if(sc.classList.contains('homemode')){sc.classList.remove('homemode');beep(700,.08,880)}
  if(!started){started=true;start();
    if(openRestos===true)setTimeout(()=>{const b=document.querySelector('#chatC .opt');if(b&&!b.disabled)b.click()},1900);
  }
}
(function(){
  const cw=document.getElementById('hvCats');
  if(cw)CATS.forEach(c=>{
    const d=document.createElement('div');d.className='hv-cat';
    d.innerHTML='<div class="hv-tile" style="background:'+c.g+'">'+c.e+'</div><b>'+c.n+'</b>';
    d.onclick=()=>enterChat();cw.appendChild(d);
  });
  const wrap=document.getElementById('hvRestos');if(!wrap)return;
  RESTOS.filter(r=>r.ok).forEach(r=>{
    const c=document.createElement('div');c.className='hv-rc';
    c.innerHTML='<div class="rcimg" style="background:'+r.g+'">'+r.e+'</div><span class="hv-heart">🤍</span><div class="rcb"><b>'+r.n+'</b><small>'+r.q+' · '+r.d+' km · '+r.t+'</small><div class="rcstar">★ '+r.r+'</div></div>';
    c.querySelector('.hv-heart').onclick=function(e){e.stopPropagation();this.textContent=this.textContent==='🤍'?'🧡':'🤍'};
    c.onclick=()=>enterChat(true);
    wrap.appendChild(c);
  });
})();
guide('Bienvenue sur <b>Tunakula</b> 🍲 — l\'accueil style app. Touche la <b>barre de recherche</b>, une <b>catégorie</b> ou le bouton <b>💬</b> pour basculer dans la conversation WhatsApp — ou ▶ Flux complet en haut.');
// Promo carousel auto-advance
let cix=0;setInterval(()=>{const c=$('caro');if(!c||!c.clientWidth)return;cix=(cix+1)%3;
  c.scrollTo({left:c.clientWidth*cix,behavior:'smooth'});
  document.querySelectorAll('#hvDots i').forEach((d,i)=>d.classList.toggle('on',i===cix));const hc=$('hvCount');if(hc)hc.textContent=(cix+1)+'/3';},3500);
