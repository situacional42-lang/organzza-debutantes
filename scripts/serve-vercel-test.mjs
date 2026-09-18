import http from 'node:http';
import handler from '../api/index.mjs';

// The production function is imported directly, without server.mjs or listen shims.
http.createServer(async(req,res)=>{
  if(process.env.VERCEL_PARSED_BODY==='1'&&req.headers['content-type']?.includes('application/json')) {
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const raw=Buffer.concat(chunks).toString('utf8');
    Object.defineProperty(req,'body',{get:()=>JSON.parse(raw)});
  }
  await handler(req,res);
}).listen(Number(process.env.PORT)||4192,'127.0.0.1');
