import {createRemoteJWKSet,jwtVerify} from 'jose';
import type {ApiConfig} from './env.js';
import {fail} from './errors.js';

export interface Principal {subject:string;scopes:ReadonlySet<string>;issuer:string}
export type VerifyBearer=(token:string)=>Promise<Principal>;
export function createOidcVerifier(config:ApiConfig):VerifyBearer{
 const jwks=createRemoteJWKSet(new URL(config.OIDC_JWKS_URL),{timeoutDuration:5000,cooldownDuration:30000});
 return async token=>{
  try {
   const {payload}=await jwtVerify(token,jwks,{
    issuer:config.OIDC_ISSUER,audience:config.OIDC_AUDIENCE,
    algorithms:['RS256','ES256'],clockTolerance:5,maxTokenAge:'60m'
   });
   if(!payload.sub||!payload.iat||!payload.exp||payload.sub.length>255)fail(401,'INVALID_TOKEN','Access token lacks required identity or lifetime claims.');
   const scopeClaim=payload.scope;
   const scp=payload.scp;
   const strings=typeof scopeClaim==='string'?scopeClaim.split(/\s+/):Array.isArray(scp)?scp.filter(x=>typeof x==='string'):[];
   return {subject:payload.sub,scopes:new Set(strings),issuer:payload.iss??config.OIDC_ISSUER};
  }catch {
   fail(401,'INVALID_TOKEN','The bearer token could not be verified.');
  }
 };
}
export function hasScope(principal:Principal,scope:'wealth:read'|'wealth:write'){
 return principal.scopes.has(scope)||(scope==='wealth:read'&&principal.scopes.has('wealth:write'));
}
