import {z} from 'zod';
import {createRemoteJWKSet,jwtVerify} from 'jose';

const https=z.string().url().refine(v=>{
 try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.port===''}catch{return false}
},'A public HTTPS URL without credentials/query/fragment is required.');
const token=z.string().min(50).max(12000);
const schema=z.object({
 STAGING_API_URL:https,
 STAGING_TEST_TENANT_ID:z.string().uuid(),
 STAGING_TEST_HUMAN_TOKEN:token,
 OIDC_ISSUER:https,OIDC_JWKS_URL:https,OIDC_AUDIENCE:z.string().min(1),
 OIDC_REQUIRED_ACR:z.string().min(3),
 STAGING_FINANCE_SERVICE_TOKEN:token,
 STAGING_ASSET_SERVICE_TOKEN:token,
 STAGING_COMPANY_SERVICE_TOKEN:token,
 INTEGRATION_OIDC_ISSUER:https,INTEGRATION_OIDC_JWKS_URL:https,
 INTEGRATION_OIDC_AUDIENCE:z.string().min(1),
 STAGING_FINANCE_SNAPSHOT_FILE:z.string().min(1),
 STAGING_ASSET_SNAPSHOT_FILE:z.string().min(1),
 STAGING_COMPANY_SNAPSHOT_FILE:z.string().min(1),
 WEALTH_ACTIVATION_APPLY_SNAPSHOTS:z.literal('yes'),
 WEALTH_TEST_TENANT_ISOLATED:z.literal('yes')
});
export type StagingActivationConfig=z.infer<typeof schema>;
export const parseActivationConfig=(env:Record<string,string|undefined>):StagingActivationConfig=>{
 const parsed=schema.safeParse(env);
 if(!parsed.success){
  throw new Error('BLOCKED: staging test-tenant approval, all provider tokens/fixtures, pinned OIDC metadata and explicit apply flags are required. Invalid/missing settings: '+parsed.error.issues.map(x=>x.path.join('.')).join(', '));
 }
 const c=parsed.data;
 const host=new URL(c.STAGING_API_URL);
 if(host.pathname!=='/'&&host.pathname!=='')throw new Error('BLOCKED: staging API must be an HTTPS origin, not an arbitrary path.');
if(new URL(c.OIDC_ISSUER).origin!==new URL(c.OIDC_JWKS_URL).origin ||
    new URL(c.INTEGRATION_OIDC_ISSUER).origin!==new URL(c.INTEGRATION_OIDC_JWKS_URL).origin)
  throw new Error('BLOCKED: unpinned OIDC JWKS origin.');
 if(new URL(c.OIDC_ISSUER).host===host.host)throw new Error('BLOCKED: test issuer must be hosted independently from the Wealth API.');
 return c;
};
export type VerifiedToken={subject:string;issuer:string;scopes:ReadonlySet<string>};
const claimScopes=(value:unknown):Set<string>=>new Set(typeof value==='string'?value.split(/\s+/).filter(Boolean):[]);
export async function validateExternalJwt(tokenValue:string,issuer:string,jwksUrl:string,audience:string,mode:'human'|'producer',acr?:string):Promise<VerifiedToken>{
 const jwks=createRemoteJWKSet(new URL(jwksUrl),{timeoutDuration:8000,cooldownDuration:30000});
 const {payload}=await jwtVerify(tokenValue,jwks,{
  issuer,audience,algorithms:['RS256','ES256'],clockTolerance:5,
  maxTokenAge:mode==='producer'?'5m':'60m',requiredClaims:['sub','iat','exp']
 });
 const scopes=claimScopes(payload.scope);
 if(!payload.sub)throw new Error('BLOCKED: verified JWT omitted subject.');
 if(mode==='human'){
  if(!scopes.has('wealth:read')||!scopes.has('wealth:write'))throw new Error('BLOCKED: human JWT lacks wealth scopes.');
  if(payload.acr!==acr||payload.email_verified!==true||
    typeof payload.auth_time!=='number'||Date.now()/1000-payload.auth_time>900||
    payload.auth_time>Date.now()/1000+5)
   throw new Error('BLOCKED: verified human JWT lacks current MFA, verified email or fresh auth_time.');
 }else if(!scopes.has('wealth:ingest'))throw new Error('BLOCKED: source token lacks ingest scope.');
 return {subject:payload.sub,issuer:payload.iss??issuer,scopes};
}
export function activationGate(statuses:ReadonlyArray<{sourceSystem:string;status:string;consented:boolean;authorizedProducerBound:boolean}>,
 state:{status:string;netWorth:unknown;financialExecutionEnabled:unknown;blockers?:string[]}):void{
 const names=['Finance OS','Asset OS','Company OS'];
 if(statuses.length!==3||names.some(name=>!statuses.some(s=>s.sourceSystem===name&&s.status==='CURRENT'&&s.consented===true&&s.authorizedProducerBound===true)))
  throw new Error('BLOCKED: not all three source publishers have current consented, verified snapshots.');
 if(state.financialExecutionEnabled!==false||state.status!=='RECONCILED_SOURCE_PROJECTION'||
   typeof state.netWorth!=='string'||!/^-?\d+(?:\.\d{1,4})?$/.test(state.netWorth)||
   state.blockers?.length)
  throw new Error('BLOCKED: Wealth State is incomplete, fabricated or claims unauthorized financial execution.');
}
