import {firebaseOptionsFromEnv} from './booking-storage.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBookingApi} from './booking-server.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg'};
const port=Number(process.env.PORT)||4173;
const vercel=process.env.VERCEL==='1';
const host=process.env.HOST||(vercel?'0.0.0.0':'127.0.0.1');
if(!vercel&&!['127.0.0.1','localhost','::1'].includes(host)&&!process.env.ADMIN_PASSWORD)throw Error('Defina ADMIN_PASSWORD para disponibilizar o painel na rede.');
const api=createBookingApi({dataDir:process.env.ORGANZZA_DATA_DIR||path.join(root,'data'),password:process.env.ADMIN_PASSWORD||'',sessionSecret:process.env.SESSION_SECRET||'',firebase:firebaseOptionsFromEnv(),vercel});
http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');if(await api(req,res,url))return;const requested=decodeURIComponent(url.pathname);const filename=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));if(!filename.startsWith(root+path.sep)||!mime[path.extname(filename)]||/^\/(data|node_modules|scripts)(\/|$)/.test(requested)){res.writeHead(403);res.end('Acesso negado');return;}const data=await readFile(filename);res.writeHead(200,{'Content-Type':mime[path.extname(filename)],'Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Página não encontrada');}
}).listen(port,host,()=>console.log(`Organzza Debutantes: http://localhost:${port}`));
