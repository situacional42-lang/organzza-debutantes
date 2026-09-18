import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createAdminAuth} from '../admin-auth.mjs';
import {generateKeyPairSync} from 'node:crypto';
import {createFirestoreStorage,createBookingStorage} from '../booking-storage.mjs';

const password='senha-de-teste',secret='segredo-de-teste-com-mais-de-32-caracteres';
const auth=createAdminAuth({password,secret}),secondAuth=createAdminAuth({password,secret});
assert.equal(secondAuth.validSession(auth.createSession()),true);
assert.equal(secondAuth.validSession(auth.createSession()+'x'),false);
assert.equal(secondAuth.validSession(createAdminAuth({password,secret,now:()=>Date.now()-9*3600000}).createSession()),false);
assert.equal(createAdminAuth({password:'senha-alterada',secret}).validSession(auth.createSession()),false);
assert.equal(createAdminAuth({password,secret:'outro-segredo-aleatorio-com-32-caracteres'}).validSession(auth.createSession()),false);
const missingCredentials=createBookingStorage({firebase:{projectId:'demo-organzza-test'},requireDatabase:true});
await assert.rejects(missingCredentials.check(),{status:503});

const temporary=await mkdtemp(path.join(os.tmpdir(),'organzza-vercel-test-'));
const processes=[];
assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Execute npm run check:vercel para iniciar o emulador isolado.');
const firebaseEnv={FIREBASE_PROJECT_ID:'demo-organzza-test',FIREBASE_CLIENT_EMAIL:'',FIREBASE_PRIVATE_KEY:'',FIRESTORE_EMULATOR_HOST:process.env.FIRESTORE_EMULATOR_HOST,NODE_ENV:'test'};
function launch(port,extra={}) {
  const process=spawn(globalThis.process.execPath,['scripts/serve-vercel-test.mjs'],{env:{...globalThis.process.env,...firebaseEnv,VERCEL:'1',VERCEL_PARSED_BODY:port===4193?'1':'',HOST:'127.0.0.1',PORT:String(port),ADMIN_PASSWORD:password,SESSION_SECRET:secret,ORGANZZA_DATA_DIR:path.join(temporary,'unused-files'),...extra},stdio:'pipe',windowsHide:true});
  processes.push(process);return process;
}
async function stop(process) {if(process.exitCode!==null||process.signalCode!==null)return;process.kill();await new Promise(resolve=>process.once('exit',resolve));}
async function started(port,expected=200) {
  for(let i=0;i<150;i++) {try{if((await fetch(`http://127.0.0.1:${port}/api/health`)).status===expected)return;}catch{}await new Promise(r=>setTimeout(r,100));}
  throw Error(`Servidor ${port} não iniciou.`);
}
async function request(port,route,method='GET',body,cookie='',extra={}) {
  const response=await fetch(`http://127.0.0.1:${port}${route}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...extra},body:body?JSON.stringify(body):undefined});
  const result=await response.json();return {response,result,status:response.status};
}
try {
  let first=launch(4192),second=launch(4193);
  await Promise.all([started(4192),started(4193)]);
  const login=await request(4192,'/api/admin/login','POST',{password});assert.equal(login.status,200);
  const header=login.response.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);assert.match(header,/Secure/);
  const cookie=header.split(';')[0];
  assert.equal((await request(4193,'/api/admin/appointments','GET',undefined,cookie)).status,200);
  assert.equal((await request(4193,'/api/admin/appointments')).status,401);
  assert.equal((await request(4193,'/api/admin/appointments','GET',undefined,cookie+'x')).status,401);
  assert.equal((await request(4192,'/api/admin/login','POST',{password:'errada'})).status,401);
  const date=new Date();date.setDate(date.getDate()+5);while(date.getDay()===0)date.setDate(date.getDate()+1);
  const value=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const payload={clientName:'Cliente de teste',phone:'27999990000',date:value,time:'10:00',status:'scheduled',source:'admin',requestedTime:'17:00'};
  const parallel=await Promise.all(Array.from({length:8},(_,i)=>request(i%2?4192:4193,'/api/appointments','POST',payload)));
  assert.equal(parallel.filter(r=>r.status===201).length,1);assert.equal(parallel.filter(r=>r.status===409).length,7);
  const appointment=parallel.find(r=>r.status===201).result;assert.equal(appointment.status,'pending');assert.equal(appointment.source,'site');assert.equal(appointment.requestedTime,'10:00');
  assert.equal((await request(4193,'/api/admin/appointments','GET',undefined,cookie)).result.length,1);
  const publicData=(await request(4192,'/api/availability')).result;assert.equal(publicData[0].clientName,undefined);assert.equal(publicData[0].phone,undefined);
  const route='/api/admin/appointments/'+appointment.id;
  const restBase='http://'+process.env.FIRESTORE_EMULATOR_HOST+'/v1/projects/demo-organzza-test/databases/(default)/documents';
  for(const collection of ['organzzaAppointments','organzzaSystem']) {
    assert.equal((await fetch(restBase+'/'+collection)).status,403);
    assert.equal((await fetch(restBase+'/'+collection+'?documentId=forbidden',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:{id:{stringValue:'forbidden'}}})})).status,403);
  }
  assert.equal((await request(4193,route,'PATCH',{status:'scheduled'},cookie)).status,200);
  const moved=await request(4192,route,'PATCH',{date:value,time:'18:30'},cookie);assert.equal(moved.status,200);assert.equal(moved.result.requestedTime,'10:00');assert.equal(moved.result.history.length,2);
  assert.equal((await request(4193,'/api/admin/appointments','POST',{clientName:'Conflito',date:value,time:'19:00',status:'scheduled'},cookie)).status,409);
  const rejected=await request(4193,route,'PATCH',{status:'rejected',refusalReason:'Vamos combinar outra data.'},cookie);assert.equal(rejected.status,200);
  assert.equal((await request(4192,'/api/availability')).result.length,0);
  assert.equal((await request(4192,'/api/appointments','POST',{...payload,time:'18:30',allowCustom:true})).status,400);
  assert.equal((await request(4192,'/api/admin/appointments','POST',{clientName:'Data inválida',date:'2026-02-31',time:'10:30'},cookie)).status,400);
  assert.equal((await request(4192,route,'PATCH',{status:'cancelled'},cookie,{Origin:'https://outro-site.example'})).status,403);
  const differentDates=Array.from({length:8},(_,i)=>({...payload,date:`${date.getFullYear()+1}-01-${String(i+10).padStart(2,'0')}`,time:'11:15',status:'scheduled'}));
  const simultaneous=await Promise.all(differentDates.map((item,i)=>request(i%2?4192:4193,'/api/admin/appointments','POST',item,cookie)));assert.equal(simultaneous.every(r=>r.status===201),true);
  const legacy={clientName:'Pedido antigo',date:`${date.getFullYear()+1}-02-10`,time:'11:30',status:'scheduled',legacyId:'legacy-example'};
  const imports=await Promise.all([request(4192,'/api/admin/appointments','POST',legacy,cookie),request(4193,'/api/admin/appointments','POST',legacy,cookie)]);assert.equal(imports[0].result.id,imports[1].result.id);
  const list=(await request(4192,'/api/admin/appointments','GET',undefined,cookie)).result;assert.equal(list.length,10);
  const originalFile=path.join(temporary,'appointments.json');
  await writeFile(originalFile,JSON.stringify([{...list[0]},{id:'server-file-import',clientName:'Importação do servidor',date:`${date.getFullYear()+1}-03-10`,time:'11:30',status:'scheduled'}]));
  async function migrate() {const p=spawn(process.execPath,['scripts/migrate-bookings.mjs',originalFile],{env:{...process.env,...firebaseEnv},stdio:'pipe',windowsHide:true});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);const code=await new Promise(r=>p.once('exit',r));assert.equal(code,0,output);return output;}
  assert.match(await migrate(),/Importados: 1/);assert.match(await migrate(),/Importados: 0/);
  await stop(first);await stop(second);first=launch(4192);second=launch(4193);await Promise.all([started(4192),started(4193)]);
  const restored=await request(4193,'/api/admin/appointments','GET',undefined,cookie);assert.equal(restored.status,200);assert.equal(restored.result.length,11);assert.equal(restored.result.find(i=>i.id===appointment.id).status,'rejected');
  assert.equal((await request(4192,'/api/admin/logout','POST',{},cookie)).status,200);
  await assert.rejects(stat(path.join(temporary,'unused-files')),{code:'ENOENT'});
  const noDatabase=launch(4194,{FIREBASE_PROJECT_ID:''});await started(4194,503);assert.equal((await request(4194,'/api/appointments','POST',payload)).status,503);await stop(noDatabase);
  const noSecret=launch(4194,{SESSION_SECRET:''});await started(4194,503);assert.equal((await request(4194,'/api/admin/login','POST',{password})).status,503);await stop(noSecret);
  const emulatorHost=process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  try {
    assert.throws(()=>createFirestoreStorage({projectId:'demo-organzza-test',clientEmail:'test@example.com',privateKey:'invalid-private-key'}),{status:503});
    const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
    for(const key of [privateKey,privateKey.replaceAll('\n','\\n')]) {
      const configured=createFirestoreStorage({projectId:'demo-organzza-test',clientEmail:'test@example.com',privateKey:key});
      assert.equal(configured.mode,'firestore');await configured.close();
    }
  } finally {process.env.FIRESTORE_EMULATOR_HOST=emulatorHost;}
  console.log('OK: Firestore via Firebase Admin SDK, duas instâncias, login após reinício, cookies seguros, expiração, concorrência sem duplicatas ou perda de pedidos, horários personalizados, aceite/recusa/remarcação, importação idempotente, regras bloqueando acesso direto e Vercel sem gravação em arquivos.');
} finally {
  await Promise.all(processes.map(stop));
  assert.ok(path.resolve(temporary).startsWith(path.join(os.tmpdir(),'organzza-vercel-test-')));await rm(temporary,{recursive:true,force:true});
}
