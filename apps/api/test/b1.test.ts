import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import type {FastifyInstance} from 'fastify';
import type {Principal} from '../src/auth.js';
import {createApp} from '../src/app.js';
import {verifyRestrictedRole} from '../src/db.js';
import {fail} from '../src/errors.js';

const privileged=process.env.WEALTH_MIGRATOR_DATABASE_URL,restricted=process.env.WEALTH_APP_DATABASE_URL;
const describeDb=privileged&&restricted?describe:describe.skip;
describeDb('B1 real PostgreSQL durable wealth domains and consent boundaries',()=>{
 const a=randomUUID(),b=randomUUID();
 const principal:Record<string,Principal>={
  owner:{subject:'kernel:b1:owner',scopes:new Set(['wealth:read','wealth:write']),issuer:'https://id.example.test/'},
  other:{subject:'kernel:b1:other',scopes:new Set(['wealth:read','wealth:write']),issuer:'https://id.example.test/'},
  viewer:{subject:'kernel:b1:viewer',scopes:new Set(['wealth:read']),issuer:'https://id.example.test/'}
 };
 const headers=(tenant=a,identity='owner',more:Record<string,string>={})=>({
  authorization:'Bearer '+identity,'x-wealth-tenant-id':tenant,...more
 });
 const idemp=(key:string,version?:number|string)=>({
  'idempotency-key':key,...(version===undefined?{}:{'if-match':'"'+version+'"'})
 });
 const goalPayload={title:'Retirement liquidity',metric:'LIQUID_WEALTH',targetAmount:'1200000.0000',targetDate:'2033-12-31',priority:'HIGH'};
 let db:Pool,admin:Pool,api:FastifyInstance,goalId='',poolId='',strategyId='',proposalId='';
 beforeAll(async()=>{
  admin=new Pool({connectionString:privileged});
  db=new Pool({connectionString:restricted});
  await verifyRestrictedRole(db);
  await admin.query('INSERT INTO wealth_auth.tenants(id,external_person_ref,label) VALUES($1,$2,$3),($4,$5,$6)',[
   a,'person:b1:a','B1 tenant A',b,'person:b1:b','B1 tenant B']);
  await admin.query(`INSERT INTO wealth_auth.tenant_memberships(tenant_id,subject_id,role)
   VALUES ($1,$2,'OWNER'),($1,$3,'VIEWER'),($4,$5,'OWNER')`,
  [a,principal.owner.subject,principal.viewer.subject,b,principal.other.subject]);
  for(const [tenant,subject,issuer] of [
   [a,principal.owner.subject,principal.owner.issuer],
   [a,principal.viewer.subject,principal.viewer.issuer],
   [b,principal.other.subject,principal.other.issuer]
  ]){
   await admin.query(`INSERT INTO wealth_auth.identity_bindings
    (tenant_id,issuer,subject_id,kernel_person_ref,proof_reference,verified_at)
    VALUES($1,$2,$3,$4,$5,now())`,[tenant,issuer,subject,'person:ci:'+subject,'ci-verified-binding']);
  }
  api=createApp({pool:db,verifyBearer:async token=>{
   if(!principal[token])fail(401,'INVALID_TOKEN','Invalid access token');
   return principal[token];
  },allowedOrigins:['https://sean-steve.github.io']});
  await api.ready();
 });
 afterAll(async()=>{await api?.close();await db?.end();await admin?.end()});
 it('keeps historical strategy versions append-only at the application role level',async()=>{
  const r=await db.query<{allowed:boolean}>(`SELECT has_table_privilege(current_user,
   'wealth_planning.strategy_versions','UPDATE') AS allowed`);
  expect(r.rows[0].allowed).toBe(false);
 });
 it('allows explicit origin while refusing credentialed cross-origin requests',async()=>{
  const allowed=await api.inject({method:'OPTIONS',url:'/api/v1/wealth/goals',headers:{origin:'https://sean-steve.github.io',
   'access-control-request-method':'POST'}});
  expect(allowed.statusCode).toBe(204);
  expect(allowed.headers['access-control-allow-origin']).toBe('https://sean-steve.github.io');
  const outside=await api.inject({method:'OPTIONS',url:'/api/v1/wealth/goals',headers:{origin:'https://evil.example.test',
   'access-control-request-method':'POST'}});
  expect(outside.headers['access-control-allow-origin']).toBeUndefined();
 });
 it('creates a durable goal and limits milestones to its target and deadline',async()=>{
  const created=await api.inject({method:'POST',url:'/api/v1/wealth/goals',headers:headers(a,'owner',idemp('b1-goal-primary')),payload:goalPayload});
  expect(created.statusCode).toBe(201);goalId=created.json().data.id;
  const wrong=await api.inject({method:'POST',url:'/api/v1/wealth/goals/'+goalId+'/milestones',
   headers:headers(a,'owner',idemp('b1-milestone-wrong')),
   payload:{title:'Too high',targetAmount:'1500000',dueDate:'2034-12-31'}});
  expect(wrong.statusCode).toBe(422);
  const body={title:'First milestone',targetAmount:'500000.0000',dueDate:'2030-12-31'};
  const add=()=>api.inject({method:'POST',url:'/api/v1/wealth/goals/'+goalId+'/milestones',
   headers:headers(a,'owner',idemp('b1-milestone-valid')),payload:body});
  const result=await add();
  expect(result.statusCode).toBe(201);expect(result.headers.etag).toBe('"1"');
  expect((await add()).json().data.id).toBe(result.json().data.id);
  const id=result.json().data.id as string;
  const patch=await api.inject({method:'PATCH',url:'/api/v1/wealth/goals/'+goalId+'/milestones/'+id,
   headers:headers(a,'owner',idemp('b1-milestone-patch','1')),payload:{status:'REACHED'}});
  expect(patch.statusCode).toBe(200);expect(patch.headers.etag).toBe('"2"');
  const stale=await api.inject({method:'PATCH',url:'/api/v1/wealth/goals/'+goalId+'/milestones/'+id,
   headers:headers(a,'owner',idemp('b1-milestone-stale','1')),payload:{title:'Old version'}});
  expect(stale.statusCode).toBe(409);
  const list=await api.inject({method:'GET',url:'/api/v1/wealth/goals/'+goalId+'/milestones',headers:headers()});
  expect(list.statusCode).toBe(200);expect(list.json().data[0].status).toBe('REACHED');
  const denied=await api.inject({method:'GET',url:'/api/v1/wealth/goals/'+goalId+'/milestones',headers:headers(b,'other')});
  expect(denied.statusCode).toBe(404);
 });
 it('creates immutable strategy versions, reversion draft and a separate active pointer',async()=>{
  const payload={goalId,name:'Balanced reinvestment',thesis:'Evidence-based 5-year capital deployment.',
   allocationTargets:[{label:'Investments',basisPoints:6000},{label:'Cash & reserves',basisPoints:4000}],
   assumptions:{riskTolerance:'BALANCED',horizonYears:5,assumedAnnualReturnPct:5}};
  const bad=await api.inject({method:'POST',url:'/api/v1/wealth/strategies',
   headers:headers(a,'owner',idemp('b1-strategy-bad')),
   payload:{...payload,allocationTargets:[{label:'Investments',basisPoints:9000}]}});
  expect(bad.statusCode).toBe(400);
  const draft=await api.inject({method:'POST',url:'/api/v1/wealth/strategies',
   headers:headers(a,'owner',idemp('b1-strategy-create')),payload});
  expect(draft.statusCode).toBe(201);strategyId=draft.json().data.id;
  expect(draft.json().data.latestVersion).toBe(1);
  const edit=await api.inject({method:'POST',url:'/api/v1/wealth/strategies/'+strategyId+'/versions',
   headers:headers(a,'owner',idemp('b1-strategy-revise',1)),payload:{
    name:'Balanced updated',thesis:payload.thesis,allocationTargets:payload.allocationTargets,
    assumptions:{...payload.assumptions,horizonYears:6}
   }});
  expect(edit.statusCode).toBe(201);expect(edit.json().data.latestVersion).toBe(2);
  const activate=()=>api.inject({method:'POST',url:'/api/v1/wealth/strategies/'+strategyId+'/activate',
   headers:headers(a,'owner',idemp('b1-strategy-activate',2)),payload:{}});
  const active=await activate();expect(active.statusCode).toBe(200);
  expect(active.json().data.activeVersion).toBe(3);
  expect((await activate()).json().data.activeVersion).toBe(3);
  const details=await api.inject({method:'GET',url:'/api/v1/wealth/strategies/'+strategyId,headers:headers()});
  expect(details.statusCode).toBe(200);expect(details.json().versions.map((v:{version:number})=>v.version)).toEqual([3,2,1]);
  const denied=await api.inject({method:'GET',url:'/api/v1/wealth/strategies/'+strategyId,headers:headers(b,'other')});
  expect(denied.statusCode).toBe(404);
  const viewer=await api.inject({method:'POST',url:'/api/v1/wealth/strategies',
   headers:headers(a,'viewer',idemp('b1-strategy-viewer')),payload});
  expect(viewer.statusCode).toBe(403);
 });
 it('prevents activating two different strategies for the same goal',async()=>{
  const other=await api.inject({method:'POST',url:'/api/v1/wealth/strategies',
   headers:headers(a,'owner',idemp('b1-strategy-second')),
   payload:{goalId,name:'Competing',thesis:'Alternative planning scenario.',
    allocationTargets:[{label:'Alternative',basisPoints:10000}],
    assumptions:{riskTolerance:'CONSERVATIVE',horizonYears:3,assumedAnnualReturnPct:2}}});
  expect(other.statusCode).toBe(201);
  const active=await api.inject({method:'POST',url:'/api/v1/wealth/strategies/'+other.json().data.id+'/activate',
   headers:headers(a,'owner',idemp('b1-strategy-second-active',1)),payload:{}});
  expect(active.statusCode).toBe(409);
  expect(active.json().error.code).toBe('ACTIVE_STRATEGY_EXISTS');
 });
 it('refuses capital proposals without Finance OS evidence and an active planning policy',async()=>{
  const pool=await admin.query<{id:string}>(`INSERT INTO wealth_capital.pools
   (tenant_id,name,purpose,classified_cash,reserved_cash,committed_cash,source_entity_ref,source_as_of)
   VALUES($1,'Finance OS classified cash','Research capital',1000000,200000,100000,'finance:cash:123',now())
   RETURNING id`,[a]);poolId=pool.rows[0].id;
  const noConsent=await api.inject({method:'GET',url:'/api/v1/wealth/capital/pools',headers:headers()});
  expect(noConsent.statusCode).toBe(200);expect(noConsent.json().data).toEqual([]);
  expect(noConsent.json().missingConsent).toBe('Finance OS');
  await admin.query(`INSERT INTO wealth_auth.consent_grants(tenant_id,source_system,purpose,scopes,subject_id,effective_at)
    VALUES($1,'Finance OS','Personal capital planning',ARRAY['wealth.read'],$2,now()-interval '1 minute')`,
    [a,principal.owner.subject]);
  const list=await api.inject({method:'GET',url:'/api/v1/wealth/capital/pools',headers:headers()});
  expect(list.statusCode).toBe(200);expect(list.json().data[0].uncommittedCash).toBe('700000.0000');
  const payload={poolId,target:'Diversified fixed income',amount:'500000',rationale:'Research a hypothetical portfolio opportunity with a liquidity buffer.'};
  const none=await api.inject({method:'POST',url:'/api/v1/wealth/capital/proposals',
   headers:headers(a,'owner',idemp('b1-cap-no-policy',1)),payload});
  expect(none.statusCode).toBe(422);expect(none.json().error.code).toBe('POLICY_MISSING');
  await admin.query(`INSERT INTO wealth_core.wealth_policies
   (tenant_id,policy_kind,policy_version,rules,effective_from,created_by_subject)
   VALUES($1,'CAPITAL_PROPOSAL',1,$2::jsonb,now()-interval '1 minute','kernel:policy-administrator')`,
   [a,JSON.stringify({maxProposalPercent:80})]);
  await admin.query("UPDATE wealth_capital.pools SET source_as_of=now()-interval '48 hours' WHERE id=$1",[poolId]);
  const stale=await api.inject({method:'POST',url:'/api/v1/wealth/capital/proposals',
   headers:headers(a,'owner',idemp('b1-cap-stale',1)),payload});
  expect(stale.statusCode).toBe(422);expect(stale.json().error.code).toBe('SOURCE_STALE');
  await admin.query("UPDATE wealth_capital.pools SET source_as_of=now() WHERE id=$1",[poolId]);
 });
 it('prevents capital oversubscription, then releases planning budget after cancellation',async()=>{
  const p={poolId,target:'Possible investment',amount:'500000',rationale:'Evaluate evidence for a possible future allocation without transferring cash.'};
  const first=()=>api.inject({method:'POST',url:'/api/v1/wealth/capital/proposals',
   headers:headers(a,'owner',idemp('b1-cap-first',1)),payload:p});
  const created=await first();expect(created.statusCode).toBe(201);proposalId=created.json().data.id;
  expect(created.json().financialExecution).toBe(false);
  expect((await first()).json().data.id).toBe(proposalId);
  const another=await api.inject({method:'POST',url:'/api/v1/wealth/capital/proposals',
   headers:headers(a,'owner',idemp('b1-cap-over',1)),
   payload:{...p,target:'Second proposal',amount:'300000'}});
  expect(another.statusCode).toBe(422);expect(another.json().error.code).toBe('CAPITAL_GUARDRAIL');
  const cancel=await api.inject({method:'POST',url:'/api/v1/wealth/capital/proposals/'+proposalId+'/cancel',
   headers:headers(a,'owner',idemp('b1-cap-cancel',1)),payload:{}});
  expect(cancel.statusCode).toBe(200);expect(cancel.json().data.status).toBe('CANCELLED');
  const after=await api.inject({method:'POST',url:'/api/v1/wealth/capital/proposals',
   headers:headers(a,'owner',idemp('b1-cap-after',1)),
   payload:{...p,target:'New uncommitted idea',amount:'300000'}});
  expect(after.statusCode).toBe(201);
  const recorded=await admin.query<{n:string}>(`SELECT COUNT(*)::text AS n FROM wealth_audit.audit_events
   WHERE tenant_id=$1 AND event_type='wealth.capital.proposal_created'`,[a]);
  expect(Number(recorded.rows[0].n)).toBe(2);
  const cash=await admin.query<{balance:string}>(`SELECT classified_cash::text AS balance FROM wealth_capital.pools WHERE id=$1`,[poolId]);
  expect(Number(cash.rows[0].balance)).toBe(1000000);
 });
 it('never fabricates net worth when source consents or reconciliation is absent',async()=>{
  const state=await api.inject({method:'GET',url:'/api/v1/wealth/state',headers:headers()});
  expect(state.statusCode).toBe(200);expect(state.json().data.status).toBe('INCOMPLETE');
  expect(state.json().data.netWorth).toBeNull();
  expect(state.json().data.blockers).toContain('Asset OS: missing subject-scoped read consent');
  const holdings=await api.inject({method:'GET',url:'/api/v1/wealth/portfolio/holdings',headers:headers()});
  expect(holdings.statusCode).toBe(200);expect(holdings.json().data).toEqual([]);
 });
 it('requires valid subject consents and complete, fresh source watermarks before reporting a net-worth projection',async()=>{
  // CI's privileged migrator represents a future trusted source adapter; no public ingestion route exists.
  await admin.query(`INSERT INTO wealth_portfolio.holdings
   (tenant_id,source_system,source_entity_type,source_entity_id,canonical_asset_ref,category,owner_fraction,
    valuation_amount,valuation_currency,valuation_as_of,valuation_method,source_version,quality_status)
   VALUES($1,'Asset OS','asset','property-123','asset:property-123','PROPERTY',0.5,1000000,'KES',now(),'broker-comparable','v1','VERIFIED'),
         ($1,'Finance OS','account','cash-123','finance:cash-123','CASH',1,100000,'KES',now(),'reconciled','v1','VERIFIED'),
         ($2,'Asset OS','asset','other-tenant','asset:other-tenant','PROPERTY',1,90000000,'KES',now(),'external','v1','VERIFIED')`,[a,b]);
  await admin.query(`INSERT INTO wealth_portfolio.liability_projections
   (tenant_id,source_system,source_entity_id,outstanding_amount,currency,source_as_of,provenance)
   VALUES($1,'Finance OS','loan-123',200000,'KES',now(),'{}'::jsonb)`,[a]);
  for(const system of ['Finance OS','Asset OS','Company OS']){
   await admin.query(`INSERT INTO wealth_integration.source_watermarks
     (tenant_id,source_system,source_revision,as_of,complete)
     VALUES($1,$2,'v1',now(),true)`,[a,system]);
   await admin.query(`INSERT INTO wealth_auth.consent_grants
     (tenant_id,source_system,purpose,scopes,subject_id,effective_at)
     VALUES($1,$2,'Personal wealth planning',ARRAY['wealth.read'],$3,now()-interval '1 minute')`,
     [a,system,principal.owner.subject]);
  }
  const owner=await api.inject({method:'GET',url:'/api/v1/wealth/state',headers:headers()});
  expect(owner.statusCode).toBe(200);
  expect(owner.json().data.status).toBe('INCOMPLETE');
  expect(owner.json().data.netWorth).toBeNull();
  expect(owner.json().data.blockers).toContain('Asset OS: no signed receipt from an active, approved source producer');
  const holdings=await api.inject({method:'GET',url:'/api/v1/wealth/portfolio/holdings',headers:headers()});
  expect(holdings.json().data).toHaveLength(2);
  const noConsent=await api.inject({method:'GET',url:'/api/v1/wealth/state',headers:headers(a,'viewer')});
  expect(noConsent.json().data.netWorth).toBeNull();
  expect(noConsent.json().data.status).toBe('INCOMPLETE');
  const cross=await api.inject({method:'GET',url:'/api/v1/wealth/portfolio/holdings',headers:headers(b,'other')});
  expect(cross.json().data).toHaveLength(0);
  // A stale watermark must revoke completeness without changing the underlying holdings.
  await admin.query("UPDATE wealth_integration.source_watermarks SET as_of=now()-interval '3 days' WHERE tenant_id=$1 AND source_system='Asset OS'",[a]);
  const stale=await api.inject({method:'GET',url:'/api/v1/wealth/state',headers:headers()});
  expect(stale.json().data.netWorth).toBeNull();
  expect(stale.json().data.blockers).toContain('Asset OS: snapshot older than 24 hours or invalid');
 });
});
