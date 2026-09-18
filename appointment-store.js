(function () {
  const STORAGE_KEY = 'organzza-appointments-v1';
  const BLOCKING_STATUSES = ['pending', 'scheduled'];
  const isAdmin=location.pathname.endsWith('/admin.html');
  let cached=[],occupied=[];
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');if(Array.isArray(saved))cached=saved.map(normalize);}catch{}
  async function request(url,method='GET',data){
    if(!/^https?:$/.test(location.protocol))throw Error('Abra o site pelo endereço do servidor para registrar a prova.');
    const response=await fetch(url,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,cache:'no-store'});
    const result=await response.json();if(!response.ok){const error=Object.assign(Error(result.error||'Não foi possível consultar os agendamentos.'),{status:response.status});window.dispatchEvent(new CustomEvent('organzza-bookings-error',{detail:error}));throw error;}return result;
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function normalize(item) {
    return {
      id: String(item.id || createId()),
      clientName: String(item.clientName || ''),
      phone: String(item.phone || ''),
      date: String(item.date || ''),
      time: String(item.time || ''),
      attendant: String(item.attendant || 'A definir'),
      occasion: String(item.occasion || ''),
      eventDate: String(item.eventDate || ''),
      notes: String(item.notes || ''),
      dresses: Array.isArray(item.dresses) ? item.dresses : [],
      status: ['pending', 'scheduled', 'completed', 'cancelled', 'rejected'].includes(item.status) ? item.status : 'scheduled',
      source: String(item.source || 'admin'),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt:item.updatedAt||'',requestedDate:item.requestedDate||item.date,requestedTime:item.requestedTime||item.time,refusalReason:String(item.refusalReason||''),history:Array.isArray(item.history)?item.history:[]
    };
  }

  function getAppointments() {
    return clone(cached);
  }

  async function saveAppointments(items) {
    if(!isAdmin)throw Error('Use o formulário para solicitar uma prova.');
    const previous=clone(cached);
    for(const item of items){const old=previous.find(i=>i.id===item.id);if(!old)await request('/api/admin/appointments','POST',item);else{const patch=Object.fromEntries(Object.entries(item).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(old[key])));if(Object.keys(patch).length)await request('/api/admin/appointments/'+encodeURIComponent(item.id),'PATCH',patch);}}
    return refresh();
  }
  async function createAppointment(item){const result=normalize(await request('/api/appointments','POST',item));cached.push(result);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(cached));}catch{}await refresh().catch(()=>{});return result;}
  async function refresh(){
    if(isAdmin){
      if(localStorage.getItem('organzza-bookings-imported-v1')!=='1'){for(const item of cached)await request('/api/admin/appointments','POST',{...item,legacyId:item.id});localStorage.setItem('organzza-bookings-imported-v1','1');}
      cached=(await request('/api/admin/appointments')).map(normalize);occupied=cached.filter(isBlocking);
    }else{occupied=await request('/api/availability');cached=cached.map(item=>{const updated=occupied.find(i=>i.id===item.id);return updated?{...item,status:updated.status}:item;});}
    window.dispatchEvent(new CustomEvent('organzza-appointments-updated'));return getAppointments();
  }

  function createId() {
    return 'visita-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function parseLocalDate(value) {
    const parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], 12);
  }

  function toDateValue(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function today() { return toDateValue(new Date()); }

  function slotsForDate(dateValue) {
    const date = parseLocalDate(dateValue);
    if (!date || date.getDay() === 0) return [];
    const saturday = date.getDay() === 6;
    const hours=OrganzzaBusiness.hours;
    const start = saturday ? hours.saturdayStart : hours.weekdayStart;
    const end = saturday ? hours.saturdayEnd : hours.weekdayEnd;
    const slots = [];
    for (let minutes = start; minutes + hours.slotDuration <= end; minutes += hours.slotDuration) {
      const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
      const mins = String(minutes % 60).padStart(2, '0');
      slots.push(hours + ':' + mins);
    }
    return slots;
  }

  function isBlocking(item) { return BLOCKING_STATUSES.includes(item.status); }
  function overlaps(a,b){const minutes=value=>String(value).split(':').reduce((sum,n,i)=>sum+Number(n)*(i?1:60),0);return Math.abs(minutes(a)-minutes(b))<OrganzzaBusiness.hours.slotDuration;}
  function appointmentsOverlap(a,b){return Math.abs(Date.parse(`${a.date}T${a.time}:00Z`)-Date.parse(`${b.date}T${b.time}:00Z`))<OrganzzaBusiness.hours.slotDuration*60000;}

  function validCustomTime(date,time) {
    const value=parseLocalDate(date);
    return Boolean(value&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&toDateValue(value)===date&&/^([01]\d|2[0-3]):[0-5]\d$/.test(time));
  }

  function isAvailable(date, time, excludeId, allowCustom=false) {
    if (!(allowCustom?validCustomTime(date,time):slotsForDate(date).includes(time))) return false;
    return !occupied.some((item) => item.id !== excludeId && appointmentsOverlap(item,{date,time}) && isBlocking(item));
  }

  function availableSlots(date, excludeId) {
    const items = occupied;
    return slotsForDate(date).filter((time) => !items.some((item) => item.id !== excludeId && appointmentsOverlap(item,{date,time}) && isBlocking(item)));
  }

  function formatDate(dateValue) {
    const date = parseLocalDate(dateValue);
    return date ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(date) : '';
  }

  const ready=refresh().catch(()=>{});
  window.AppointmentStore = { key: STORAGE_KEY, getAppointments, saveAppointments, createAppointment,refresh,ready,createId, parseLocalDate, toDateValue, today, slotsForDate, availableSlots, isAvailable, validCustomTime,isBlocking, overlaps,formatDate, clone };
  setInterval(()=>{if(!document.hidden)refresh().catch(()=>{});},5000);
  window.addEventListener('focus',()=>refresh().catch(()=>{}));
})();
