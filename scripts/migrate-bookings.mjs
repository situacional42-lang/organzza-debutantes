import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createPostgresStorage} from '../booking-storage.mjs';
import {normalizeAppointment,validCustomTime,appointmentsOverlap} from '../booking-server.mjs';

let storage;
try {
  if(!process.env.DATABASE_URL)throw Error('Defina DATABASE_URL no ambiente para importar os pedidos.');
  const file=process.argv[2]||path.join(process.env.ORGANZZA_DATA_DIR||'data','appointments.json');
  let raw;
  try {raw=JSON.parse(await readFile(file,'utf8'));}catch {throw Error('Não foi possível ler o arquivo JSON informado.');}
  if(!Array.isArray(raw)||raw.some(item=>!item.id||!item.clientName||!validCustomTime(item.date,item.time)))throw Error('Confira o arquivo: cada pedido precisa de ID, nome, data e horário válidos.');
  const incoming=raw.map(normalizeAppointment);
  storage=createPostgresStorage(process.env.DATABASE_URL);
  const counts=await storage.mutate(items=>{
    let imported=0,skipped=0;
    for(const item of incoming) {
      if(items.some(old=>old.id===item.id||old.legacyId===item.id||(item.legacyId&&old.legacyId===item.legacyId))) {skipped++;continue;}
      const blocking=value=>['pending','scheduled'].includes(value.status);
      if(blocking(item)&&items.some(old=>blocking(old)&&appointmentsOverlap(old,item)))throw Error('Há conflito entre provas. Confira os horários antes de importar.');
      items.push(item);imported++;
    }
    return {imported,skipped};
  });
  console.log(`Importados: ${counts.imported}. Já existentes: ${counts.skipped}. O arquivo original foi preservado.`);
} catch(error) {
  const safe=error.code?'Não foi possível acessar o banco. Confira DATABASE_URL e a conexão.':error.message;
  console.error(safe);process.exitCode=1;
} finally {await storage?.close();}
