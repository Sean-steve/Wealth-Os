import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import {Pool} from 'pg';
import {createApp} from '../src/app.js';
import {verifyRestrictedRole} from '../src/db.js';
import {fail} from '../src/errors.js';
import type {Principal} from '../src/auth.js';
import type {ProducerIdentity,SourceSystem} from '../src/b2/sourceContracts.js';
const database=process.env.WEALTH_MIGRATOR_DATABASE_URL;
const appUrl=process.env.WEALTH_APP_DATABASE_URL;
const ingestUrl=process.env.WEALTH_INGEST_DATABASE_URL;
const describePg=database&&appUrl&&ingestUrl?describe:describe.skip;
describePg('B2: verified boundaries and authoritative, replay-safe source snapshots',()=>{
 const tenant=randomUUID(),otherTenant=randomUUID();
 const human:Principal={subject:'kernel:b2:owner',issuer:'https://id.example.test/',scopes:new Set(['wealth:read','wealth:write'])};
 const sourceIssuer='https://producer.example.test/';
 const serviceSubjects:Record<SourceSystem,string>={
  'Finance OS':'service:finance-os', 'Asset OS':'service:asset-os','Company OS':'service:company-os'
 };
 let admin:Pool,appPool:Pool,ingestPool:Pool,api:FastifyInstance;
 const auth=(tenantId=tenant,subject='owner')=>({authorization:'Bearer '+subject,
  'x-wealth-tenant-id':tenantId});
 const signed=(source:SourceSystem,tenantId=tenant)=>({
  authorization:'Bearer '+serviceSubjects[source], 'x-wealth-tenant-id':tenantId
 });
 const sourceSlug=(s:SourceSystem)=>({'Finance OS':'finance','Asset OS':'asset','Company OS':'company'})[s];
 let sequence=0;
 const valid=(system:SourceSystem,data:Record<string,unknown>={})=>{
  const now=new Date(Date.now()-60000+sequence*1000).toISOString();
  sequence++;
  const holdings=system==='Finance OS'?[{
   sourceEntityType:'account',sourceEntityId:'cash-1',canonicalAssetRef:'finance:cash-1',category:'CASH',
   ownerFraction:'1',valuationAmount:'100000',valuationCurrency:'KES',valuationAsOf:now,
   valuationMethod:'reconciled account balance',sourceVersion:'r1',qualityStatus:'VERIFIED',provenance:{reconciliation:'verified'}
  }]:system==='Asset OS'?[{
   sourceEntityType:'property',sourceEntityId:'p-1',canonicalAssetRef:'asset:p-1',category:'PROPERTY',
   ownerFraction:'0.5',valuationAmount:'500000',valuationCurrency:'KES',valuationAsOf:now,
   valuationMethod:'approved valuation',sourceVersion:'r1',qualityStatus:'VERIFIED',provenance:{review:'approved'}
  }]:[{
   sourceEntityType:'equity',sourceEntityId:'company-1',canonicalAssetRef:'company:company-1',
   category:'BUSINESS_EQUITY',ownerFraction:'1',valuationAmount:'300000',valuationCurrency:'KES',
   valuationAsOf:now,valuationMethod:'reviewed equity',sourceVersion:'r1',qualityStatus:'VERIFIED',
   provenance:{review:'approved'}
  }];
  const incomes=system==='Company OS'?[{
   sourceEntityId:'dividend-1',monthlyAmount:'4000',currency:'KES',passive:true,
   sourceAsOf:now,provenance:{period:'monthly'}
  }]:[];
  const liabilities=system==='Finance OS'?[{
   sourceEntityId:'loan-1',outstandingAmount:'70000',currency:'KES',
   sourceAsOf:now,provenance:{reconciliation:'verified'}
  }]:[];
  const capitalPools=system==='Finance OS'?[{
   sourceEntityRef:'finance:cash-pool-1',name:'Reserve classification',purpose:'Research funding',
   classifiedCash:'90000',reservedCash:'20000',committedCash:'10000',sourceAsOf:now
  }]:[];
  return {schemaVersion:1,eventId:randomUUID(),sourceSystem:system,sourceRevision:'revision-'+sequence,
   asOf:now,personRef:'person:b2:verified',complete:true,holdings,incomes,liabilities,capitalPools,
   completenessEvidence:{coverage:'ALL',sourceRecordCount:holdings.length+incomes.length+liabilities.length+capitalPools.length,
    attestation:'Source-side reconciliation evidence accepted in isolated CI.'},...data};
 };
 const push=(system:SourceSystem,data:Record<string,unknown>,tenantId=tenant,subject=system)=>
  api.inject({method:'POST',url:'/api/v1/integrations/sources/'+sourceSlug(system)+'/snapshots',
   headers:signed(subject as SourceSystem,tenantId),payload:data});
 beforeAll(async()=>{
  admin=new Pool({connectionString:database});
  appPool=new Pool({connectionString:appUrl});
  ingestPool=new Pool({connectionString:ingestUrl});
  await verifyRestrictedRole(appPool);await verifyRestrictedRole(ingestPool);
  await admin.query(`INSERT INTO wealth_auth.tenants(id,external_person_ref,label)
   VALUES($1,'person:b2:verified','B2 source tenant'),($2,'person:b2:other','B2 other tenant')`,[tenant,otherTenant]);
  await admin.query(`INSERT INTO wealth_auth.tenant_memberships(tenant_id,subject_id,role)
   VALUES($1,$2,'OWNER')`,[tenant,human.subject]);
  await admin.query(`INSERT INTO wealth_auth.identity_bindings
   (tenant_id,issuer,subject_id,kernel_person_ref,proof_reference,verified_at)
   VALUES($1,$2,$3,'person:b2:verified','ci-administrator-proof',now())`,
   [tenant,human.issuer,human.subject]);
  for(const system of Object.keys(serviceSubjects) as SourceSystem[]){
   await admin.query(`INSERT INTO wealth_auth.consent_grants
    (tenant_id,source_system,purpose,scopes,subject_id,effective_at)
    VALUES($1,$2,'Human-approved wealth analysis',ARRAY['wealth.read'],$3,now()-interval '1 minute')`,
    [tenant,system,human.subject]);
   await admin.query(`INSERT INTO wealth_integration.source_grants
    (tenant_id,source_system,producer_issuer,producer_subject,authorized_subject,authorized_issuer,
     source_person_ref,proof_reference)
    VALUES($1,$2,$3,$4,$5,$6,'person:b2:verified','ci-service-binding-proof')`,
    [tenant,system,sourceIssuer,serviceSubjects[system],human.subject,human.issuer]);
  }
  api=createApp({pool:appPool,verifyBearer:async token=>{
   if(token!=='owner')fail(401,'INVALID_TOKEN','Unverified caller');
   return human;
  },sourceServices:{pool:ingestPool,verifyProducer:async token=>{
   if(!Object.values(serviceSubjects).includes(token))fail(401,'INVALID_PRODUCER','Untrusted service');
   const p:ProducerIdentity={issuer:sourceIssuer,subject:token,scopes:new Set(['wealth:ingest'])};
   return p;
  }}});
  await api.ready();
 });
 afterAll(async()=>{await api?.close();await ingestPool?.end();await appPool?.end();await admin?.end()});
 it('has isolated ingestion role lacking user-owned goal and identity mutation permissions',async()=>{
  await expect(ingestPool.query('SELECT * FROM wealth_planning.goals')).rejects.toThrow();
  await expect(ingestPool.query('UPDATE wealth_auth.identity_bindings SET state=$1',['REVOKED'])).rejects.toThrow();
  const grants=await ingestPool.query<{rolsuper:boolean;rolbypassrls:boolean}>(
   'SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  expect(grants.rows[0]).toMatchObject({rolsuper:false,rolbypassrls:false});
 });
 it('denies anonymous, forged producer, mismatched person and nonbound tenant ingestion',async()=>{
  const sample=valid('Finance OS');
  const noAuth=await api.inject({method:'POST',url:'/api/v1/integrations/sources/finance/snapshots',
   headers:{'x-wealth-tenant-id':tenant},payload:sample});
  expect(noAuth.statusCode).toBe(401);
  const forged=await api.inject({method:'POST',url:'/api/v1/integrations/sources/finance/snapshots',
   headers:{authorization:'Bearer attacker','x-wealth-tenant-id':tenant},payload:sample});
  expect(forged.statusCode).toBe(401);
  const wrongPerson=await push('Finance OS',{...sample,personRef:'person:someone-else'});
  expect(wrongPerson.statusCode).toBe(403);
  const wrongTenant=await push('Finance OS',sample,otherTenant);
  expect(wrongTenant.statusCode).toBe(403);
  const wrongRoute=await api.inject({method:'POST',url:'/api/v1/integrations/sources/asset/snapshots',
   headers:signed('Finance OS'),payload:sample});
  expect(wrongRoute.statusCode).toBe(422);
  const badOrigin=await api.inject({method:'POST',url:'/api/v1/integrations/sources/finance/snapshots',
   headers:{...signed('Finance OS'),origin:'https://sean-steve.github.io'},payload:sample});
  expect(badOrigin.statusCode).toBe(403);
 });
 it('fails closed on incomplete source facts, invalid category and out-of-range cash reserve',async()=>{
  const incomplete=valid('Finance OS',{completenessEvidence:{coverage:'PARTIAL',sourceRecordCount:3,
   attestation:'Source was not fully reconciled'}});expect((await push('Finance OS',incomplete)).statusCode).toBe(400);
  const wrongCategory=valid('Finance OS');wrongCategory.holdings[0].category='PROPERTY';
  expect((await push('Finance OS',wrongCategory)).statusCode).toBe(400);
  const negativeReserve=valid('Finance OS');
  negativeReserve.capitalPools[0].reservedCash='900000';
  expect((await push('Finance OS',negativeReserve)).statusCode).toBe(400);
  const missing=await api.inject({method:'GET',url:'/api/v1/wealth/state',headers:auth()});
  expect(missing.json().data.status).toBe('INCOMPLETE');expect(missing.json().data.netWorth).toBeNull();
 });
 it('accepts three distinct authoritative snapshots and reconciles once with no cash double-count',async()=>{
  for(const source of ['Finance OS','Asset OS','Company OS'] as SourceSystem[]){
   const body=valid(source);
   const response=await push(source,body);
   expect(response.statusCode,JSON.stringify(response.json())).toBe(201);
   expect(response.json().data.financialExecution).toBe(false);
   expect(response.json().data.status).toBe('APPLIED');
   expect((await push(source,body)).statusCode).toBe(200);
  }
  const s=await api.inject({method:'GET',url:'/api/v1/wealth/state',headers:auth()});
  expect(s.statusCode).toBe(200);expect(s.json().data.status).toBe('RECONCILED_SOURCE_PROJECTION');
  expect(Number(s.json().data.grossAssets)).toBe(650000);
  expect(Number(s.json().data.liabilities)).toBe(70000);
  expect(Number(s.json().data.netWorth)).toBe(580000);
  const pools=await api.inject({method:'GET',url:'/api/v1/wealth/capital/pools',headers:auth()});
  expect(pools.json().data).toHaveLength(1);
  const list=await api.inject({method:'GET',url:'/api/v1/wealth/portfolio/holdings',headers:auth()});
  expect(list.json().data).toHaveLength(3);
  const sourceStatus=await api.inject({method:'GET',url:'/api/v1/wealth/sources/status',headers:auth()});
  expect(sourceStatus.statusCode).toBe(200);
  expect(sourceStatus.json().data.every((s:{status:string})=>s.status==='CURRENT')).toBe(true);
 });
 it('rejects changed replay contents and source entity duplicates without corrupting accepted state',async()=>{
  const event=valid('Asset OS');
  const success=await push('Asset OS',event);expect(success.statusCode).toBe(201);
  const tampered=await push('Asset OS',{...event,holdings:[{...event.holdings[0],valuationAmount:'999999'}]});
  expect(tampered.statusCode).toBe(409);
  const collision=valid('Asset OS');collision.holdings[0].canonicalAssetRef='finance:cash-1';
  expect((await push('Asset OS',collision)).statusCode).toBe(409);
  const again=await api.inject({method:'GET',url:'/api/v1/wealth/state',headers:auth()});
  expect(Number(again.json().data.netWorth)).toBe(580000);
 });
 it('retains immutable source audit and outbox events and accepts newer revisions',async()=>{
  const v=valid('Finance OS');
  v.holdings[0].valuationAmount='120000';
  const response=await push('Finance OS',v);expect(response.statusCode).toBe(201);
  const s=await api.inject({method:'GET',url:'/api/v1/wealth/state',headers:auth()});
  expect(Number(s.json().data.netWorth)).toBe(600000);
  const receipts=await admin.query<{count:string}>(`SELECT COUNT(*)::text AS count
   FROM wealth_integration.source_ingestions WHERE tenant_id=$1`,[tenant]);
  expect(Number(receipts.rows[0].count)).toBe(5);
  const audit=await admin.query<{count:string}>(`SELECT COUNT(*)::text AS count
   FROM wealth_audit.audit_events WHERE tenant_id=$1
   AND event_type='wealth.source.snapshot_applied'`,[tenant]);
  expect(Number(audit.rows[0].count)).toBe(5);
  const outbox=await admin.query<{count:string}>(`SELECT COUNT(*)::text AS count
   FROM wealth_integration.outbox_events WHERE tenant_id=$1
   AND event_type='wealth.source.snapshot_applied'`,[tenant]);
  expect(Number(outbox.rows[0].count)).toBe(5);
  const old={...v,eventId:randomUUID(),sourceRevision:'old-revision',
   asOf:new Date(Date.now()-4*3600_000).toISOString()};
  expect((await push('Finance OS',old)).statusCode).toBe(409);
 });
 it('revoked source producer authority invalidates the previously trusted net-worth projection',async()=>{
  await admin.query(`UPDATE wealth_integration.source_grants SET state='REVOKED',revoked_at=now()
   WHERE tenant_id=$1 AND source_system='Company OS'`,[tenant]);
  const state=await api.inject({method:'GET',url:'/api/v1/wealth/state',headers:auth()});
  expect(state.statusCode).toBe(200);
  expect(state.json().data.netWorth).toBeNull();
  expect(state.json().data.blockers).toContain('Company OS: no signed receipt from an active, approved source producer');
  const status=await api.inject({method:'GET',url:'/api/v1/wealth/sources/status',headers:auth()});
  expect(status.json().data.find((x:{sourceSystem:string})=>x.sourceSystem==='Company OS').status)
   .toBe('PRODUCER_NOT_BOUND');
 });
 it('revoked consent blocks further ingestion and hides subject-specific source data',async()=>{
  await admin.query(`UPDATE wealth_auth.consent_grants SET revoked_at=now()
   WHERE tenant_id=$1 AND source_system='Finance OS'`,[tenant]);
  const response=await push('Finance OS',valid('Finance OS'));
  expect(response.statusCode).toBe(403);expect(response.json().error.code).toBe('SOURCE_CONSENT_REVOKED');
  const state=await api.inject({method:'GET',url:'/api/v1/wealth/state',headers:auth()});
  expect(state.json().data.netWorth).toBeNull();
  const portfolio=await api.inject({method:'GET',url:'/api/v1/wealth/portfolio/holdings',headers:auth()});
  expect(portfolio.json().data.every((x:{sourceSystem:string})=>x.sourceSystem!=='Finance OS')).toBe(true);
  const sourceStatus=await api.inject({method:'GET',url:'/api/v1/wealth/sources/status',headers:auth()});
  expect(sourceStatus.json().data[0].status).toBe('CONSENT_REQUIRED');
 });
 it('revoked verified Kernel binding denies all member API access immediately',async()=>{
  await admin.query(`UPDATE wealth_auth.identity_bindings SET state='REVOKED',revoked_at=now()
   WHERE tenant_id=$1 AND subject_id=$2`,[tenant,human.subject]);
  const result=await api.inject({method:'GET',url:'/api/v1/wealth/goals',headers:auth()});
  expect(result.statusCode).toBe(403);
  expect(result.json().error.code).toBe('KERNEL_IDENTITY_UNBOUND');
 });
});
