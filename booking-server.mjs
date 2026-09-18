import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
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
export function createBookingApi({dataDir,password=''}){
  const file=path.join(dataDir,'appointments.json'),sessions=new Map();let queue=Promise.resolve();
  async function load(){try{const saved=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(saved))throw Error('Invalid appointments file');return saved.map(normalize);}catch(error){if(error.code==='ENOENT')return [];throw error;}}
  async function save(items){await mkdir(dataDir,{recursive:true});const temp=file+'.tmp';await writeFile(temp,JSON.stringify(items,null,2),'utf8');await rename(temp,file);}
  function mutate(fn){const next=queue.then(async()=>{const items=await load();const result=fn(items);await save(items);return result;});queue=next.catch(()=>{});return next;}
  async function body(req){let result='';for await(const part of req){result+=part;if(result.length>150000)throw fail(413,'Solicitação muito grande.');}try{return JSON.parse(result||'{}');}catch{throw fail(400,'Dados inválidos.');}}
  function json(res,status,value,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value));}
  function admin(req){if(!password)return true;const match=(req.headers.cookie||'').match(/(?:^|;\s*)organzza_admin=([^;]+)/);const expiry=match&&sessions.get(match[1]);return Boolean(expiry&&expiry>Date.now());}
  function validate(item,items,excludeId,{allowPast=false,allowLegacy=false,allowCustom=false}={}){if(!item.clientName)throw fail(400,'Informe o nome da cliente.');if(!allowLegacy&&!(allowCustom?validCustomTime(item.date,item.time):slotsForDate(item.date).includes(item.time)))throw fail(400,'Escolha uma data e um horário válidos.');if(!allowPast&&item.date<today())throw fail(400,'Escolha uma data futura para a prova.');if(blocking(item)&&items.some(i=>i.id!==excludeId&&appointmentsOverlap(i,item)&&blocking(i)))throw fail(409,'Esse horário já foi solicitado. Escolha outro.');}
  return async function bookingApi(req,res,url){
    if(!url.pathname.startsWith('/api/'))return false;
    try{
      if(url.pathname==='/api/health'&&req.method==='GET'){json(res,200,{ok:true});return true;}
      if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)throw fail(403,'Origem não autorizada.');
      if(url.pathname==='/api/admin/login'&&req.method==='POST'){
        const data=await body(req),input=Buffer.from(String(data.password||'')),expected=Buffer.from(password);
        if(password&&(input.length!==expected.length||!timingSafeEqual(input,expected)))throw fail(401,'Senha incorreta.');
        const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*60*60*1000);
        json(res,200,{ok:true},{'Set-Cookie':`organzza_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${req.headers['x-forwarded-proto']==='https'?'; Secure':''}`});return true;
      }
      if(url.pathname.startsWith('/api/admin/')&&!admin(req))throw fail(401,'Entre no painel para consultar os agendamentos.');
      if(url.pathname==='/api/availability'&&req.method==='GET'){const items=await load();json(res,200,items.filter(blocking).map(({id,date,time,status})=>({id,date,time,status})));return true;}
      if(url.pathname==='/api/admin/appointments'&&req.method==='GET'){json(res,200,await load());return true;}
      if(['/api/appointments','/api/admin/appointments'].includes(url.pathname)&&req.method==='POST'){
        const data=await body(req),isAdmin=url.pathname.includes('/admin/'),item=normalize({...data,id:randomUUID(),status:isAdmin?data.status:'pending',source:isAdmin?'admin':'site',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),history:[],refusalReason:''});
        if(!isAdmin&&!/^\d{10,15}$/.test(item.phone.replace(/\D/g,'')))throw fail(400,'Informe um telefone válido para contato.');
        if(!isAdmin)item.legacyId='';
        const result=await mutate(items=>{if(isAdmin&&data.legacyId){const existing=items.find(i=>i.id===data.legacyId||i.legacyId===data.legacyId);if(existing)return existing;}validate(item,items,undefined,{allowCustom:isAdmin,allowPast:isAdmin&&Boolean(data.legacyId),allowLegacy:isAdmin&&Boolean(data.legacyId)});items.push(item);return item;});json(res,201,result);return true;
      }
      const match=url.pathname.match(/^\/api\/admin\/appointments\/([^/]+)$/);
      if(match&&req.method==='PATCH'){
        const patch=await body(req);const result=await mutate(items=>{const index=items.findIndex(i=>i.id===decodeURIComponent(match[1]));if(index<0)throw fail(404,'Agendamento não encontrado.');const old=items[index],next=normalize({...old,...patch,id:old.id,source:old.source,createdAt:old.createdAt,requestedDate:old.requestedDate,requestedTime:old.requestedTime,history:old.history,updatedAt:new Date().toISOString()});validate(next,items,old.id,{allowCustom:true,allowPast:!blocking(next)||(old.date===next.date&&old.time===next.time&&old.status===next.status),allowLegacy:!blocking(next)&&old.date===next.date&&old.time===next.time});if(old.status!==next.status||old.date!==next.date||old.time!==next.time)next.history=[...old.history,{at:next.updatedAt,fromStatus:old.status,toStatus:next.status,fromDate:old.date,fromTime:old.time,date:next.date,time:next.time}];items[index]=next;return next;});json(res,200,result);return true;
      }
      json(res,404,{error:'Recurso não encontrado.'});
    }catch(error){json(res,error.status||500,{error:error.status?error.message:'Não foi possível salvar o agendamento. Tente novamente.'});}
    return true;
  };
}
