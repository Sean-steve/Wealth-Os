import {z} from 'zod';

const httpsUrl=z.string().url().refine(v=>v.startsWith('https://'), 'OIDC metadata must use HTTPS');
const configSchema=z.object({
 WEALTH_APP_DATABASE_URL:z.string().min(1),
 OIDC_ISSUER:httpsUrl,
 OIDC_AUDIENCE:z.string().min(1).max(200),
 OIDC_JWKS_URL:httpsUrl,
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
