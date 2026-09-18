import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {initializeApp,cert,deleteApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';

const unavailable=message=>Object.assign(new Error(message),{status:503});

export function createFileStorage(dataDir) {
  const file=path.join(dataDir,'appointments.json');
  let queue=Promise.resolve();
  async function load() {
    try {
      const items=JSON.parse(await readFile(file,'utf8'));
      if(!Array.isArray(items))throw Error('Arquivo de agendamentos inválido.');
      return items;
    } catch(error) {if(error.code==='ENOENT')return [];throw error;}
  }
  async function mutate(fn) {
    const next=queue.then(async()=>{
      const items=await load(),result=fn(items);
      await mkdir(dataDir,{recursive:true});
      await writeFile(file+'.tmp',JSON.stringify(items,null,2),'utf8');
      await rename(file+'.tmp',file);
      return result;
    });
    queue=next.catch(()=>{});
    return next;
  }
  return {mode:'file',load,mutate,check:async()=>{await load();},close:async()=>{await queue;}};
}

export function firebaseOptionsFromEnv(env=process.env) {
  return {projectId:env.FIREBASE_PROJECT_ID||'',clientEmail:env.FIREBASE_CLIENT_EMAIL||'',privateKey:env.FIREBASE_PRIVATE_KEY||'',emulator:env.NODE_ENV==='test'&&Boolean(env.FIRESTORE_EMULATOR_HOST)};
}

export function createFirestoreStorage({projectId,clientEmail,privateKey,emulator=false}) {
  if(!projectId||(!emulator&&(!clientEmail||!privateKey)))throw unavailable('Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY na hospedagem.');
  if(process.env.FIRESTORE_EMULATOR_HOST&&!emulator)throw unavailable('O emulador do Firestore é permitido apenas nos testes.');
  let app;
  try {app=initializeApp({projectId,...(emulator?{}:{credential:cert({projectId,clientEmail,privateKey:privateKey.replace(/\\n/g,'\n')})})},'organzza-'+randomUUID());}
  catch {throw unavailable('Confira a credencial da conta de serviço do Firebase.');}
  const db=getFirestore(app),collection=db.collection('organzzaAppointments'),guard=db.doc('organzzaSystem/appointments');
  const documentId=id=>createHash('sha256').update(id).digest('hex');
  async function load() {return (await collection.get()).docs.map(doc=>doc.data());}
  async function mutate(fn) {
    // Every writer locks the same guard before reading the agenda. Firestore
    // retries the entire transaction after concurrent updates, including validation.
    return db.runTransaction(async transaction=>{
      await transaction.get(guard);
      const snapshot=await transaction.get(collection);
      const items=snapshot.docs.map(doc=>doc.data());
      const previous=new Map(items.map(item=>[item.id,JSON.stringify(item)]));
      const result=fn(items),ids=new Set();
      for(const item of items) {
        if(typeof item.id!=='string'||!item.id||ids.has(item.id))throw Error('Identificador de agendamento inválido.');
        ids.add(item.id);
        if(previous.get(item.id)!==JSON.stringify(item))transaction.set(collection.doc(documentId(item.id)),item);
      }
      for(const item of snapshot.docs)if(!ids.has(item.data().id))transaction.delete(item.ref);
      transaction.set(guard,{revision:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp()},{merge:true});
      return result;
    },{maxAttempts:10});
  }
  return {mode:'firestore',load,mutate,check:async()=>{await guard.get();},close:async()=>{await db.terminate();await deleteApp(app);}};
}

export function createBookingStorage({firebase={},dataDir,requireDatabase=false}) {
  try {
    if(firebase.projectId||firebase.clientEmail||firebase.privateKey||requireDatabase)return createFirestoreStorage(firebase);
    return createFileStorage(dataDir);
  } catch(error) {
    const reject=async()=>{throw error;};
    return {mode:'unconfigured',load:reject,mutate:reject,check:reject,close:async()=>{}};
  }
}
