let apiPromise;

async function getApi() {
  if(!apiPromise)apiPromise=Promise.all([
    import('../booking-server.mjs'),
    import('../booking-storage.mjs')
  ]).then(([{createBookingApi},{firebaseOptionsFromEnv}])=>createBookingApi({
    dataDir:'/tmp/organzza',
    password:process.env.ADMIN_PASSWORD||'',
    sessionSecret:process.env.SESSION_SECRET||'',
    firebase:firebaseOptionsFromEnv(),
    vercel:true
  })).catch(error=>{apiPromise=undefined;throw error;});
  return apiPromise;
}

export default async function handler(req,res) {
  try {
    const api=await getApi();
    const url=new URL(req.url,'https://localhost');
    if(await api(req,res,url))return;
    res.writeHead(404,{'Content-Type':'application/json; charset=utf-8'});
    res.end(JSON.stringify({error:'Recurso não encontrado.'}));
  } catch(error) {
    console.error('Organzza: falha ao iniciar a API.',{name:error.name,code:error.code||'UNKNOWN'});
    res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:'O agendamento está temporariamente indisponível. Entre em contato com a loja pelo WhatsApp.',code:'BOOKING_INIT_FAILED'}));
  }
}
