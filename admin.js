(function () {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const slugify = (value) => String(value || 'vestido').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  let products = CatalogStore.getProducts();
  let appointments = AppointmentStore.getAppointments();
  let currentFilter = 'all';
  let draftImages = [];
  let toastTimer;

  const list = $('#productList');
  const empty = $('#emptyState');
  const dialog = $('#productDialog');
  const form = $('#productForm');
  const appointmentDialog = $('#appointmentDialog');
  const appointmentForm = $('#appointmentForm');

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function save(message) {
    try { CatalogStore.saveProducts(products); } catch { showToast('Não foi possível salvar. Reduza o tamanho das imagens.'); return; }
    render();
    if (message) showToast(message);
  }

  function renderStats() {
    $('#statTotal').textContent = products.length;
    $('#statActive').textContent = products.filter((product) => product.active).length;
    $('#statPromo').textContent = products.filter((product) => product.promoPrice && product.promoPrice < product.price).length;
    $('#statStock').textContent = products.reduce((total, product) => total + Number(product.stock || 0), 0);
    $('#statAppointments').textContent = appointments.filter((item) => item.date >= AppointmentStore.today() && AppointmentStore.isBlocking(item)).length;
  }

  function filteredProducts() {
    const query = $('#productSearch').value.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = [product.name, product.cat, product.color].join(' ').toLowerCase().includes(query);
      const matchesFilter = currentFilter === 'all' ||
        (currentFilter === 'active' && product.active) ||
        (currentFilter === 'inactive' && !product.active) ||
        (currentFilter === 'promo' && product.promoPrice && product.promoPrice < product.price);
      return matchesSearch && matchesFilter;
    });
  }

  function rowTemplate(product) {
    const promo = product.promoPrice && product.promoPrice < product.price;
    const image = product.images[0] || '';
    return `<article class="product-row" data-id="${escapeHtml(product.id)}">
      <div class="product-main"><img src="${escapeHtml(image)}" alt=""><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.color || 'Cor não informada')} · ${escapeHtml((product.sizes || []).join(', ') || 'Sem tamanhos')}</small></div></div>
      <div class="category">${escapeHtml(product.cat)}</div>
      <div class="price">${promo ? `<del>${product.price ? money(product.price) : 'Sob consulta'}</del><strong>${money(product.promoPrice)}</strong>` : `<strong>${product.price ? money(product.price) : 'Sob consulta'}</strong><small>por locação</small>`}</div>
      <div class="stock"><button data-action="decrease" title="Diminuir disponibilidade" aria-label="Diminuir disponibilidade">−</button><b>${Number(product.stock || 0)}</b><button data-action="increase" title="Aumentar disponibilidade" aria-label="Aumentar disponibilidade">+</button></div>
      <div class="status ${product.active ? '' : 'inactive'}">${product.active ? 'Ativo' : 'Inativo'}</div>
      <div class="actions"><button data-action="edit" title="Editar vestido" aria-label="Editar vestido">✎</button><button data-action="toggle" title="${product.active ? 'Desativar' : 'Ativar'} vestido" aria-label="${product.active ? 'Desativar' : 'Ativar'} vestido">${product.active ? '○' : '●'}</button><button data-action="delete" title="Excluir vestido" aria-label="Excluir vestido">×</button></div>
    </article>`;
  }

  function render() {
    renderStats();
    const visible = filteredProducts();
    list.innerHTML = visible.map(rowTemplate).join('');
    empty.hidden = visible.length > 0;
    renderAgenda();
  }

  function renderImages() {
    $('#imagePreview').innerHTML = draftImages.map((src, index) => `<div class="preview"><img src="${escapeHtml(src)}" alt="Foto ${index + 1}"><button type="button" data-remove-image="${index}" aria-label="Remover foto">×</button></div>`).join('');
    $('#imageHelp').textContent = draftImages.length ? `${draftImages.length} de 6 fotos. A primeira será usada como capa.` : 'Adicione ao menos uma foto do vestido.';
  }

  function setValue(id, value) { $(id).value = value == null ? '' : value; }

  function openDialog(product) {
    form.reset();
    const editing = Boolean(product);
    $('#dialogTitle').textContent = editing ? 'Editar vestido' : 'Novo vestido';
    setValue('#productId', product?.id || '');
    setValue('#productName', product?.name || '');
    setValue('#productCategory', product?.cat || 'Debutantes');
    setValue('#productBadge', product?.badge || '');
    setValue('#productMaterial', product?.material || '');
    setValue('#productColor', product?.color || '');
    setValue('#productOccasion', product?.occasion || '');
    setValue('#productDescription', product?.description || '');
    setValue('#productCare', product?.care || '');
    setValue('#productPrice', product?.price || '');
    setValue('#productPromo', product?.promoPrice || '');
    setValue('#productStock', product?.stock ?? 1);
    setValue('#productSizes', (product?.sizes || []).join(', '));
    $('#productActive').checked = product?.active !== false;
    $('#productImages').value = '';
    draftImages = [...(product?.images || [])];
    renderImages();
    dialog.showModal();
  }

  function closeDialog() {
    dialog.close();
    draftImages = [];
  }

  function appointmentStatus(status) {
    return { pending: 'Pendente', scheduled: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado', rejected:'Recusado' }[status] || 'Pendente';
  }

  function dressSummary(item) {
    if (!item.dresses?.length) return 'Vestidos a definir';
    return item.dresses.map((dress) => {
      if (typeof dress === 'string') return dress;
      return (dress.name || dress.id || 'Vestido') + (dress.size ? ' · tam. ' + dress.size : '');
    }).join(', ');
  }

  async function persistAppointments(message) {
    try{await AppointmentStore.saveAppointments(appointments);appointments=AppointmentStore.getAppointments();renderStats();renderAgenda();if(message)showToast(message);return true;}
    catch(error){appointments=AppointmentStore.getAppointments();renderStats();renderAgenda();showToast(error.message);return false;}
  }

  function bookedSlotTemplate(item) {
    const primaryAction = item.status === 'pending'
      ? '<button data-appointment-action="confirm">Confirmar</button>'
      : '<button data-appointment-action="complete">Concluir</button>';
    return `<article class="agenda-slot booked ${escapeHtml(item.status)}" data-appointment-id="${escapeHtml(item.id)}">
      <time>${escapeHtml(item.time)}</time><span class="slot-status">${appointmentStatus(item.status)}</span>
      <h3>${escapeHtml(item.clientName || 'Cliente sem nome')}</h3>
      <p>${escapeHtml(item.attendant || 'A definir')} · ${escapeHtml(item.phone || 'Sem telefone')}</p>
      <div class="slot-actions"><button data-appointment-action="edit">Editar</button>${primaryAction}<button data-appointment-action="cancel">Cancelar</button></div>
    </article>`;
  }

  function renderAgenda() {
    const dateInput = $('#agendaDate');
    if (!dateInput.value) dateInput.value = AppointmentStore.today();
    const date = dateInput.value;
    const slots = AppointmentStore.slotsForDate(date);
    const dayItems = appointments.filter((item) => item.date === date);
    const blocking = dayItems.filter(AppointmentStore.isBlocking);
    $('#agendaDateLabel').textContent = AppointmentStore.formatDate(date) || 'Selecione uma data';
    $('#agendaBookedCount').textContent = blocking.length;
    if (!slots.length) {
      $('#agendaSlots').innerHTML = '<div class="agenda-closed">A loja não possui horários de atendimento neste dia.</div>';
    } else {
      $('#agendaSlots').innerHTML = slots.map((time) => {
        const booked = blocking.find((item) => item.time === time);
        if(!booked&&!AppointmentStore.isAvailable(date,time))return `<div class="agenda-slot"><strong>${time}</strong><p>Este horário coincide com uma prova já marcada.</p></div>`;
        return booked ? bookedSlotTemplate(booked) : `<button class="agenda-slot free" type="button" data-slot-time="${time}"><strong>${time}</strong><span>＋ Marcar</span></button>`;
      }).join('');
    }
    const outside=blocking.filter(item=>!slots.includes(item.time)).sort((a,b)=>a.time.localeCompare(b.time));if(outside.length)$('#agendaSlots').innerHTML+='<div class="agenda-closed">Visitas com horário personalizado</div>'+outside.map(bookedSlotTemplate).join('');
    const history = dayItems.filter((item) => !AppointmentStore.isBlocking(item));
    $('#agendaHistory').innerHTML = history.length ? `<details><summary>Histórico do dia (${history.length})</summary><div class="history-list">${history.map((item) => `<span><b>${escapeHtml(item.time)}</b> · ${escapeHtml(item.clientName)} · ${appointmentStatus(item.status)}</span>`).join('')}</div></details>` : '';
  }

  function renderAppointmentTimes(preferred) {
    const date = $('#appointmentDate').value;
    const id = $('#appointmentId').value;
    const status = $('#appointmentStatus').value;
    const allSlots = AppointmentStore.slotsForDate(date);
    const times = AppointmentStore.isBlocking({ status }) ? AppointmentStore.availableSlots(date, id) : allSlots;
    const selected = preferred || ($('#appointmentTime').value==='custom'?$('#appointmentCustomTime').value:$('#appointmentTime').value);
    const custom = $('#appointmentTime').value==='custom'||Boolean(selected&&!allSlots.includes(selected));
    const help = $('#appointmentTimeHelp');
    if (!allSlots.length) {
      help.textContent = 'Loja fechada neste dia. Você pode combinar um horário personalizado com a cliente.';
    } else {
      help.textContent = times.length ? times.length + (times.length === 1 ? ' horário disponível.' : ' horários disponíveis.') : 'Sem horários livres na grade. Confira um horário personalizado.';
    }
    $('#appointmentTime').innerHTML = '<option value="">Selecione</option>' + times.map((time) => `<option value="${time}">${time}</option>`).join('')+'<option value="custom">Horário personalizado…</option>';
    if(custom){$('#appointmentTime').value='custom';$('#appointmentCustomTime').value=selected;}
    else if (times.includes(selected)) $('#appointmentTime').value = selected;
    toggleCustomTime();
  }

  function toggleCustomTime() {
    const custom=$('#appointmentTime').value==='custom';
    $('#appointmentCustomTime').hidden=!custom;
    $('#appointmentCustomTime').disabled=!custom;
    $('#appointmentCustomTime').required=custom;
    if(custom)$('#appointmentTimeHelp').textContent='Informe o horário combinado com a cliente. A visita ocupa uma hora e não pode coincidir com outra prova.';
  }

  function openAppointmentDialog(item, defaults = {}) {
    appointmentForm.reset();
    const editing = Boolean(item);
    $('#appointmentDialogTitle').textContent = editing ? 'Editar visita' : 'Marcar visita';
    setValue('#appointmentId', item?.id || '');
    setValue('#appointmentName', item?.clientName || '');
    setValue('#appointmentPhone', item?.phone || '');
    setValue('#appointmentOccasion', item?.occasion || '');
    setValue('#appointmentEventDate', item?.eventDate || '');
    setValue('#appointmentDresses', item ? dressSummary(item) : '');
    setValue('#appointmentDate', item?.date || defaults.date || $('#agendaDate').value || AppointmentStore.today());
    setValue('#appointmentAttendant', item?.attendant === 'A definir' ? '' : item?.attendant || '');
    setValue('#appointmentStatus', item?.status || 'scheduled');
    setValue('#appointmentNotes', item?.notes || '');
    renderAppointmentTimes(item?.time || defaults.time || '');
    if(defaults.custom){$('#appointmentTime').value='custom';toggleCustomTime();}
    appointmentDialog.showModal();
  }

  function closeAppointmentDialog() { appointmentDialog.close(); }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const maxWidth = 800;
          const maxHeight = 1200;
          const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', .76));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  $('#newProduct').addEventListener('click', () => openDialog());
  $$('[data-close]').forEach((button) => button.addEventListener('click', closeDialog));
  dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(); });

  $('#productImages').addEventListener('change', async (event) => {
    const available = 6 - draftImages.length;
    const files = Array.from(event.target.files).filter((file) => file.type.startsWith('image/')).slice(0, available);
    if (!files.length) return;
    $('#imageHelp').textContent = 'Preparando imagens…';
    try {
      const processed = await Promise.all(files.map(compressImage));
      draftImages.push(...processed);
      renderImages();
    } catch (_) {
      showToast('Não foi possível processar uma das imagens.');
    }
    event.target.value = '';
  });

  $('#imagePreview').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-image]');
    if (!button) return;
    draftImages.splice(Number(button.dataset.removeImage), 1);
    renderImages();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('#productName').value.trim();
    const price = Number($('#productPrice').value) || null;
    const promoValue = Number($('#productPromo').value);
    const promoPrice = promoValue > 0 ? promoValue : null;
    if (!draftImages.length) return showToast('Adicione pelo menos uma foto.');
    if (promoPrice && (!price || promoPrice >= price)) return showToast('A promoção precisa ser menor que o valor normal.');
    const oldId = $('#productId').value;
    const existing = products.find((product) => product.id === oldId);
    let id = oldId || `${slugify(name)}-${Date.now().toString().slice(-5)}`;
    const updated = {
      ...(existing || {}), id, name,
      cat: $('#productCategory').value,
      badge: $('#productBadge').value.trim(),
      material: $('#productMaterial').value.trim(),
      color: $('#productColor').value.trim(),
      occasion: $('#productOccasion').value.trim(),
      description: $('#productDescription').value.trim(),
      care: $('#productCare').value.trim(),
      price, promoPrice,
      stock: Math.max(0, Number($('#productStock').value) || 0),
      sizes: $('#productSizes').value.split(',').map((size) => size.trim()).filter(Boolean),
      images: draftImages,
      active: $('#productActive').checked
    };
    if (existing) products = products.map((product) => product.id === oldId ? updated : product);
    else products.unshift(updated);
    try {
      CatalogStore.saveProducts(products);
    } catch (_) {
      return showToast('As imagens ficaram grandes demais. Tente usar menos fotos.');
    }
    closeDialog();
    render();
    showToast(existing ? 'Vestido atualizado.' : 'Vestido adicionado ao acervo.');
  });

  list.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    const row = event.target.closest('[data-id]');
    if (!actionButton || !row) return;
    const index = products.findIndex((product) => product.id === row.dataset.id);
    if (index < 0) return;
    const action = actionButton.dataset.action;
    if (action === 'increase') { products[index].stock += 1; save('Disponibilidade atualizada.'); }
    if (action === 'decrease') { products[index].stock = Math.max(0, products[index].stock - 1); save('Disponibilidade atualizada.'); }
    if (action === 'toggle') { products[index].active = !products[index].active; save(products[index].active ? 'Vestido ativado.' : 'Vestido desativado.'); }
    if (action === 'edit') openDialog(products[index]);
    if (action === 'delete' && confirm(`Excluir “${products[index].name}” do acervo?`)) { products.splice(index, 1); save('Vestido excluído.'); }
  });

  $('#productSearch').addEventListener('input', render);
  $$('.filters [data-filter]').forEach((button) => button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    $$('.filters [data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    render();
  }));

  $('#resetCatalog').addEventListener('click', () => {
    if (!confirm('Restaurar o acervo inicial? As alterações locais serão substituídas.')) return;
    products = CatalogStore.resetDefaults();
    render();
    showToast('Acervo inicial restaurado.');
  });

  function shiftAgendaDate(days) {
    const current = AppointmentStore.parseLocalDate($('#agendaDate').value) || new Date();
    current.setDate(current.getDate() + days);
    $('#agendaDate').value = AppointmentStore.toDateValue(current);
    renderAgenda();
  }

  $('#agendaDate').value = AppointmentStore.today();
  $('#agendaDate').addEventListener('change', renderAgenda);
  $('#agendaPrev').addEventListener('click', () => shiftAgendaDate(-1));
  $('#agendaNext').addEventListener('click', () => shiftAgendaDate(1));
  $('#newAppointment').addEventListener('click', () => openAppointmentDialog());
  $('#customAppointment').addEventListener('click', () => openAppointmentDialog(null,{custom:true}));
  $('#appointmentTime').addEventListener('change', () => {if($('#appointmentTime').value==='custom'){toggleCustomTime();$('#appointmentCustomTime').focus();}else renderAppointmentTimes();});
  $$('[data-appointment-close]').forEach((button) => button.addEventListener('click', closeAppointmentDialog));
  appointmentDialog.addEventListener('click', (event) => { if (event.target === appointmentDialog) closeAppointmentDialog(); });
  $('#appointmentDate').addEventListener('change', () => renderAppointmentTimes());
  $('#appointmentStatus').addEventListener('change', () => renderAppointmentTimes());

  $('#agendaSlots').addEventListener('click', (event) => {
    const freeSlot = event.target.closest('[data-slot-time]');
    if (freeSlot) return openAppointmentDialog(null, { date: $('#agendaDate').value, time: freeSlot.dataset.slotTime });
    const actionButton = event.target.closest('[data-appointment-action]');
    const card = event.target.closest('[data-appointment-id]');
    if (!actionButton || !card) return;
    const index = appointments.findIndex((item) => item.id === card.dataset.appointmentId);
    if (index < 0) return;
    const action = actionButton.dataset.appointmentAction;
    if (action === 'edit') return openAppointmentDialog(appointments[index]);
    if (action === 'confirm') {
      appointments[index].status = 'scheduled';
      return persistAppointments('Visita confirmada.');
    }
    if (action === 'complete') {
      appointments[index].status = 'completed';
      return persistAppointments('Atendimento concluído e horário liberado.');
    }
    if (action === 'cancel' && confirm('Cancelar esta visita e liberar o horário?')) {
      appointments[index].status = 'cancelled';
      persistAppointments('Visita cancelada e horário liberado.');
    }
  });

  appointmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const oldId = $('#appointmentId').value;
    const existing = appointments.find((item) => item.id === oldId);
    const status = $('#appointmentStatus').value;
    const date = $('#appointmentDate').value;
    const custom = $('#appointmentTime').value==='custom';
    const time = custom?$('#appointmentCustomTime').value:$('#appointmentTime').value;
    if (!time) return showToast('Selecione um horário disponível.');
    if(!AppointmentStore.validCustomTime(date,time))return showToast('Informe uma data e um horário válidos.');
    if (AppointmentStore.isBlocking({ status }) && !AppointmentStore.isAvailable(date, time, oldId, custom)) {
      renderAppointmentTimes();
      return showToast('Este horário já está ocupado. Escolha outro.');
    }
    const dressText = $('#appointmentDresses').value.trim();
    const updated = {
      ...(existing || {}),
      id: oldId || AppointmentStore.createId(),
      clientName: $('#appointmentName').value.trim(),
      phone: $('#appointmentPhone').value.trim(),
      occasion: $('#appointmentOccasion').value.trim(),
      eventDate: $('#appointmentEventDate').value,
      date,
      time,
      attendant: $('#appointmentAttendant').value.trim() || 'A definir',
      status,
      refusalReason:status==='scheduled'?'':existing?.refusalReason||'',
      notes: $('#appointmentNotes').value.trim(),
      dresses: existing&&dressText===dressSummary(existing)?existing.dresses:(dressText ? [{ name: dressText, size: '' }] : []),
      source: existing?.source || 'admin',
      createdAt: existing?.createdAt || new Date().toISOString()
    };
    if (existing) appointments = appointments.map((item) => item.id === oldId ? updated : item);
    else appointments.push(updated);
    const submit=appointmentForm.querySelector('[type="submit"]');submit.disabled=true;
    const saved=await persistAppointments(existing?'Visita atualizada.':'Visita adicionada à agenda.');submit.disabled=false;if(!saved)return;
    $('#agendaDate').value = date;
    closeAppointmentDialog();
    renderStats();
    renderAgenda();
    showToast(existing ? 'Visita atualizada.' : 'Visita adicionada à agenda.');
  });

  $('#menuButton').addEventListener('click', () => { $('.sidebar').classList.add('open'); $('#sideOverlay').classList.add('show'); });
  $('#sideOverlay').addEventListener('click', () => { $('.sidebar').classList.remove('open'); $('#sideOverlay').classList.remove('show'); });
  window.addEventListener('storage', (event) => {
    if (event.key !== AppointmentStore.key) return;
    appointments = AppointmentStore.getAppointments();
    renderStats();
    renderAgenda();
  });
  window.AdminAppointments={open:openAppointmentDialog};
  window.addEventListener('organzza-appointments-updated',()=>{appointments=AppointmentStore.getAppointments();renderStats();renderAgenda();});
  AppointmentStore.ready.then(()=>{appointments=AppointmentStore.getAppointments();renderStats();renderAgenda();});
  $$('.sidebar nav a').forEach(link=>link.addEventListener('click',()=>{$$('.sidebar nav a').forEach(a=>a.classList.toggle('active',a===link));$('.sidebar').classList.remove('open');$('#sideOverlay').classList.remove('show');}));
  render();
})();
