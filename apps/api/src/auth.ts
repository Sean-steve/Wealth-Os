import {createRemoteJWKSet,jwtVerify} from 'jose';
import type {ApiConfig} from './env.js';
import {fail} from './errors.js';

export interface Principal {subject:string;scopes:ReadonlySet<string>;issuer:string}
export type VerifyBearer=(token:string)=>Promise<Principal>;
export function enforceOidcAssurance(payload:{
 acr?:unknown;auth_time?:unknown;email_verified?:unknown
 },config:Pick<ApiConfig,'OIDC_REQUIRED_ACR'|'OIDC_MAX_AUTH_AGE_SECONDS'|'OIDC_REQUIRE_VERIFIED_EMAIL'>,nowSeconds=Math.floor(Date.now()/1000)){
 if(config.OIDC_REQUIRED_ACR){
  if(payload.acr!==config.OIDC_REQUIRED_ACR)fail(403,'MFA_ASSURANCE_REQUIRED','The trusted identity issuer did not assert the required MFA assurance.');
  if(typeof payload.auth_time!=='number'||!Number.isInteger(payload.auth_time)||
   payload.auth_time>nowSeconds+5||nowSeconds-payload.auth_time>config.OIDC_MAX_AUTH_AGE_SECONDS)
   fail(403,'REAUTHENTICATION_REQUIRED','A fresh MFA authentication is required.');
 }
 if(config.OIDC_REQUIRE_VERIFIED_EMAIL==='true'&&payload.email_verified!==true)
  fail(403,'VERIFIED_EMAIL_REQUIRED','The issuer must verify the user's email before Wealth OS access.');
}

export function createOidcVerifier(config:ApiConfig):VerifyBearer{
 const jwks=createRemoteJWKSet(new URL(config.OIDC_JWKS_URL),{timeoutDuration:5000,cooldownDuration:30000});
 return async token=>{
  try {
   const {payload}=await jwtVerify(token,jwks,{
    issuer:config.OIDC_ISSUER,audience:config.OIDC_AUDIENCE,
    algorithms:['RS256','ES256'],clockTolerance:5,maxTokenAge:'60m'
   });
   if(!payload.sub||!payload.iat||!payload.exp||payload.sub.length>255)fail(401,'INVALID_TOKEN','Access token lacks required identity or lifetime claims.');
   enforceOidcAssurance(payload,config);
   const scopeClaim=payload.scope;
   const scp=payload.scp;
   const strings=typeof scopeClaim==='string'?scopeClaim.split(/\s+/):Array.isArray(scp)?scp.filter(x=>typeof x==='string'):[];
   return {subject:payload.sub,scopes:new Set(strings),issuer:payload.iss??config.OIDC_ISSUER};
  }catch(error) {
   if(error instanceof Error&&'status' in error)throw error;
   fail(401,'INVALID_TOKEN','The bearer token could not be verified.');
  }
 };
}
export function hasScope(principal:Principal,scope:'wealth:read'|'wealth:write'){
 return principal.scopes.has(scope)||(scope==='wealth:read'&&principal.scopes.has('wealth:write'));
}
