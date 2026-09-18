let dresses=CatalogStore.getProducts().filter(d=>d.active!==false&&d.images.length);
const grid=document.querySelector('#product-grid'),dialog=document.querySelector('#product-dialog');
const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const escapeHtml=(value='')=>String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dressPrice=d=>d.promoPrice>0&&d.price>0&&d.promoPrice<d.price?d.promoPrice:d.price;
const isPromotion=d=>Boolean(d.price>0&&d.promoPrice>0&&d.promoPrice<d.price);
function priceMarkup(d){return dressPrice(d)?`${isPromotion(d)?`<del>${money(d.price)}</del>`:''}<strong>${money(dressPrice(d))}</strong>`:'Valor sob consulta';}
let favorites=new Set();
try{const saved=JSON.parse(localStorage.getItem('organzza-favorites')||'[]');if(Array.isArray(saved))favorites=new Set(saved.filter(id=>dresses.some(d=>d.id===id)));}catch{}
let currentColor='all',onlyFavorites=false,activeDress=null,photoIndex=0,toastTimer,lastFocused;
function syncModalLock(){document.body.classList.toggle('modal-open',Boolean(document.querySelector('dialog[open]')));}
function notify(message){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3000);}
function render(){
  const visible=dresses.filter(d=>(currentColor==='all'||d.filterKey===currentColor)&&(!onlyFavorites||favorites.has(d.id)));
  grid.innerHTML=visible.map(d=>{const id=escapeHtml(d.id),name=escapeHtml(d.name),color=escapeHtml(d.colorName),price=dressPrice(d);return `<article class="product-card"><div class="product-photo"><button class="open-product" data-dress="${id}" aria-label="Ver fotos do vestido ${name}"><img src="${escapeHtml(d.images[0])}" alt="Vestido ${name}, ${color}" loading="lazy" width="1080" height="1350"><span class="photo-overlay">Conheça o vestido <span>↗</span></span></button><button class="favorite ${favorites.has(d.id)?'is-saved':''}" data-favorite="${id}" aria-label="${favorites.has(d.id)?'Remover':'Adicionar'} ${name} ${favorites.has(d.id)?'dos':'aos'} favoritos" aria-pressed="${favorites.has(d.id)}">${heart}</button>${isPromotion(d)?'<span class="product-promo">Em promoção</span>':''}${d.id==='aqua'?'<span class="model-note">Longo & curto</span>':''}</div><div class="product-info"><div><button data-dress="${id}" class="product-name">${name}</button><span class="product-color"><i style="--swatch:${d.swatch}"></i>${color}</span></div><p>${escapeHtml(d.subtitle)}</p>${price?`<span class="product-price">${priceMarkup(d)}</span>`:''}<button class="product-link" data-dress="${id}">Ver detalhes <span>↗</span></button><button class="product-add" data-add="${id}" ${d.stock<=0?'disabled':''}>${d.stock<=0?'Indisponível no momento':'Adicionar à sacola'} <span>+</span></button></div></article>`;}).join('')||'<div class="empty-state"><span>♡</span><h3>Ainda não encontrou seu favorito?</h3><p>Toque no coração de um vestido para salvá-lo aqui.</p><button class="button button-dark" id="reset-filters">Ver todos os vestidos ↗</button></div>';
  document.querySelector('#results-count').textContent=`${visible.length} ${visible.length===1?'modelo':'modelos'}`;
  document.querySelector('#favorites-filter').textContent=`♡ Favoritos${favorites.size?` (${favorites.size})`:''}`;
  document.querySelectorAll('[data-color]').forEach(b=>{const a=b.dataset.color===currentColor;b.classList.toggle('active',a);b.setAttribute('aria-pressed',a);});
  const f=document.querySelector('#favorites-filter');f.classList.toggle('active',onlyFavorites);f.setAttribute('aria-pressed',onlyFavorites);
}
function toggleFavorite(id){const saved=favorites.has(id);saved?favorites.delete(id):favorites.add(id);try{localStorage.setItem('organzza-favorites',JSON.stringify([...favorites]));}catch{}render();updateDialogFavorite();notify(saved?'Vestido removido dos favoritos.':'Vestido salvo nos favoritos.');}
function updateDialogFavorite(){if(!activeDress)return;const b=document.querySelector('#dialog-favorite'),s=favorites.has(activeDress.id);b.textContent=s?'♥ Salvo nos favoritos':'♡ Salvar nos favoritos';b.setAttribute('aria-pressed',s);}
function updatePhoto(){
  if(!activeDress)return;const src=activeDress.images[photoIndex],label=activeDress.photoLabels[src]||`Foto ${photoIndex+1}`;
  const image=document.querySelector('#gallery-image');image.src=src;image.alt=`Vestido ${activeDress.name}, ${activeDress.colorName} — ${label}`;
  document.querySelector('#gallery-caption').textContent=`${label} · ${photoIndex+1}/${activeDress.images.length}`;
  dialog.querySelectorAll('.gallery-arrow').forEach(b=>b.hidden=activeDress.images.length===1);
  document.querySelector('#thumbnails').innerHTML=activeDress.images.map((f,i)=>{const l=activeDress.photoLabels[f]||`Foto ${i+1}`;return `<button data-photo="${i}" class="${photoIndex===i?'selected':''}" aria-label="Ver ${escapeHtml(l.toLowerCase())}" aria-pressed="${photoIndex===i}"><img src="${escapeHtml(f)}" alt="" width="60" height="75"><span>${escapeHtml(l)}</span></button>`;}).join('');
}
function sizeOptions(d,selected='A confirmar'){return ['A confirmar',...d.sizes.filter(s=>s!=='A confirmar')].map(s=>`<option value="${escapeHtml(s)}" ${s===selected?'selected':''}>${s==='A confirmar'?'A confirmar com a loja':escapeHtml(s)}</option>`).join('');}
function openDress(id,changeUrl=true){
  activeDress=dresses.find(d=>d.id===id);if(!activeDress)return;photoIndex=0;lastFocused=document.activeElement;
  document.querySelector('#dialog-title').textContent=activeDress.name;document.querySelector('#dress-code').textContent=activeDress.code;
  document.querySelector('#dialog-color').innerHTML=`<i style="--swatch:${activeDress.swatch}"></i>${escapeHtml(activeDress.colorName)}`;
  document.querySelector('#dialog-description').textContent=activeDress.description;document.querySelector('#dress-price').innerHTML=priceMarkup(activeDress);document.querySelector('#dress-size').innerHTML=sizeOptions(activeDress);
  const add=document.querySelector('#dress-add');add.disabled=activeDress.stock<=0;add.innerHTML=activeDress.stock<=0?'Indisponível no momento':'Adicionar à sacola <span>+</span>';
  const message=`Olá! Vi o vestido ${activeDress.name} (${activeDress.code}), na cor ${activeDress.colorName.toLowerCase()}, no catálogo da Organzza Debutantes. Gostaria de saber sobre valores, tamanhos e disponibilidade para os meus 15 anos.`;
  document.querySelector('#dress-contact').href=`https://api.whatsapp.com/send/?phone=5527999073556&text=${encodeURIComponent(message)}`;
  updatePhoto();updateDialogFavorite();if(!dialog.open)dialog.showModal();syncModalLock();if(changeUrl){const u=new URL(location.href);u.searchParams.set('vestido',id);history.replaceState(null,'',u);}
}
grid.addEventListener('click',e=>{const f=e.target.closest('[data-favorite]');if(f){toggleFavorite(f.dataset.favorite);return;}const a=e.target.closest('[data-add]');if(a){addToCart(a.dataset.add);return;}const p=e.target.closest('[data-dress]');if(p)openDress(p.dataset.dress);if(e.target.closest('#reset-filters')){currentColor='all';onlyFavorites=false;render();}});
document.querySelectorAll('[data-color]').forEach(b=>b.addEventListener('click',()=>{currentColor=b.dataset.color;render();}));document.querySelector('#favorites-filter').addEventListener('click',()=>{onlyFavorites=!onlyFavorites;render();});
dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
function closeOnBackdrop(modal){modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});}
closeOnBackdrop(dialog);dialog.addEventListener('close',()=>{syncModalLock();const u=new URL(location.href);u.searchParams.delete('vestido');history.replaceState(null,'',u);if(!document.querySelector('dialog[open]'))lastFocused?.focus();});
function movePhoto(direction){if(!activeDress)return;photoIndex=(photoIndex+direction+activeDress.images.length)%activeDress.images.length;updatePhoto();}
dialog.querySelector('.prev').addEventListener('click',()=>movePhoto(-1));dialog.querySelector('.next').addEventListener('click',()=>movePhoto(1));document.querySelector('#thumbnails').addEventListener('click',e=>{const b=e.target.closest('[data-photo]');if(b){photoIndex=Number(b.dataset.photo);updatePhoto();}});
document.addEventListener('keydown',e=>{if(!dialog.open)return;if(e.key==='ArrowRight'){e.preventDefault();movePhoto(1);}if(e.key==='ArrowLeft'){e.preventDefault();movePhoto(-1);}});
document.querySelector('#dress-add').addEventListener('click',()=>{if(activeDress)addToCart(activeDress.id,document.querySelector('#dress-size').value);});document.querySelector('#dialog-favorite').addEventListener('click',()=>{if(activeDress)toggleFavorite(activeDress.id);});
document.querySelector('#share-dress').addEventListener('click',async()=>{const u=new URL(location.href);u.searchParams.set('vestido',activeDress.id);try{await navigator.clipboard.writeText(u.href);notify('Link do vestido copiado!');}catch{notify('Copie o link do vestido na barra de endereço.');}});
function refreshCatalog(){dresses=CatalogStore.getProducts().filter(d=>d.active!==false&&d.images.length);render();renderCart();if(activeDress&&dialog.open){const d=dresses.find(d=>d.id===activeDress.id);if(d)openDress(d.id,false);else dialog.close();}}
window.addEventListener('storage',e=>{if(e.key===CatalogStore.key)refreshCatalog();if(e.key==='organzza-favorites'){try{const s=JSON.parse(e.newValue||'[]');favorites=new Set(Array.isArray(s)?s:[]);}catch{favorites=new Set();}render();updateDialogFavorite();}});window.addEventListener('organzza-catalog-changed',refreshCatalog);
document.querySelector('#year').textContent=new Date().getFullYear();render();const requested=new URL(location.href).searchParams.get('vestido');if(requested)openDress(requested,false);
