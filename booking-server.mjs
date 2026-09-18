import {randomUUID} from 'node:crypto';
import {createBookingStorage} from './booking-storage.mjs';
import {createAdminAuth} from './admin-auth.mjs';
import './business-info.js';
const blocking=item=>['pending','scheduled'].includes(item.status);
const fail=(status,message)=>Object.assign(new Error(message),{status});
export function validCustomTime(date,time){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return false;
  const [year,month,day]=date.split('-').map(Number),value=new Date(year,month-1,day,12);
  return value.getFullYear()===year&&value.getMonth()===month-1&&value.getDate()===day;
}
export function overlaps(a,b){const minutes=value=>String(value).split(':').reduce((sum,n,i)=>sum+Number(n)*(i?1:60),0);return Math.abs(minutes(a)-minutes(b))<OrganzzaBusiness.hours.slotDuration;}
export function appointmentsOverlap(a,b){return Math.abs(Date.parse(`${a.date}T${a.time}:00Z`)-Date.parse(`${b.date}T${b.time}:00Z`))<OrganzzaBusiness.hours.slotDuration*60000;}
export function slotsForDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return [];
  const [year,month,day]=value.split('-').map(Number),date=new Date(year,month-1,day,12);if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day||date.getDay()===0)return [];
  const hours=OrganzzaBusiness.hours,saturday=date.getDay()===6,start=saturday?hours.saturdayStart:hours.weekdayStart,end=saturday?hours.saturdayEnd:hours.weekdayEnd,result=[];
  for(let m=start;m+hours.slotDuration<=end;m+=hours.slotDuration)result.push(`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`);return result;
}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function normalize(item){
  const text=(key,max=200)=>String(item[key]||'').trim().slice(0,max);
  return {id:text('id'),legacyId:text('legacyId'),clientName:text('clientName',100),phone:text('phone',25),date:text('date',10),time:text('time',5),attendant:text('attendant',100)||'A definir',occasion:text('occasion',100),eventDate:text('eventDate',10),notes:text('notes',1500),dresses:Array.isArray(item.dresses)?item.dresses.slice(0,30).map(d=>({id:String(d.id||'').slice(0,100),name:String(d.name||'Vestido').slice(0,120),size:String(d.size||'A confirmar').slice(0,50)})):[],status:['pending','scheduled','completed','cancelled','rejected'].includes(item.status)?item.status:'pending',source:item.source==='admin'?'admin':'site',createdAt:text('createdAt',40)||new Date().toISOString(),updatedAt:text('updatedAt',40),requestedDate:text('requestedDate',10)||text('date',10),requestedTime:text('requestedTime',5)||text('time',5),refusalReason:text('refusalReason',500),history:Array.isArray(item.history)?item.history.slice(-50):[]};
}
export {normalize as normalizeAppointment};
export function createBookingApi({dataDir,password='',sessionSecret='',firebase={},vercel=false}){
  const storage=createBookingStorage({dataDir,firebase,requireDatabase:vercel});
  const auth=createAdminAuth({password,secret:sessionSecret,required:vercel});
  const load=async()=>(await storage.load()).map(normalize);
  const mutate=fn=>storage.mutate(items=>{for(let i=0;i<items.length;i++)items[i]=normalize(items[i]);return fn(items);});
  async function body(req){const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>150000)throw fail(413,'Solicitação muito grande.');chunks.push(part);}try{const result=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');if(!result||typeof result!=='object'||Array.isArray(result))throw Error();return result;}catch{throw fail(400,'Dados inválidos.');}}
  function json(res,status,value,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value));}
  function validate(item,items,excludeId,{allowPast=false,allowLegacy=false,allowCustom=false}={}){if(!item.clientName)throw fail(400,'Informe o nome da cliente.');if(!allowLegacy&&!(allowCustom?validCustomTime(item.date,item.time):slotsForDate(item.date).includes(item.time)))throw fail(400,'Escolha uma data e um horário válidos.');if(!allowPast&&item.date<today())throw fail(400,'Escolha uma data futura para a prova.');if(blocking(item)&&items.some(i=>i.id!==excludeId&&appointmentsOverlap(i,item)&&blocking(i)))throw fail(409,'Esse horário já foi solicitado. Escolha outro.');}
  return async function bookingApi(req,res,url){
    if(!url.pathname.startsWith('/api/'))return false;
    try{
      if(auth.configurationError)throw fail(503,auth.configurationError);
      if(url.pathname==='/api/health'&&req.method==='GET'){await storage.check();json(res,200,{ok:true});return true;}
      if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)throw fail(403,'Origem não autorizada.');
      if(url.pathname==='/api/admin/login'&&req.method==='POST'){
        const data=await body(req);
        if(!auth.validPassword(data.password))throw fail(401,'Senha incorreta.');
        json(res,200,{ok:true},{'Set-Cookie':auth.cookie(auth.createSession(),vercel||req.headers['x-forwarded-proto']==='https')});return true;
      }
      if(url.pathname.startsWith('/api/admin/')&&!auth.authorized(req))throw fail(401,'Entre no painel para consultar os agendamentos.');
      if(url.pathname==='/api/admin/logout'&&req.method==='POST'){json(res,200,{ok:true},{'Set-Cookie':auth.cookie('',vercel||req.headers['x-forwarded-proto']==='https')});return true;}
      if(url.pathname==='/api/availability'&&req.method==='GET'){const items=await load();json(res,200,items.filter(blocking).map(({id,date,time,status})=>({id,date,time,status})));return true;}
      if(url.pathname==='/api/admin/appointments'&&req.method==='GET'){json(res,200,await load());return true;}
      if(['/api/appointments','/api/admin/appointments'].includes(url.pathname)&&req.method==='POST'){
        const data=await body(req),isAdmin=url.pathname.includes('/admin/'),item=normalize({...data,id:randomUUID(),status:isAdmin?data.status:'pending',source:isAdmin?'admin':'site',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),history:[],refusalReason:''});
        if(!isAdmin&&!/^\d{10,15}$/.test(item.phone.replace(/\D/g,'')))throw fail(400,'Informe um telefone válido para contato.');
        if(!isAdmin)item.legacyId='';
        if(!isAdmin){item.requestedDate=item.date;item.requestedTime=item.time;}
        const result=await mutate(items=>{if(isAdmin&&data.legacyId){const existing=items.find(i=>i.id===data.legacyId||i.legacyId===data.legacyId);if(existing)return existing;}validate(item,items,undefined,{allowCustom:isAdmin,allowPast:isAdmin&&Boolean(data.legacyId),allowLegacy:isAdmin&&Boolean(data.legacyId)});items.push(item);return item;});json(res,201,result);return true;
      }
      const match=url.pathname.match(/^\/api\/admin\/appointments\/([^/]+)$/);
      if(match&&req.method==='PATCH'){
        const patch=await body(req);const result=await mutate(items=>{const index=items.findIndex(i=>i.id===decodeURIComponent(match[1]));if(index<0)throw fail(404,'Agendamento não encontrado.');const old=items[index],next=normalize({...old,...patch,id:old.id,source:old.source,createdAt:old.createdAt,requestedDate:old.requestedDate,requestedTime:old.requestedTime,history:old.history,updatedAt:new Date().toISOString()});validate(next,items,old.id,{allowCustom:true,allowPast:!blocking(next)||(old.date===next.date&&old.time===next.time&&old.status===next.status),allowLegacy:!blocking(next)&&old.date===next.date&&old.time===next.time});if(old.status!==next.status||old.date!==next.date||old.time!==next.time)next.history=[...old.history,{at:next.updatedAt,fromStatus:old.status,toStatus:next.status,fromDate:old.date,fromTime:old.time,date:next.date,time:next.time}];items[index]=next;return next;});json(res,200,result);return true;
      }
      json(res,404,{error:'Recurso não encontrado.'});
    }catch(error){const publicUnavailable=error.status===503&&!url.pathname.startsWith('/api/admin/')&&url.pathname!=='/api/health';json(res,error.status||500,{error:publicUnavailable?'O agendamento está temporariamente indisponível. Entre em contato com a loja pelo WhatsApp.':error.status?error.message:'Não foi possível salvar o agendamento. Tente novamente.'});}
    return true;
  };
}
