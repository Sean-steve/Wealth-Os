/**
 * Staging operator preflight. Verifies REAL reachable HTTPS discovery/health endpoints.
 * Never accepts placeholder domains or saves bearer tokens. No token issuance or user enrollment.
 */
import {z} from 'zod';
const env=z.object({
 STAGING_API_URL:z.string().url(),
 OIDC_ISSUER:z.string().url(),OIDC_JWKS_URL:z.string().url(),
 INTEGRATION_OIDC_ISSUER:z.string().url(),INTEGRATION_OIDC_JWKS_URL:z.string().url(),
 FINANCE_OS_API_URL:z.string().url(),ASSET_OS_API_URL:z.string().url(),
 COMPANY_OS_API_URL:z.string().url()
}).safeParse(process.env);
const checks:{name:string;passed:boolean;reason:string}[]=[];
const check=(name:string,passed:boolean,reason:string)=>{
 checks.push({name,passed,reason});
};
const safe=(raw:string)=> {
 const u=new URL(raw);
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||
 u.port&&u.port!=='443'||!u.hostname.includes('.')||
 u.hostname.endsWith('.example.test')||u.hostname.endsWith('.example.com')||
 u.hostname.endsWith('.invalid')||u.hostname==='localhost'||u.hostname.endsWith('.local'))
  throw Error('Private/local, placeholder, non-TLS or credential-bearing endpoint is not a live staging endpoint.');
 return u;
};
const fetchJson=async(url:string)=>{
 const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(7000),
  headers:{accept:'application/json'},cache:'no-store'});
 if(!r.ok)throw Error('Endpoint returned HTTP '+r.status);
 const body=await r.text();
 if(body.length>65536)throw Error('Response exceeds safe metadata size.');
 return JSON.parse(body) as Record<string,unknown>;
};
if(!env.success){
 for(const name of Object.keys(env.error.flatten().fieldErrors))
  check(name,false,'Missing or invalid required staging provider endpoint.');
}else{
 const cfg=env.data;
 const pairs=[
  {name:'Human OIDC',issuer:cfg.OIDC_ISSUER,jwks:cfg.OIDC_JWKS_URL},
  {name:'Source-service OIDC',issuer:cfg.INTEGRATION_OIDC_ISSUER,jwks:cfg.INTEGRATION_OIDC_JWKS_URL}
 ];
 for(const pair of pairs){
  try{
   const issuer=safe(pair.issuer),jwks=safe(pair.jwks);
   if(issuer.origin!==jwks.origin)throw Error('JWKS must share the pinned issuer origin.');
   const metadata=await fetchJson(issuer.href.replace(/\/$/,'')+'/.well-known/openid-configuration');
   if(metadata.issuer!==issuer.href)throw Error('OIDC discovered issuer differs from pinned issuer.');
   if(metadata.jwks_uri!==jwks.href)throw Error('OIDC JWKS differs from pinned URL.');
   if(!(metadata.response_types_supported as unknown[])?.includes('code')||
    !(metadata.code_challenge_methods_supported as unknown[])?.includes('S256'))
    throw Error('OIDC does not advertise Authorization Code + PKCE S256.');
   const keys=await fetchJson(jwks.href);
   if(!Array.isArray(keys.keys)||keys.keys.length===0||keys.keys.length>40)
    throw Error('OIDC signature keys missing/invalid.');
   check(pair.name,true,'Live HTTPS issuer discovery, PKCE and JWKS reachable; no login or MFA proof implied.');
  }catch(error){check(pair.name,false,error instanceof Error?error.message:'Unknown provider error.');}
 }
 for(const [name,raw,path] of [
  ['Wealth Staging API',cfg.STAGING_API_URL,'/ready'],
  ['Finance OS',cfg.FINANCE_OS_API_URL,'/health/ready'],
  ['Asset OS',cfg.ASSET_OS_API_URL,'/health/ready'],
  ['Company OS',cfg.COMPANY_OS_API_URL,'/health/ready']
 ] as const){
  try{
   const u=safe(raw),health=new URL(path,u.origin);
   const body=await fetchJson(health.href);
   const live=JSON.stringify(body);
   if(/"status":"(?:unavailable|error|offline)"/i.test(live))throw Error('Provider reports unavailable.');
   check(name,true,'HTTPS readiness endpoint reachable; credentials and domain ownership still require UAT.');
  }catch(error){check(name,false,error instanceof Error?error.message:'Unknown provider error.');}
 }
}
const result=checks.length===6&&checks.every(x=>x.passed)?'PREFLIGHT_ENDPOINTS_REACHABLE':'BLOCKED';
const report={phase:'B3',result,checks,
 disclaimer:'Endpoint reachability is NOT proof of production identity, MFA, source ownership, completeness or consent.',
 checkedAt:new Date().toISOString()};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(result==='BLOCKED')process.exitCode=1;
