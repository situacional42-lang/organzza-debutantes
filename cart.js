const CART_KEY='organzza-cart-v1',WHATSAPP='5527999073556';
const cartDialog=document.querySelector('#cart-dialog'),checkoutDialog=document.querySelector('#checkout-dialog'),checkoutForm=document.querySelector('#checkout-form');
function readCart(){try{const s=JSON.parse(localStorage.getItem(CART_KEY)||'[]');return Array.isArray(s)?s.filter(i=>i&&typeof i.id==='string').map(i=>({id:i.id,qty:1,size:String(i.size||'A confirmar')})):[];}catch{return [];}}
let cart=readCart();
function reconcileCart(){const seen=new Set();cart=cart.filter(i=>{const d=dresses.find(d=>d.id===i.id&&d.stock>0);if(!d||seen.has(i.id))return false;seen.add(i.id);if(i.size!=='A confirmar'&&!d.sizes.includes(i.size))i.size='A confirmar';return true;});}
function persistCart(){try{localStorage.setItem(CART_KEY,JSON.stringify(cart));}catch{notify('Sua seleção será mantida apenas nesta sessão.');}renderCart();}
function addToCart(id,size='A confirmar'){
  const d=dresses.find(d=>d.id===id);if(!d||d.stock<=0)return notify('Este vestido está indisponível no momento.');const selected=d.sizes.includes(size)?size:'A confirmar',existing=cart.find(i=>i.id===id);
  if(existing){if(selected!=='A confirmar')existing.size=selected;notify('Este vestido já está na sua sacola.');}else{cart.push({id,qty:1,size:selected});notify(`${d.name} foi adicionado à sacola.`);}persistCart();openCart();
}
function selectionTotal(){let value=0,unknown=0;cart.forEach(i=>{const d=dresses.find(d=>d.id===i.id),p=d&&dressPrice(d);if(p)value+=p;else unknown++;});return unknown?(value?`${money(value)} + ${unknown} sob consulta`:'Sob consulta'):money(value);}
function renderCart(){
  const previous=JSON.stringify(cart);reconcileCart();if(previous!==JSON.stringify(cart)){try{localStorage.setItem(CART_KEY,JSON.stringify(cart));}catch{}}
  const count=cart.length;document.querySelector('#cart-count').textContent=count;document.querySelector('#cart-quantity').textContent=count;document.querySelector('#cart-open').setAttribute('aria-label',`Abrir sacola, ${count} ${count===1?'vestido':'vestidos'}`);
  document.querySelector('#checkout-quantity').textContent=`${count} ${count===1?'vestido selecionado':'vestidos selecionados'}`;document.querySelector('#cart-total').textContent=selectionTotal();document.querySelector('#checkout-total').textContent=selectionTotal();document.querySelector('#checkout-open').disabled=count===0;
  document.querySelector('#cart-items').innerHTML=cart.map(i=>{const d=dresses.find(d=>d.id===i.id);return `<article class="cart-item"><button class="cart-item-photo" data-cart-dress="${escapeHtml(d.id)}" aria-label="Ver vestido ${escapeHtml(d.name)}"><img src="${escapeHtml(d.images[0])}" alt="Vestido ${escapeHtml(d.name)}" width="76" height="103"></button><div><h3>${escapeHtml(d.name)}</h3><small>${escapeHtml(d.colorName)} · ${escapeHtml(d.code)}</small><label>Tamanho<select data-cart-size="${escapeHtml(d.id)}" aria-label="Tamanho do vestido ${escapeHtml(d.name)}">${sizeOptions(d,i.size)}</select></label><span class="cart-item-price">${priceMarkup(d)}</span></div><button class="cart-remove" data-cart-remove="${escapeHtml(d.id)}" aria-label="Remover ${escapeHtml(d.name)} da sacola">×</button></article>`;}).join('')||'<div class="cart-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg><h3>Um sonho à sua espera.</h3><p>Sua sacola está vazia.<br>Adicione os vestidos que gostaria de conhecer.</p></div>';
}
function openCart(){if(dialog.open)dialog.close();renderCart();if(!cartDialog.open)cartDialog.showModal();syncModalLock();}
document.querySelector('#cart-open').addEventListener('click',openCart);document.querySelector('#cart-close').addEventListener('click',()=>cartDialog.close());document.querySelector('#cart-continue').addEventListener('click',()=>cartDialog.close());
cartDialog.addEventListener('close',syncModalLock);checkoutDialog.addEventListener('close',syncModalLock);closeOnBackdrop(cartDialog);closeOnBackdrop(checkoutDialog);
document.querySelector('#cart-items').addEventListener('click',e=>{const r=e.target.closest('[data-cart-remove]');if(r){cart=cart.filter(i=>i.id!==r.dataset.cartRemove);persistCart();notify('Vestido removido da sacola.');}const d=e.target.closest('[data-cart-dress]');if(d){cartDialog.close();openDress(d.dataset.cartDress);}});
document.querySelector('#cart-items').addEventListener('change',e=>{const s=e.target.closest('[data-cart-size]');if(!s)return;const i=cart.find(i=>i.id===s.dataset.cartSize);if(i){i.size=s.value;persistCart();}});
function availableTimes(){
  const date=checkoutForm.elements.visitDate.value,select=checkoutForm.elements.visitTime,helper=document.querySelector('#visit-availability'),previous=select.value;
  if(!date){select.innerHTML='<option value="">Escolha uma data, se desejar</option>';select.required=false;helper.textContent='';return;}
  const slots=AppointmentStore.availableSlots(date);select.innerHTML='<option value="">Selecione um horário</option>'+slots.map(t=>`<option value="${t}">${t}</option>`).join('');select.required=true;if(slots.includes(previous))select.value=previous;
  helper.textContent=slots.length?'A equipe confirmará o horário solicitado.':'Sem horários para esta data. Escolha outra data ou deixe a prova para combinar pelo WhatsApp.';
}
document.querySelector('#checkout-open').addEventListener('click',()=>{renderCart();if(!cart.length)return notify('Adicione um vestido para continuar.');cartDialog.close();const today=AppointmentStore.today();checkoutForm.elements.eventDate.min=today;checkoutForm.elements.visitDate.min=today;availableTimes();checkoutDialog.showModal();syncModalLock();});
document.querySelector('#checkout-close').addEventListener('click',()=>checkoutDialog.close());checkoutForm.elements.visitDate.addEventListener('change',availableTimes);
function formatDate(value){if(!value)return 'A confirmar';const d=AppointmentStore.parseLocalDate(value);return d?d.toLocaleDateString('pt-BR'):value;}
function orderMessage(data){
  const lines=['Olá, Organzza Debutantes! Gostaria de conhecer os vestidos que selecionei no site:',''];cart.forEach(i=>{const d=dresses.find(d=>d.id===i.id);lines.push(`• ${d.name} (${d.code}) — ${d.colorName} — Tamanho: ${i.size} — ${dressPrice(d)?money(dressPrice(d)):'Valor sob consulta'}`);});
  lines.push('',`Estimativa: ${selectionTotal()}`,'',`Nome: ${String(data.get('name')).trim()}`,`Telefone: ${String(data.get('phone')).trim()}`,`Ocasião: ${data.get('occasion')}`,`Data da festa: ${formatDate(data.get('eventDate'))}`);if(data.get('visitDate'))lines.push(`Data solicitada para prova: ${formatDate(data.get('visitDate'))}`,`Horário de preferência: ${data.get('visitTime')}`);if(String(data.get('notes')||'').trim())lines.push(`Observações: ${String(data.get('notes')).trim()}`);lines.push('','Pode confirmar os valores, tamanhos e a disponibilidade para mim?');return lines.join('\n');
}
checkoutForm.addEventListener('submit',async e=>{
  e.preventDefault();dresses=CatalogStore.getProducts().filter(d=>d.active!==false&&d.images.length);renderCart();if(!cart.length){checkoutDialog.close();notify('Os vestidos da seleção não estão mais disponíveis.');return;}
  const data=new FormData(checkoutForm),date=data.get('visitDate'),time=data.get('visitTime');if(date&&(date<AppointmentStore.today()||!AppointmentStore.isAvailable(date,time))){availableTimes();notify('Escolha outro horário para a prova.');return;}
  if(!String(data.get('name')).trim()||!String(data.get('phone')).trim()){notify('Preencha seu nome e telefone.');return;}const message=orderMessage(data);
  const submit=checkoutForm.querySelector('[type="submit"]');if(submit.disabled)return;submit.disabled=true;
  let whatsappWindow;
  if(date){whatsappWindow=window.open('about:blank','_blank');if(whatsappWindow)whatsappWindow.opener=null;try{await AppointmentStore.createAppointment({clientName:data.get('name'),phone:data.get('phone'),date,time,occasion:data.get('occasion'),eventDate:data.get('eventDate'),notes:data.get('notes'),dresses:cart.map(i=>({id:i.id,size:i.size,name:dresses.find(d=>d.id===i.id).name}))});}catch(error){whatsappWindow?.close();await AppointmentStore.refresh().catch(()=>{});availableTimes();submit.disabled=false;notify(error.message||'Não foi possível registrar sua prova. Tente novamente.');return;}}
  const whatsappUrl=`https://api.whatsapp.com/send/?phone=${WHATSAPP}&text=${encodeURIComponent(message)}`;
  if(whatsappWindow)whatsappWindow.location=whatsappUrl;else window.open(whatsappUrl,'_blank','noopener,noreferrer');submit.disabled=false;
  checkoutDialog.close();notify(date?'Pedido de prova registrado. Aguarde a confirmação da loja.':'WhatsApp aberto com sua seleção pronta.');
});
window.addEventListener('storage',e=>{if(e.key===CART_KEY){cart=readCart();renderCart();}if(e.key===AppointmentStore.key&&checkoutDialog.open)availableTimes();});renderCart();if(new URL(location.href).searchParams.get('sacola')==='aberta')openCart();
window.addEventListener('organzza-appointments-updated',()=>{if(checkoutDialog.open)availableTimes();});
