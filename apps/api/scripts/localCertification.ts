/**
 * L1: real signed local Keycloak JWT + existing Ubuntu PostgreSQL smoke certification.
 * This writes ONLY local-test-owned profile/goal/milestone/strategy rows.
 * It never imports mock financial history or certifies a production provider.
 */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {loadConfig} from '../src/env.js';
import {createOidcVerifier} from '../src/auth.js';
import {createProducerVerifier} from '../src/b2/sourceContracts.js';

type Json=Record<string,unknown>;
type Reply={status:number;body:Json};
const config=loadConfig();
const statePath=resolve(process.cwd(),'../../.local/wealth-os/state.json');
const credsPath=resolve(process.cwd(),'../../.local/wealth-os/test-credentials.json');
const tasks:string[]=[];
const check=(cond:unknown,label:string)=>{
 if(!cond)throw Error('LOCAL_CERTIFICATION_FAILED: '+label);
 tasks.push(label+': PASS');
};
const readJson=async(path:string)=>JSON.parse(await readFile(path,'utf8')) as Json;
const postToken=async(endpoint:string,body:URLSearchParams):Promise<string>=>{
 const response=await fetch(endpoint,{method:'POST',redirect:'error',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body,signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Local identity issuer rejected a test-only OAuth flow. HTTP '+response.status);
 const data=await response.json() as {access_token?:unknown;token_type?:unknown};
 if(typeof data.access_token!=='string'||data.token_type!=='Bearer')
  throw Error('Local identity issuer did not provide a signed Bearer token.');
 return data.access_token;
};
const apiFetch=async(path:string,options?:{method?:string;token?:string;tenantId?:string;body?:unknown;
 version?:string|number;key?:string}):Promise<Reply>=>{
 const tenant=options?.tenantId??String(local.tenantId);
 const headers:Record<string,string>={'X-Wealth-Tenant-Id':tenant,'Accept':'application/json'};
 if(options?.token)headers.Authorization='Bearer '+options.token;
 if(options?.body!==undefined)headers['Content-Type']='application/json';
 if(options?.version!==undefined)headers['If-Match']='"'+options.version+'"';
 if(options?.key)headers['Idempotency-Key']=options.key;
 const response=await fetch('http://127.0.0.1:3009'+path,{
  method:options?.method??'GET',headers,redirect:'error',
  signal:AbortSignal.timeout(8000),body:options?.body===undefined?undefined:JSON.stringify(options.body)
 });
 const body=await response.json() as Json;
 return {status:response.status,body};
};
const data=(res:Reply)=>res.body.data as Record<string,unknown>;
let local:Json={};
try{
 if(config.RUNTIME_MODE!=='development' || new URL(config.OIDC_ISSUER).hostname!=='127.0.0.1' ||
    new URL(config.OIDC_JWKS_URL).hostname!=='127.0.0.1')
  throw Error('LOCAL_CERTIFICATION_FAILED: requires LOCAL development-only OIDC issuer.');
 local=await readJson(statePath);
 const creds=await readJson(credsPath);
 if(local.testOnly!==true||local.database!=='wealth_os_local'||creds.testOnly!==true)
  throw Error('LOCAL_CERTIFICATION_FAILED: missing isolated local test state.');
 const port=Number(local.oidcPort);
 check(Number.isInteger(port)&&config.OIDC_ISSUER===
  'http://127.0.0.1:'+port+'/realms/wealth-os-local','Pinned test-only Keycloak issuer');
 const tokenEndpoint=config.OIDC_ISSUER+'/protocol/openid-connect/token';
 const humanToken=await postToken(tokenEndpoint,new URLSearchParams({
  grant_type:'password',client_id:'wealth-os-local-spa',username:String(creds.username),
  password:String(creds.password),scope:'openid wealth:read wealth:write'
 }));
 const identity=await createOidcVerifier(config)(humanToken);
 check(identity.subject===local.userSub &&
  identity.scopes.has('wealth:read')&&identity.scopes.has('wealth:write'),
  'Real signed Keycloak test subject, scopes and pinned audience verified');
 const serviceToken=await postToken(tokenEndpoint,new URLSearchParams({
  grant_type:'client_credentials',client_id:String(creds.serviceClientId),
  client_secret:String(creds.serviceSecret),scope:'wealth:ingest'
 }));
 const producer=createProducerVerifier(config);
 check(!!producer&&(await producer(serviceToken)).scopes.has('wealth:ingest'),
  'Real signed service-only Keycloak audience and scope verified');
 try{await createOidcVerifier(config)(serviceToken);throw Error('Service accepted as human')}
 catch(e){check(e instanceof Error&&e.message!=='Service accepted as human',
  'Cross-audience service token refused as user');}
 const health=await apiFetch('/health',{tenantId:String(local.tenantId)});
 check(health.status===200&&health.body.status==='ok','HTTP liveness');
 const ready=await apiFetch('/ready',{tenantId:String(local.tenantId)});
 check(ready.status===200&&ready.body.status==='ready'&&ready.body.database==='migrated',
  'Existing PostgreSQL ready with all five migrations');
 const anonymous=await apiFetch('/api/v1/wealth/goals');
 check(anonymous.status===401,'Anonymous protected API denied');
 const crossToken=await apiFetch('/api/v1/wealth/goals',{token:serviceToken});
 check(crossToken.status===401,'Service JWT rejected by protected human API');
 const wrongTenant=await apiFetch('/api/v1/wealth/goals',{token:humanToken,tenantId:randomUUID()});
 check(wrongTenant.status===403,'Cross-tenant access denied by membership');
 const caps=await apiFetch('/api/v1/wealth/capabilities',{token:humanToken});
 check(caps.status===200&&caps.body.financialExecutionEnabled===false,
  'Verified tenant and execution-disabled capabilities');
 const profileGet=await apiFetch('/api/v1/wealth/profile',{token:humanToken});
 check([200,404].includes(profileGet.status),'Local wealth profile read');
 const put=await apiFetch('/api/v1/wealth/profile',{method:'PUT',token:humanToken,
  version:profileGet.status===200?String(data(profileGet).version):'0',
  key:randomUUID(),body:{baseCurrency:'KES',wealthStage:'BUILDING',
   strategyNote:'LOCAL TEST ONLY — never an actual verified wealth record.'}});
 check([200,201].includes(put.status),'Durable profile create/update');
 const readBack=await apiFetch('/api/v1/wealth/profile',{token:humanToken});
 check(readBack.status===200&&data(readBack).wealthStage==='BUILDING',
  'PostgreSQL profile persisted across API requests');
 const goalPayload={title:'LOCAL TEST '+randomUUID().slice(0,8),metric:'NET_WORTH',
  targetAmount:'1000000.0000',targetDate:'2035-12-31',priority:'LOW'};
 const goalKey=randomUUID();
 const goal=()=>apiFetch('/api/v1/wealth/goals',{
  method:'POST',token:humanToken,key:goalKey,body:goalPayload});
 const created=await goal();
 check(created.status===201&&typeof data(created).id==='string','Durable goal created');
 const replay=await goal();
 check(replay.status===201&&data(replay).id===data(created).id,
  'Idempotent goal command');
 const goalId=String(data(created).id);
 const milestone=await apiFetch('/api/v1/wealth/goals/'+goalId+'/milestones',{
  method:'POST',token:humanToken,key:randomUUID(),
  body:{title:'Local milestone',targetAmount:'250000.0000',dueDate:'2031-12-31'}});
 check(milestone.status===201,'Durable milestone created');
 const strategy=await apiFetch('/api/v1/wealth/strategies',{
  method:'POST',token:humanToken,key:randomUUID(),
  body:{goalId,name:'LOCAL TEST — no financial execution',
   thesis:'Testing strategy workflow only',
   allocationTargets:[{label:'Research scenario',basisPoints:10000}],
   assumptions:{riskTolerance:'BALANCED',horizonYears:5,assumedAnnualReturnPct:5}}});
 check(strategy.status===201,'Versioned planning strategy persisted');
 const actualState=await apiFetch('/api/v1/wealth/state',{token:humanToken});
 check(actualState.status===200&&data(actualState).status==='INCOMPLETE'&&
  data(actualState).netWorth===null,
  'No fictitious net worth without trusted source consents');
 const statuses=await apiFetch('/api/v1/wealth/sources/status',{token:humanToken});
 check(statuses.status===200&&Array.isArray(statuses.body.data)&&
  (statuses.body.data as Json[]).every(v=>v.status!=='CURRENT'),
  'Unprovisioned Finance/Asset/Company providers correctly unavailable');
 const invalidSource=await apiFetch('/api/v1/integrations/sources/finance/snapshots',{
  method:'POST',token:serviceToken,body:{schemaVersion:1}});
 check(invalidSource.status===400,'Incomplete provider payload rejected');
 process.stdout.write(JSON.stringify({
  phase:'L1',result:'LOCAL_TEST_CERTIFIED',tests:tasks.length,
  testIdentityOnly:true,localPostgreSQLReady:true,realKeycloakSignedTokens:true,
  personalKernelFederationVerified:false,realProviderFeedsActive:false,
  productionReady:false,financialExecutionEnabled:false,
  checks:tasks},null,2)+'\n');
}catch(error){
 // Avoid echoing tokens or response bodies.
 process.stderr.write('LOCAL_CERTIFICATION_FAILED: '+
  (error instanceof Error?error.message.slice(0,250):'Unknown error')+'\n');
 process.exitCode=1;
}
