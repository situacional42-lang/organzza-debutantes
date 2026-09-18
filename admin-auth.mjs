import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const SESSION_SECONDS=8*60*60;
export function createAdminAuth({password='',secret='',required=false,now=Date.now}) {
  const configurationError=required&&(!password||secret.length<32)?'Configure ADMIN_PASSWORD e SESSION_SECRET (mínimo de 32 caracteres) na hospedagem.':'';
  // Signing also binds sessions to the password; rotating it revokes old cookies.
  const signingKey=createHmac('sha256',secret||'organzza-local-session').update(password).digest();
  const sign=payload=>createHmac('sha256',signingKey).update(payload).digest('base64url');
  function validPassword(input) {
    return timingSafeEqual(createHash('sha256').update(String(input||'')).digest(),createHash('sha256').update(password).digest());
  }
  function createSession() {
    const payload=Buffer.from(JSON.stringify({exp:Math.floor(now()/1000)+SESSION_SECONDS,nonce:randomBytes(16).toString('base64url')})).toString('base64url');
    return payload+'.'+sign(payload);
  }
  function validSession(token) {
    if(!token||token.length>1024)return false;
    const parts=token.split('.');if(parts.length!==2)return false;
    const [payload,signature]=parts,expected=Buffer.from(sign(payload)),actual=Buffer.from(signature);
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;
    try {const claims=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return Number.isInteger(claims.exp)&&claims.exp>Math.floor(now()/1000);}catch {return false;}
  }
  function authorized(req) {
    if(configurationError)return false;
    if(!password&&!required)return true;
    const token=(req.headers.cookie||'').match(/(?:^|;\s*)organzza_admin=([^;]+)/)?.[1];
    return validSession(token);
  }
  function cookie(token,secure=false) {
    return `organzza_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token?SESSION_SECONDS:0}${secure?'; Secure':''}`;
  }
  return {configurationError,validPassword,createSession,validSession,authorized,cookie};
}
