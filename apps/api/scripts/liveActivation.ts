/**
 * B3.1 — operator-only live authenticated test-tenant certification.
 * This WILL post signed source snapshots to a pre-provisioned isolated staging tenant.
 * Never run against a production or shared personal tenant.
 * Requires freshly minted ephemeral JWTs in environment variables (no token logging).
 */
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {sourceSnapshot} from '../src/b2/sourceContracts.js';
import type {SourceSystem} from '../src/b2/sourceContracts.js';
import {verifySourceEvidence} from '../src/b3/providerEvidence.js';
import {activationGate,parseActivationConfig,validateExternalJwt} from '../src/b31/activationContract.js';

type Json=Record<string,unknown>;
const checkedAt=new Date().toISOString(),steps:string[]=[];
const safeFetch=async(url:string,init:RequestInit={})=>{
 const u=new URL(url);
 if(u.protocol!=='https:')throw Error('HTTPS required for live test.');
 const response=await fetch(u,{...init,redirect:'error',signal:AbortSignal.timeout(12000)});
 let body:Json={};
 try{body=await response.json() as Json}catch{ /* HTTP status still enforced */ }
 return {status:response.status,body};
};
function expectStatus(status:number,expected:number[],step:string){
 if(!expected.includes(status))throw Error('BLOCKED: '+step+' returned unexpected HTTP status '+status);
 steps.push(step+': PASS');
}
const url=(origin:string,path:string)=>new URL(path,origin).toString();
const authHeaders=(jwt:string,tenantId:string)=>({
 'Authorization':'Bearer '+jwt,'X-Wealth-Tenant-Id':tenantId,'Accept':'application/json'
});
const jsonData=(body:Json)=>body.data as Json|undefined;
try{
 const c=parseActivationConfig(process.env);
 const origin=new URL(c.STAGING_API_URL).origin;
 await validateExternalJwt(c.STAGING_TEST_HUMAN_TOKEN,c.OIDC_ISSUER,c.OIDC_JWKS_URL,
  c.OIDC_AUDIENCE,'human',c.OIDC_REQUIRED_ACR);
 const service:Record<SourceSystem,string>={
  'Finance OS':c.STAGING_FINANCE_SERVICE_TOKEN,
  'Asset OS':c.STAGING_ASSET_SERVICE_TOKEN,
  'Company OS':c.STAGING_COMPANY_SERVICE_TOKEN
 };
 for(const name of Object.keys(service) as SourceSystem[]){
  await validateExternalJwt(service[name],c.INTEGRATION_OIDC_ISSUER,c.INTEGRATION_OIDC_JWKS_URL,
   c.INTEGRATION_OIDC_AUDIENCE,'producer');
 }
 steps.push('JWT signatures, audiences, scopes, fresh MFA and source-service separation: PASS');
 const ready=await safeFetch(url(origin,'/ready'));
 expectStatus(ready.status,[200],'Migrated database ready');
 if(ready.body.status!=='ready'||ready.body.stage!=='B3')
  throw Error('BLOCKED: staging API readiness is not at expected B3 schema.');
 const caps=await safeFetch(url(origin,'/api/v1/wealth/capabilities'),{
  headers:authHeaders(c.STAGING_TEST_HUMAN_TOKEN,c.STAGING_TEST_TENANT_ID)
 });
 expectStatus(caps.status,[200],'Verified human tenant access');
 if(jsonData(caps.body)?.financialExecutionEnabled!==false)
  throw Error('BLOCKED: Wealth OS unexpectedly reports money execution enabled.');
 const unauth=await safeFetch(url(origin,'/api/v1/wealth/goals'),{
  headers:{'X-Wealth-Tenant-Id':c.STAGING_TEST_TENANT_ID}
 });
 expectStatus(unauth.status,[401],'Unauthenticated request rejected');
 const wrongAudience=await safeFetch(url(origin,'/api/v1/wealth/goals'),{
  headers:authHeaders(c.STAGING_FINANCE_SERVICE_TOKEN,c.STAGING_TEST_TENANT_ID)
 });
 expectStatus(wrongAudience.status,[401],'Service token refused as a human');
 const wrongTenant=randomUUID();
 const cross=await safeFetch(url(origin,'/api/v1/wealth/goals'),{
  headers:authHeaders(c.STAGING_TEST_HUMAN_TOKEN,wrongTenant)
 });
 expectStatus(cross.status,[403],'Unbound tenant rejected');
 const files:Record<SourceSystem,string>={
  'Finance OS':c.STAGING_FINANCE_SNAPSHOT_FILE,
  'Asset OS':c.STAGING_ASSET_SNAPSHOT_FILE,
  'Company OS':c.STAGING_COMPANY_SNAPSHOT_FILE
 };
 // Read and validate ALL three protected snapshots BEFORE writing any staging state.
 const snapshots:Partial<Record<SourceSystem,ReturnType<typeof sourceSnapshot.parse>>>={};
 for(const source of Object.keys(service) as SourceSystem[]){
  const path=files[source];
  if(path.startsWith('/srv/wealth-os/staging/source')||path.includes('node_modules')||path.endsWith('.example'))
   throw Error('BLOCKED: source fixtures must be stored outside checkout and must not be example files.');
  const file=await readFile(path,'utf8');
  if(file.length>600000)throw Error('BLOCKED: source fixture exceeds permitted size.');
  const parsed=sourceSnapshot.parse(JSON.parse(file) as unknown);
  if(parsed.sourceSystem!==source)throw Error('BLOCKED: source snapshot type disagrees with issuer token.');
  verifySourceEvidence(parsed,true);
  snapshots[source]=parsed;
 }
 steps.push('Three source-owned, evidence-complete snapshot envelopes: VALIDATED');
 for(const source of Object.keys(service) as SourceSystem[]){
  const slug={'Finance OS':'finance','Asset OS':'asset','Company OS':'company'}[source];
  const snapshot=snapshots[source]!;
  const path='/api/v1/integrations/sources/'+slug+'/snapshots';
  const submit=()=>safeFetch(url(origin,path),{
   method:'POST',
   headers:{...authHeaders(service[source],c.STAGING_TEST_TENANT_ID),'Content-Type':'application/json'},
   body:JSON.stringify(snapshot)
  });
  const accepted=await submit();
  expectStatus(accepted.status,[200,201],source+' signed snapshot accepted or replayed');
  if(!['APPLIED','ALREADY_APPLIED'].includes(String(jsonData(accepted.body)?.status)))
   throw Error('BLOCKED: source receipt lacks correct applied/replay status.');
  const replay=await submit();
  expectStatus(replay.status,[200],source+' duplicate rejected from reapplying writes');
  if(jsonData(replay.body)?.status!=='ALREADY_APPLIED')
   throw Error('BLOCKED: identical source event replay was not idempotent.');
 }
 const stat=await safeFetch(url(origin,'/api/v1/wealth/sources/status'),{
  headers:authHeaders(c.STAGING_TEST_HUMAN_TOKEN,c.STAGING_TEST_TENANT_ID)
 });
 expectStatus(stat.status,[200],'Authenticated source binding statuses');
 const state=await safeFetch(url(origin,'/api/v1/wealth/state'),{
  headers:authHeaders(c.STAGING_TEST_HUMAN_TOKEN,c.STAGING_TEST_TENANT_ID)
 });
 expectStatus(state.status,[200],'Authenticated source-reconciled wealth state');
 activationGate(jsonData(stat.body) as never,jsonData(state.body) as never);
 steps.push('Three current consented source receipts; reconciled projection without execution: PASS');
 const report={phase:'B3.1',gate:'SIGNED_TEST_TENANT_INTEGRATION_PROOF',
  result:'STAGING_TEST_TENANT_CERTIFIED',checkedAt,
  upstreamProductionProvidersVerified:false,
  realUserMfaEnrollmentAndRecoveryVerified:false,
  liveHumanKernelFederationVerified:false,
  sourceFinancialEvidenceIndependentlyAudited:false,
  financialExecutionEnabled:false,
  steps};
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
}catch(error){
 const reason=error instanceof Error?error.message:'Unknown failure';
 // NEVER print source payloads, identity token contents or remote provider response bodies.
 process.stderr.write('B3.1 BLOCKED: '+(reason.startsWith('BLOCKED:')?reason.slice(8):'Staging test failed. Check operator logs without exposing credentials.')+'\n');
 process.exitCode=1;
}
