/** B1 opt-in SPA client. No sample state or tokens are ever uploaded or persisted. */
export interface ConnectionConfig {
 apiOrigin:string;authorizationUrl:string;tokenUrl:string;clientId:string;redirectUri:string
}
export interface Session {accessToken:string;expiresAt:number}
export class WealthApiError extends Error{
 constructor(public status:number,public code:string,message:string){super(message)}
}
const transientKey='wealth-os-b1-pkce-once';
export const isUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function safeEndpoint(raw:string,kind:'api'|'oidc'):URL{
 const url=new URL(raw);
 const local=['localhost','127.0.0.1'].includes(url.hostname);
 if(url.username||url.password||url.hash||url.search||(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))){
  throw new Error(kind+' endpoint must be HTTPS (or local HTTP), without secrets, fragments or query parameters.');
 }
 return url;
}
export function readConnectionConfig(env:Record<string,string|undefined>={}):ConnectionConfig|null{
 const api=env.VITE_WEALTH_API_URL,authorize=env.VITE_WEALTH_OIDC_AUTHORIZE_URL;
 const token=env.VITE_WEALTH_OIDC_TOKEN_URL,clientId=env.VITE_WEALTH_OIDC_CLIENT_ID;
 if(!api||!authorize||!token||!clientId)return null;
 const base=safeEndpoint(api,'api'),auth=safeEndpoint(authorize,'oidc'),tok=safeEndpoint(token,'oidc');
 if(base.pathname!=='/'||base.search||base.hash)throw new Error('VITE_WEALTH_API_URL must be an origin only (no path).');
 if(clientId.length>180)throw new Error('Invalid OIDC client identifier.');
 const redirect=typeof window==='undefined'?'http://localhost:5173/Wealth-Os/':window.location.origin+window.location.pathname;
 return {apiOrigin:base.origin,authorizationUrl:auth.href,tokenUrl:tok.href,clientId,redirectUri:redirect};
}
function randomUrlSafe(size:number){
 const bytes=crypto.getRandomValues(new Uint8Array(size));
 return b64(bytes);
}
function b64(bytes:Uint8Array):string{
 let str='';for(const b of bytes)str+=String.fromCharCode(b);
 return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function challenge(verifier:string){
 const bytes=new TextEncoder().encode(verifier);
 return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));
}
export async function makeLoginUrl(config:ConnectionConfig,storage:Pick<Storage,'setItem'>=sessionStorage):Promise<string>{
 const state=randomUrlSafe(32),verifier=randomUrlSafe(48),nonce=randomUrlSafe(24);
 storage.setItem(transientKey,JSON.stringify({state,verifier,expiresAt:Date.now()+10*60*1000}));
 const url=new URL(config.authorizationUrl);
 url.searchParams.set('response_type','code');
 url.searchParams.set('client_id',config.clientId);
 url.searchParams.set('redirect_uri',config.redirectUri);
 url.searchParams.set('scope','openid profile wealth:read wealth:write');
 url.searchParams.set('state',state);
 url.searchParams.set('nonce',nonce);
 url.searchParams.set('code_challenge_method','S256');
 url.searchParams.set('code_challenge',await challenge(verifier));
 return url.href;
}
export async function completeLogin(config:ConnectionConfig,params:URLSearchParams,storage:Pick<Storage,'getItem'|'removeItem'>=sessionStorage):Promise<Session>{
 const code=params.get('code'),state=params.get('state'),error=params.get('error');
 if(error)throw new Error('Identity provider returned an error: '+error.slice(0,80));
 if(!code||!state)throw new Error('OIDC authorization code or state is missing.');
 const raw=storage.getItem(transientKey);
 storage.removeItem(transientKey);
 if(!raw)throw new Error('Login state expired or not found. Start authorization again.');
 let stored:unknown;
 try{stored=JSON.parse(raw)}catch{throw new Error('Login state is invalid. Start authorization again.')}
 if(!stored||typeof stored!=='object')throw new Error('Login state is invalid.');
 const p=stored as {state?:string;verifier?:string;expiresAt?:number};
 if(p.state!==state||typeof p.verifier!=='string'||p.verifier.length<40||!p.expiresAt||Date.now()>p.expiresAt){
  throw new Error('OIDC state mismatch or login attempt expired.');
 }
 const response=await fetch(config.tokenUrl,{
  method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:config.redirectUri,client_id:config.clientId,code_verifier:p.verifier})
 });
 if(!response.ok)throw new Error('OIDC token exchange was rejected ('+response.status+').');
 const data:unknown=await response.json();
 if(!data||typeof data!=='object')throw new Error('OIDC provider response is invalid.');
 const token=data as {access_token?:unknown;expires_in?:unknown;token_type?:unknown};
 if(typeof token.access_token!=='string'||token.access_token.length<10||token.token_type!=='Bearer'||
 typeof token.expires_in!=='number'||token.expires_in<=0||token.expires_in>3600){
  throw new Error('OIDC provider did not return a usable short-lived Bearer access token.');
 }
 // Token exists only inside React memory, never in localStorage/sessionStorage.
 return {accessToken:token.access_token,expiresAt:Date.now()+token.expires_in*1000};
}
export function scrubAuthQuery():void{
 if(typeof window==='undefined')return;
 const url=new URL(window.location.href);
 for(const key of ['code','state','error','error_description','session_state','iss'])url.searchParams.delete(key);
 window.history.replaceState(null,'',url.pathname+url.search+'#connected');
}
export async function apiRequest<T>(config:ConnectionConfig,session:Session,tenantId:string,path:string,options?:{method?:'GET'|'POST'|'PATCH'|'PUT';body?:unknown;version?:number|string;idempotencyKey?:string}):Promise<T>{
 if(Date.now()>session.expiresAt-5000)throw new WealthApiError(401,'SESSION_EXPIRED','Your OIDC access token expired; sign in again.');
 if(!isUuid(tenantId))throw new WealthApiError(400,'TENANT_REQUIRED','Enter your provisioned Wealth OS tenant UUID.');
 if(!path.startsWith('/api/v1/wealth/')||path.includes('..'))throw new Error('Unexpected Wealth OS API route.');
 const url=new URL(path,config.apiOrigin);
 if(url.origin!==config.apiOrigin)throw new Error('Cross-origin API route rejected.');
 const h:Record<string,string>={
  Authorization:'Bearer '+session.accessToken,'X-Wealth-Tenant-Id':tenantId
 };
 if(options?.body!==undefined)h['Content-Type']='application/json';
 if(options?.version!==undefined)h['If-Match']='"'+String(options.version)+'"';
 if(options?.idempotencyKey)h['Idempotency-Key']=options.idempotencyKey;
 let response:Response;
 try{
  response=await fetch(url.href,{method:options?.method??'GET',mode:'cors',
   credentials:'omit',cache:'no-store',redirect:'error',headers:h,
   body:options?.body===undefined?undefined:JSON.stringify(options.body)});
 }catch{throw new WealthApiError(0,'NETWORK_UNAVAILABLE','Wealth OS API is unreachable or has not enabled this website as an allowed origin.');}
 const raw:unknown=await response.json().catch(()=>null);
 if(!response.ok){
  const data=raw as {error?:{code?:string;message?:string}}|null;
  throw new WealthApiError(response.status,data?.error?.code??'HTTP_'+response.status,
   data?.error?.message??'The Wealth OS API rejected the request.');
 }
 return raw as T;
}
