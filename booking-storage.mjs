import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {Pool} from 'pg';
import {attachDatabasePool} from '@vercel/functions';

const unavailable=message=>Object.assign(new Error(message),{status:503});
export const BOOKING_SCHEMA=`
  CREATE TABLE IF NOT EXISTS organzza_booking_state (
    id smallint PRIMARY KEY CHECK (id = 1),
    revision bigint NOT NULL DEFAULT 0,
    appointments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(appointments) = 'array')
  )`;

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

export function createPostgresStorage(connectionString) {
  let url;
  try {url=new URL(connectionString);}catch {throw unavailable('Configure DATABASE_URL com a conexão PostgreSQL.');}
  if(!['postgres:','postgresql:'].includes(url.protocol))throw unavailable('DATABASE_URL deve ser uma conexão PostgreSQL.');
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(!local) {
    const mode=url.searchParams.get('sslmode');
    if(mode&& !['require','verify-ca','verify-full'].includes(mode))throw unavailable('Configure uma conexão segura com o banco de dados.');
    if(!mode||mode==='require')url.searchParams.set('sslmode','verify-full');
  }
  const pool=new Pool({connectionString:url.toString(),max:2,idleTimeoutMillis:5000,connectionTimeoutMillis:8000,allowExitOnIdle:true});
  pool.on('error',()=>{});
  attachDatabasePool(pool);
  let ready;
  async function initialize() {
    if(!ready)ready=(async()=>{
      // Initial cold starts can race when creating the table. Once created,
      // IF NOT EXISTS and ON CONFLICT preserve every existing appointment.
      for(let attempt=0;attempt<3;attempt++) {
        try {await pool.query(BOOKING_SCHEMA);break;}
        catch(error) {if(attempt===2||!['42P07','23505'].includes(error.code))throw error;}
      }
      await pool.query("INSERT INTO organzza_booking_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING");
    })().catch(error=>{ready=undefined;throw error;});
    return ready;
  }
  async function snapshot() {
    await initialize();
    const {rows}=await pool.query('SELECT revision, appointments FROM organzza_booking_state WHERE id = 1');
    if(!rows.length||!Array.isArray(rows[0].appointments))throw unavailable('Não foi possível consultar os agendamentos.');
    return rows[0];
  }
  async function mutate(fn) {
    // Compare-and-swap is atomic in Postgres, including across independent
    // functions. A stale writer reloads and validates the latest agenda.
    for(let attempt=0;attempt<16;attempt++) {
      const {revision,appointments}=await snapshot();
      const result=fn(appointments);
      const saved=await pool.query('UPDATE organzza_booking_state SET appointments = $1::jsonb, revision = revision + 1 WHERE id = 1 AND revision = $2 RETURNING revision',[JSON.stringify(appointments),revision]);
      if(saved.rowCount===1)return result;
    }
    throw unavailable('A agenda recebeu outras alterações. Atualize e tente novamente.');
  }
  return {mode:'postgres',initialize,load:async()=>(await snapshot()).appointments,mutate,check:async()=>{await snapshot();},close:()=>pool.end()};
}

export function createBookingStorage({databaseUrl,dataDir,requireDatabase=false}) {
  if(databaseUrl)return createPostgresStorage(databaseUrl);
  if(requireDatabase) {
    const reject=async()=>{throw unavailable('Configure DATABASE_URL na hospedagem para ativar os agendamentos.');};
    return {mode:'unconfigured',load:reject,mutate:reject,check:reject,close:async()=>{}};
  }
  return createFileStorage(dataDir);
}
