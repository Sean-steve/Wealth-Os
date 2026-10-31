import {z} from 'zod';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import type {ApiConfig} from '../env.js';
import {fail} from '../errors.js';

export const sources=['Finance OS','Asset OS','Company OS'] as const;
export type SourceSystem=typeof sources[number];
export interface ProducerIdentity {issuer:string;subject:string;scopes:ReadonlySet<string>}
export type VerifyProducer=(token:string)=>Promise<ProducerIdentity>;
const uuid=z.string().uuid();
const currency=z.literal('KES'); // no silent/invented FX translation.
const amount=z.string().regex(/^(0|[1-9]\d{0,15})(\.\d{1,4})?$/);
const fraction=z.string().regex(/^(0(\.\d{1,6})?|1(\.0{1,6})?)$/)
 .refine(x=>Number(x)>0);
const instant=z.string().datetime({offset:true});
const version=z.string().min(1).max(150);
const originRef=z.string().min(3).max(180).regex(/^[a-zA-Z0-9._:\/-]+$/);
const evidence=z.record(z.string(),z.union([z.string().max(300),z.number(),z.boolean(),z.null()]))
 .refine(x=>Object.keys(x).length<=12,'Too many evidence properties');
export const holding=z.object({
 sourceEntityType:z.string().min(1).max(100),sourceEntityId:originRef,
 canonicalAssetRef:originRef,category:z.enum(['BUSINESS_EQUITY','PROPERTY','INVESTMENTS','CASH','OTHER']),
 ownerFraction:fraction,valuationAmount:amount,valuationCurrency:currency,
 valuationAsOf:instant,valuationMethod:z.string().min(3).max(160),
 sourceVersion:version,qualityStatus:z.enum(['VERIFIED','ESTIMATED','STALE','UNVERIFIED']),
 provenance:evidence
}).strict();
export const income=z.object({
 sourceEntityId:originRef,monthlyAmount:amount,currency,
 passive:z.boolean(),sourceAsOf:instant,provenance:evidence
}).strict();
export const liability=z.object({
 sourceEntityId:originRef,outstandingAmount:amount,currency,
 sourceAsOf:instant,provenance:evidence
}).strict();
export const capitalPool=z.object({
 sourceEntityRef:originRef,name:z.string().min(1).max(150),
 purpose:z.string().min(3).max(300),classifiedCash:amount,
 reservedCash:amount,committedCash:amount,sourceAsOf:instant
}).strict().refine(x=>{
 const units=(s:string)=>{const [w,f='']=s.split('.');return BigInt(w)*10000n+BigInt(f.padEnd(4,'0'))};
 return units(x.reservedCash)+units(x.committedCash)<=units(x.classifiedCash);
},'Finance OS reserves and commitments cannot exceed classified cash.');
export const sourceSnapshot=z.object({
 schemaVersion:z.literal(1),
 eventId:uuid,sourceSystem:z.enum(sources),sourceRevision:version,asOf:instant,
 personRef:originRef,
 complete:z.literal(true),
 holdings:z.array(holding).max(250).default([]),
 incomes:z.array(income).max(250).default([]),
 liabilities:z.array(liability).max(250).default([]),
 capitalPools:z.array(capitalPool).max(100).default([]),
 completenessEvidence:z.object({
 coverage:z.enum(['ALL','PARTIAL']),
 sourceRecordCount:z.number().int().min(0).max(1000000),
 attestation:z.string().min(15).max(500)
 }).strict()
}).strict().superRefine((snapshot,ctx)=>{
 const source=snapshot.sourceSystem;
 const actualCount=snapshot.holdings.length+snapshot.incomes.length+
  snapshot.liabilities.length+snapshot.capitalPools.length;
 if(snapshot.completenessEvidence.sourceRecordCount!==actualCount)
  ctx.addIssue({code:'custom',message:'Source completeness record count does not match the provided projections.'});
 if(snapshot.completenessEvidence.coverage!=='ALL'){
  ctx.addIssue({code:'custom',message:'Only full, source-attested snapshots are accepted.',path:['completenessEvidence','coverage']});
 }
 if(source!=='Finance OS'&&(snapshot.liabilities.length||snapshot.capitalPools.length))
  ctx.addIssue({code:'custom',message:'Only Finance OS may supply liability/cash classification truth.'});
 for(const h of snapshot.holdings){
  const permitted=source==='Finance OS'?['CASH','INVESTMENTS']:
    source==='Asset OS'?['PROPERTY','OTHER']:['BUSINESS_EQUITY'];
  if(!permitted.includes(h.category))
   ctx.addIssue({code:'custom',message:'Holding category is not owned by this source.',path:['holdings']});
 }
 if(new Set(snapshot.holdings.map(x=>x.canonicalAssetRef)).size!==snapshot.holdings.length)
  ctx.addIssue({code:'custom',message:'Duplicate canonical economic asset in source snapshot.'});
 const unique=<T>(rows:T[],key:(x:T)=>string)=>new Set(rows.map(key)).size===rows.length;
 if(!unique(snapshot.holdings,h=>h.sourceEntityType+':'+h.sourceEntityId)||
 !unique(snapshot.incomes,x=>x.sourceEntityId)||
 !unique(snapshot.liabilities,x=>x.sourceEntityId)||
 !unique(snapshot.capitalPools,x=>x.sourceEntityRef))
  ctx.addIssue({code:'custom',message:'Source record identifiers must be unique within each projection.'});
});
export type SourceSnapshot=z.infer<typeof sourceSnapshot>;

export function createProducerVerifier(config:ApiConfig):VerifyProducer|null{
 if(!config.INTEGRATION_OIDC_AUDIENCE||!config.INTEGRATION_OIDC_ISSUER||!config.INTEGRATION_OIDC_JWKS_URL)return null;
 const jwks=createRemoteJWKSet(new URL(config.INTEGRATION_OIDC_JWKS_URL),{timeoutDuration:5000,cooldownDuration:30000});
 return async token=>{
  try{
   const {payload}=await jwtVerify(token,jwks,{
    issuer:config.INTEGRATION_OIDC_ISSUER,audience:config.INTEGRATION_OIDC_AUDIENCE,
    algorithms:['RS256','ES256'],clockTolerance:5,maxTokenAge:'5m',
    requiredClaims:['sub','iat','exp']
   });
   if(!payload.sub||payload.sub.length>255||typeof payload.iat!=='number'||typeof payload.exp!=='number')
    fail(401,'INVALID_PRODUCER','Missing source service identity and short-lived token claims.');
   const scopes=typeof payload.scope==='string'?payload.scope.split(/\s+/):[];
   if(!scopes.includes('wealth:ingest'))fail(403,'SOURCE_SCOPE_DENIED','Source token lacks wealth:ingest scope.');
   return {issuer:payload.iss??config.INTEGRATION_OIDC_ISSUER!,subject:payload.sub,scopes:new Set(scopes)};
  }catch(error){
   if(error instanceof Error&&'status' in error)throw error;
   fail(401,'INVALID_PRODUCER','Source service signature, issuer, audience or expiry is invalid.');
  }
 };
}
