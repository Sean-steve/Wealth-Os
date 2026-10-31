import {z} from 'zod';

const httpsUrl=z.string().url().refine(v=>v.startsWith('https://'), 'OIDC metadata must use HTTPS');
const configSchema=z.object({
 WEALTH_APP_DATABASE_URL:z.string().min(1),
 WEALTH_INGEST_DATABASE_URL:z.string().min(1).optional(),
 INTEGRATION_OIDC_ISSUER:httpsUrl.optional(),
 INTEGRATION_OIDC_JWKS_URL:httpsUrl.optional(),
 INTEGRATION_OIDC_AUDIENCE:z.string().min(3).max(200).optional(),
 OIDC_ISSUER:httpsUrl,
 OIDC_AUDIENCE:z.string().min(1).max(200),
 OIDC_JWKS_URL:httpsUrl,
 RUNTIME_MODE:z.enum(['development','staging','production']).default('development'),
 OIDC_REQUIRED_ACR:z.string().min(3).max(160).optional(),
 OIDC_MAX_AUTH_AGE_SECONDS:z.coerce.number().int().min(60).max(3600).default(900),
 OIDC_REQUIRE_VERIFIED_EMAIL:z.enum(['true','false']).default('false'),
 CORS_ALLOWED_ORIGINS:z.string().default(''),
 HOST:z.string().default('127.0.0.1'),
 PORT:z.coerce.number().int().min(1).max(65535).default(3009)
});
export type ApiConfig=z.infer<typeof configSchema>;
export function loadConfig(env:NodeJS.ProcessEnv=process.env):ApiConfig {
 const result=configSchema.safeParse(env);
 if(!result.success){
  throw new Error('Wealth OS API is not configured: require DB URL and trusted HTTPS OIDC issuer, audience, JWKS URL.');
 }
 const config=result.data;
 if(config.RUNTIME_MODE!=='development'){
  if(!config.OIDC_REQUIRED_ACR||config.OIDC_REQUIRE_VERIFIED_EMAIL!=='true')
   throw new Error('Staging/production must enforce verified email and a pinned provider-proven MFA ACR.');
  if(!config.WEALTH_INGEST_DATABASE_URL||!config.INTEGRATION_OIDC_ISSUER||
   !config.INTEGRATION_OIDC_JWKS_URL||!config.INTEGRATION_OIDC_AUDIENCE)
   throw new Error('Staging requires a distinct source-service OIDC trust and restricted ingestion database.');
 }

 const sourceFields=[config.WEALTH_INGEST_DATABASE_URL,config.INTEGRATION_OIDC_ISSUER,
  config.INTEGRATION_OIDC_JWKS_URL,config.INTEGRATION_OIDC_AUDIENCE];
 if(sourceFields.some(Boolean)&&sourceFields.some(v=>!v))
  throw new Error('B2 source gateway requires all of WEALTH_INGEST_DATABASE_URL and INTEGRATION_OIDC issuer/JWKS/audience; partial configuration is prohibited.');
 if(new URL(config.OIDC_ISSUER).origin!==new URL(config.OIDC_JWKS_URL).origin)throw new Error('User OIDC issuer/JWKS must share a pinned origin.');
 if(config.INTEGRATION_OIDC_ISSUER&&config.INTEGRATION_OIDC_JWKS_URL&&
 new URL(config.INTEGRATION_OIDC_ISSUER).origin!==new URL(config.INTEGRATION_OIDC_JWKS_URL).origin)
 throw new Error('Source OIDC issuer/JWKS must share a pinned origin.');
 if(config.INTEGRATION_OIDC_ISSUER&&(new URL(config.INTEGRATION_OIDC_ISSUER).username||
  new URL(config.INTEGRATION_OIDC_JWKS_URL!).username||
  new URL(config.INTEGRATION_OIDC_JWKS_URL!).password))
  throw new Error('Source OIDC metadata URLs must not include credentials.');
 if(new URL(config.OIDC_ISSUER).username||new URL(config.OIDC_JWKS_URL).username){
  throw new Error('OIDC URLs must not embed authentication credentials.');
 }
 for(const origin of config.CORS_ALLOWED_ORIGINS.split(',').map(x=>x.trim()).filter(Boolean)){
  let url:URL;
  try{url=new URL(origin)}catch{throw new Error('Invalid CORS origin.')}
  if(url.origin!==origin||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1'].includes(url.hostname))
   throw new Error('CORS origins must be exact HTTPS origins, or HTTP localhost for development.');
 }
 return config;
}
