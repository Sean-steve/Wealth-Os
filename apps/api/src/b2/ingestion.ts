import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Pool} from 'pg';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ApiFailure,fail} from '../errors.js';
import {sourceSnapshot} from './sourceContracts.js';
import type {VerifyProducer,SourceSystem,ProducerIdentity,SourceSnapshot} from './sourceContracts.js';

export interface SourceServices {pool?:Pool;verifyProducer?:VerifyProducer|null}
const tenantIdSchema=z.string().uuid();
const sourcePath=z.enum(['finance','asset','company']);
const decodeSource=(name:string):SourceSystem=>({
 finance:'Finance OS',asset:'Asset OS',company:'Company OS'
})[name as 'finance'|'asset'|'company'] as SourceSystem;
const fingerprint=(snapshot:SourceSnapshot)=>
 createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

async function applySnapshot(pool:Pool,tenantId:string,principal:ProducerIdentity,
 snapshot:SourceSnapshot,request:FastifyRequest){
 const client=await pool.connect();
 let begun=false;
 try{
  await client.query('BEGIN');begun=true;
  await client.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  // Serialize all revisions from a given provider, including concurrent HTTP requests.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 2026))',
   [tenantId+'|'+snapshot.sourceSystem]);
  const grant=await client.query<{source_person_ref:string;authorized_subject:string;authorized_issuer:string}>(
   `SELECT source_person_ref,authorized_subject,authorized_issuer FROM wealth_integration.source_grants
    WHERE tenant_id=$1 AND source_system=$2 AND producer_issuer=$3 AND producer_subject=$4
    AND state='ACTIVE' AND revoked_at IS NULL`,
   [tenantId,snapshot.sourceSystem,principal.issuer,principal.subject]);
  if(grant.rowCount!==1)fail(403,'SOURCE_NOT_BOUND','This producer is not administratively bound to this tenant and source.');
  const authorized=grant.rows[0];
  if(snapshot.personRef!==authorized.source_person_ref)fail(403,'SOURCE_PERSON_MISMATCH','Source snapshot person ownership does not match its approved binding.');
  await client.query("SELECT set_config('app.subject_id',$1,true)",[authorized.authorized_subject]);
  const assurance=await client.query(`SELECT 1 FROM wealth_auth.identity_bindings b
   JOIN wealth_auth.tenant_memberships m ON m.tenant_id=b.tenant_id AND m.subject_id=b.subject_id
   WHERE b.tenant_id=$1 AND b.issuer=$2 AND b.subject_id=$3
   AND b.state='ACTIVE' AND b.revoked_at IS NULL AND m.status='ACTIVE'
   AND EXISTS (SELECT 1 FROM wealth_auth.consent_grants c
    WHERE c.tenant_id=b.tenant_id AND c.subject_id=b.subject_id
    AND c.source_system=$4 AND 'wealth.read'=ANY(c.scopes)
    AND c.revoked_at IS NULL AND c.effective_at<=now()
    AND (c.expires_at IS NULL OR c.expires_at>now()))`,
   [tenantId,authorized.authorized_issuer,authorized.authorized_subject,snapshot.sourceSystem]);
  if(assurance.rowCount!==1)fail(403,'SOURCE_CONSENT_REVOKED','The authorized human identity or consent is inactive.');
  const now=Date.now(),asOf=Date.parse(snapshot.asOf);
  if(!Number.isFinite(asOf)||asOf>now+300000||asOf<now-86400000)
   fail(422,'SOURCE_SNAPSHOT_STALE','Complete snapshots must be dated within 24 hours.');
  const digest=fingerprint(snapshot);
  const replay=await client.query<{source_event_id:string;source_revision:string;snapshot_hash:string}>(
   `SELECT source_event_id,source_revision,snapshot_hash FROM wealth_integration.source_ingestions
    WHERE tenant_id=$1 AND source_system=$2 AND
     (source_event_id=$3 OR source_revision=$4)`,
   [tenantId,snapshot.sourceSystem,snapshot.eventId,snapshot.sourceRevision]);
  if(replay.rowCount){
   const first=replay.rows[0];
   if(replay.rows.length!==1||first.snapshot_hash!==digest||
      first.source_event_id!==snapshot.eventId||first.source_revision!==snapshot.sourceRevision)
    fail(409,'SOURCE_REPLAY_CONFLICT','Event or revision was previously ingested with different content.');
   await client.query('COMMIT');begun=false;
   return {data:{sourceSystem:snapshot.sourceSystem,revision:snapshot.sourceRevision,
    status:'ALREADY_APPLIED',financialExecution:false}};
  }
  const prev=await client.query<{as_of:Date}>(`SELECT as_of FROM wealth_integration.source_watermarks
   WHERE tenant_id=$1 AND source_system=$2`,[tenantId,snapshot.sourceSystem]);
  if(prev.rowCount&&Date.parse(String(prev.rows[0].as_of))>=asOf)
   fail(409,'SOURCE_OUT_OF_ORDER','Source snapshot is not strictly newer than the previous accepted revision.');
  // Preserve asset IDs (holding_valuations may reference them), mark retired source rows inactive.
  await client.query('UPDATE wealth_portfolio.holdings SET source_active=false WHERE tenant_id=$1 AND source_system=$2',
   [tenantId,snapshot.sourceSystem]);
  if(snapshot.sourceSystem==='Finance OS'){
   await client.query('UPDATE wealth_capital.pools SET source_active=false WHERE tenant_id=$1',[tenantId]);
  }
  await client.query('DELETE FROM wealth_portfolio.income_projections WHERE tenant_id=$1 AND source_system=$2',
   [tenantId,snapshot.sourceSystem]);
  if(snapshot.sourceSystem==='Finance OS'){
   await client.query('DELETE FROM wealth_portfolio.liability_projections WHERE tenant_id=$1 AND source_system=$2',
    [tenantId,snapshot.sourceSystem]);
  }
  for(const h of snapshot.holdings){
   await client.query(`INSERT INTO wealth_portfolio.holdings
    (tenant_id,source_system,source_entity_type,source_entity_id,canonical_asset_ref,category,
     owner_fraction,valuation_amount,valuation_currency,valuation_as_of,valuation_method,
     provenance,quality_status,source_version,source_active)
    VALUES($1,$2,$3,$4,$5,$6,$7::numeric,$8::numeric,$9,$10::timestamptz,$11,$12::jsonb,$13,$14,true)
    ON CONFLICT(tenant_id,source_system,source_entity_type,source_entity_id) DO UPDATE SET
     canonical_asset_ref=EXCLUDED.canonical_asset_ref,category=EXCLUDED.category,
     owner_fraction=EXCLUDED.owner_fraction,valuation_amount=EXCLUDED.valuation_amount,
     valuation_currency=EXCLUDED.valuation_currency,valuation_as_of=EXCLUDED.valuation_as_of,
     valuation_method=EXCLUDED.valuation_method,provenance=EXCLUDED.provenance,
     quality_status=EXCLUDED.quality_status,source_version=EXCLUDED.source_version,
     source_active=true,updated_at=now()`,
    [tenantId,snapshot.sourceSystem,h.sourceEntityType,h.sourceEntityId,h.canonicalAssetRef,h.category,
     h.ownerFraction,h.valuationAmount,h.valuationCurrency,h.valuationAsOf,h.valuationMethod,
     JSON.stringify(h.provenance),h.qualityStatus,h.sourceVersion]);
  }
  for(const i of snapshot.incomes)await client.query(`INSERT INTO wealth_portfolio.income_projections
   (tenant_id,source_system,source_entity_id,monthly_amount,currency,passive,source_as_of,provenance)
   VALUES($1,$2,$3,$4::numeric,$5,$6,$7::timestamptz,$8::jsonb)`,
   [tenantId,snapshot.sourceSystem,i.sourceEntityId,i.monthlyAmount,i.currency,i.passive,i.sourceAsOf,JSON.stringify(i.provenance)]);
  for(const debt of snapshot.liabilities)await client.query(`INSERT INTO wealth_portfolio.liability_projections
   (tenant_id,source_system,source_entity_id,outstanding_amount,currency,source_as_of,provenance)
   VALUES($1,$2,$3,$4::numeric,$5,$6::timestamptz,$7::jsonb)`,
   [tenantId,snapshot.sourceSystem,debt.sourceEntityId,debt.outstandingAmount,debt.currency,debt.sourceAsOf,JSON.stringify(debt.provenance)]);
  for(const p of snapshot.capitalPools){
   const existing=await client.query<{id:string}>(`SELECT id FROM wealth_capital.pools
    WHERE tenant_id=$1 AND source_system='Finance OS' AND source_entity_ref=$2`,
    [tenantId,p.sourceEntityRef]);
   if(existing.rowCount){
    await client.query(`UPDATE wealth_capital.pools SET
     name=$3,purpose=$4,classified_cash=$5::numeric,reserved_cash=$6::numeric,
     committed_cash=$7::numeric,source_as_of=$8::timestamptz,version=version+1,
     source_active=true WHERE tenant_id=$1 AND source_entity_ref=$2`,
     [tenantId,p.sourceEntityRef,p.name,p.purpose,p.classifiedCash,p.reservedCash,p.committedCash,p.sourceAsOf]);
   }else{
    await client.query(`INSERT INTO wealth_capital.pools
     (tenant_id,name,purpose,classified_cash,reserved_cash,committed_cash,
      source_system,source_entity_ref,source_as_of,source_active)
     VALUES($1,$2,$3,$4::numeric,$5::numeric,$6::numeric,'Finance OS',$7,$8::timestamptz,true)`,
     [tenantId,p.name,p.purpose,p.classifiedCash,p.reservedCash,p.committedCash,p.sourceEntityRef,p.sourceAsOf]);
   }
  }
  const counts={holdings:snapshot.holdings.length,incomes:snapshot.incomes.length,
   liabilities:snapshot.liabilities.length,capitalPools:snapshot.capitalPools.length};
  await client.query(`INSERT INTO wealth_integration.source_ingestions
   (tenant_id,source_system,producer_issuer,producer_subject,source_event_id,source_revision,
    snapshot_hash,source_as_of,record_counts)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::jsonb)`,
   [tenantId,snapshot.sourceSystem,principal.issuer,principal.subject,snapshot.eventId,
    snapshot.sourceRevision,digest,snapshot.asOf,JSON.stringify(counts)]);
  await client.query(`INSERT INTO wealth_integration.source_watermarks
   (tenant_id,source_system,source_revision,as_of,complete,evidence,producer_subject,snapshot_hash)
   VALUES($1,$2,$3,$4::timestamptz,true,$5::jsonb,$6,$7)
   ON CONFLICT(tenant_id,source_system) DO UPDATE SET
    source_revision=EXCLUDED.source_revision,as_of=EXCLUDED.as_of,complete=true,
    evidence=EXCLUDED.evidence,producer_subject=EXCLUDED.producer_subject,
    snapshot_hash=EXCLUDED.snapshot_hash,received_at=now()`,
   [tenantId,snapshot.sourceSystem,snapshot.sourceRevision,snapshot.asOf,
    JSON.stringify(snapshot.completenessEvidence),principal.subject,digest]);
  await client.query(`INSERT INTO wealth_audit.audit_events
   (tenant_id,event_type,actor_subject,correlation_id,aggregate_type,aggregate_id,after_state)
   VALUES($1,'wealth.source.snapshot_applied',$2,$3,'source_snapshot',$4,$5::jsonb)`,
   [tenantId,'source:'+principal.subject,request.id,snapshot.eventId,
    JSON.stringify({source:snapshot.sourceSystem,revision:snapshot.sourceRevision,counts,hash:digest})]);
  await client.query(`INSERT INTO wealth_integration.outbox_events
   (tenant_id,event_type,event_version,correlation_id,actor_subject,payload)
   VALUES($1,'wealth.source.snapshot_applied',1,$2,$3,$4::jsonb)`,
   [tenantId,request.id,'source:'+principal.subject,JSON.stringify({source:snapshot.sourceSystem,
    revision:snapshot.sourceRevision,counts,sourceAsOf:snapshot.asOf})]);
  await client.query('COMMIT');begun=false;
  return {data:{sourceSystem:snapshot.sourceSystem,revision:snapshot.sourceRevision,
   status:'APPLIED',counts,financialExecution:false}};
 }catch(e){
  if(begun)try{await client.query('ROLLBACK')}catch{/* original error takes precedence */}
  if(e&&typeof e==='object'&&'code'in e&&(e as {code:unknown}).code==='23505')
   throw new ApiFailure(409,'CANONICAL_ASSET_CONFLICT','A canonical economic asset is already claimed by another source or revision.');
  throw e;
 }finally{client.release()}
}
export function registerSourceRoutes(app:FastifyInstance,services:SourceServices){
 app.post('/api/v1/integrations/sources/:source/snapshots',
  {bodyLimit:1024*1024},async(request,reply)=>{
   if(!services.pool||!services.verifyProducer)
    fail(503,'SOURCE_GATEWAY_DISABLED','Source service identity and a separate restricted ingestion database are not configured.');
   if(request.headers.origin)fail(403,'SERVICE_ONLY','Source ingestion is not a browser or CORS operation.');
   const header=request.headers.authorization;
   if(!header||!/^Bearer [^\s]+$/.test(header)||header.length>12000)
    fail(401,'PRODUCER_AUTH_REQUIRED','A short-lived signed source service access token is required.');
   const producer=await services.verifyProducer(header.slice(7));
   if(!producer.scopes.has('wealth:ingest'))fail(403,'PRODUCER_SCOPE_DENIED','Source producer lacks ingest scope.');
   const requested=tenantIdSchema.parse(request.headers['x-wealth-tenant-id']);
   const path=sourcePath.parse((request.params as {source:string}).source);
   const source=decodeSource(path);
   const data=sourceSnapshot.parse(request.body);
   if(data.sourceSystem!==source)fail(422,'SOURCE_MISMATCH','Producer source does not match snapshot route.');
   const output=await applySnapshot(services.pool,requested,producer,data,request);
   return reply.status(output.data.status==='APPLIED'?201:200).header('Cache-Control','no-store').send(output);
  });
}
