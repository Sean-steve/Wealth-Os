import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import type {FastifyInstance} from 'fastify';
import {createApp} from '../src/app.js';
import {verifyRestrictedRole,withTenant} from '../src/db.js';
import type {Principal} from '../src/auth.js';
import {fail} from '../src/errors.js';

const migratorUrl=process.env.WEALTH_MIGRATOR_DATABASE_URL;
const appUrl=process.env.WEALTH_APP_DATABASE_URL;
const describeDb=migratorUrl&&appUrl?describe:describe.skip;
describeDb('B0 live PostgreSQL REST, tenant isolation and audit certification',()=>{
 let admin:Pool,db:Pool,api:FastifyInstance;
 const tenantA=randomUUID(),tenantB=randomUUID(),tenantDenied=randomUUID();
 const users:Record<string,Principal>={
  owner:{subject:'kernel:b0:owner',issuer:'https://issuer.example.test/',scopes:new Set(['wealth:read','wealth:write'])},
  other:{subject:'kernel:b0:other',issuer:'https://issuer.example.test/',scopes:new Set(['wealth:read','wealth:write'])},
  viewer:{subject:'kernel:b0:viewer',issuer:'https://issuer.example.test/',scopes:new Set(['wealth:read'])},
  readonly:{subject:'kernel:b0:readonly',issuer:'https://issuer.example.test/',scopes:new Set(['wealth:read'])}
 };
 let firstGoal='';
 const header=(tenant:string=tenantA,user='owner',other:Record<string,string>={})=>({
  authorization:'Bearer '+user,'x-wealth-tenant-id':tenant,...other
 });
 const newGoal=(title='Independence goal')=>({
  title,metric:'NET_WORTH',targetAmount:'25000000.00',targetDate:'2035-12-31',priority:'HIGH'
 });
 beforeAll(async()=>{
  admin=new Pool({connectionString:migratorUrl});
  db=new Pool({connectionString:appUrl});
  await verifyRestrictedRole(db);
  await admin.query('INSERT INTO wealth_auth.tenants(id,external_person_ref,label) VALUES($1,$2,$3),($4,$5,$6),($7,$8,$9)',[
   tenantA,'person:owner','B0 test A',tenantB,'person:other','B0 test B',tenantDenied,'person:unassigned','B0 test C']);
  await admin.query(`INSERT INTO wealth_auth.tenant_memberships(tenant_id,subject_id,role)
  VALUES ($1,$2,'OWNER'),($1,$3,'VIEWER'),($4,$5,'OWNER'),($4,$6,'VIEWER')`,[
   tenantA,users.owner.subject,users.viewer.subject,tenantB,users.other.subject,users.readonly.subject]);
  for(const [tenant,subject,issuer] of [
   [tenantA,users.owner.subject,users.owner.issuer],[tenantA,users.viewer.subject,users.viewer.issuer],
   [tenantB,users.other.subject,users.other.issuer],[tenantB,users.readonly.subject,users.readonly.issuer]
  ]){
   await admin.query(`INSERT INTO wealth_auth.identity_bindings
    (tenant_id,issuer,subject_id,kernel_person_ref,proof_reference,verified_at)
    VALUES($1,$2,$3,$4,$5,now())`,[tenant,issuer,subject,'person:ci:'+subject,'ci-owner-binding-proof']);
  }
  api=createApp({pool:db,verifyBearer:async token=>{
   if(!users[token])fail(401,'INVALID_TOKEN','Invalid access token.');
   return users[token];
  }});
  await api.ready();
 });
 afterAll(async()=>{
  await api?.close();await db?.end();await admin?.end();
 });
 it('confirms the app role is not a superuser and cannot see registry rows',async()=>{
  const role=await db.query<{rolsuper:boolean;rolbypassrls:boolean}>('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  expect(role.rows[0]).toMatchObject({rolsuper:false,rolbypassrls:false});
  await expect(db.query('SELECT * FROM wealth_auth.tenants')).rejects.toThrow();
  const p=await db.query('SELECT COUNT(*)::int AS count FROM wealth_planning.goals');
  expect(p.rows[0].count).toBe(0);
 });
 it('rejects unauthenticated, unscoped, invalid tenant and non-member requests',async()=>{
  const noAuth=await api.inject({method:'GET',url:'/api/v1/wealth/capabilities',headers:{'x-wealth-tenant-id':tenantA}});
  expect(noAuth.statusCode).toBe(401);
  const invalid=await api.inject({method:'GET',url:'/api/v1/wealth/capabilities',headers:header(tenantA,'fake')});
  expect(invalid.statusCode).toBe(401);
  const badTenant=await api.inject({method:'GET',url:'/api/v1/wealth/capabilities',headers:header('invalid')});
  expect(badTenant.statusCode).toBe(400);
  const denied=await api.inject({method:'GET',url:'/api/v1/wealth/capabilities',headers:header(tenantB,'owner')});
  expect(denied.statusCode).toBe(403);
  const absent=await api.inject({method:'GET',url:'/api/v1/wealth/capabilities',headers:header(tenantDenied,'owner')});
  expect(absent.statusCode).toBe(403);
  const allowed=await api.inject({method:'GET',url:'/api/v1/wealth/capabilities',headers:header(tenantA,'viewer')});
  expect(allowed.statusCode).toBe(200);
  expect(allowed.json().modules.execution).toBe('disabled');
 });
 it('enforces profile owner role, creation version, ETag, idempotence and concurrency',async()=>{
  const absent=await api.inject({method:'GET',url:'/api/v1/wealth/profile',headers:header()});
  expect(absent.statusCode).toBe(404);
  const body={baseCurrency:'KES',wealthStage:'BUILDING',strategyNote:'No bank execution.'};
  const create=()=>api.inject({method:'PUT',url:'/api/v1/wealth/profile',headers:header(tenantA,'owner',{'if-match':'"0"','idempotency-key':'profile-b0-a'}),payload:body});
  const first=await create();
  expect(first.statusCode).toBe(201);
  expect(first.headers.etag).toBe('"1"');
  expect((await create()).json()).toEqual(first.json());
  const viewer=await api.inject({method:'PUT',url:'/api/v1/wealth/profile',headers:header(tenantA,'viewer',{'if-match':'"1"','idempotency-key':'profile-b0-viewer'}),payload:body});
  expect(viewer.statusCode).toBe(403);
  const second=await api.inject({method:'PUT',url:'/api/v1/wealth/profile',headers:header(tenantA,'owner',{'if-match':'"1"','idempotency-key':'profile-b0-update'}),payload:{...body,wealthStage:'GROWING'}});
  expect(second.statusCode).toBe(200);expect(second.headers.etag).toBe('"2"');
  const stale=await api.inject({method:'PUT',url:'/api/v1/wealth/profile',headers:header(tenantA,'owner',{'if-match':'"1"','idempotency-key':'profile-b0-stale'}),payload:body});
  expect(stale.statusCode).toBe(409);
  const cross=await api.inject({method:'GET',url:'/api/v1/wealth/profile',headers:header(tenantB,'other')});
  expect(cross.statusCode).toBe(404);
 });
 it('creates durable goal, rejects unauthorized write and logs audit/outbox exactly once',async()=>{
  const body=newGoal();
  const post=()=>api.inject({method:'POST',url:'/api/v1/wealth/goals',headers:header(tenantA,'owner',{'idempotency-key':'goal-a-primary'}),payload:body});
  const created=await post();expect(created.statusCode).toBe(201);
  firstGoal=created.json().data.id;
  expect(created.headers.etag).toBe('"1"');
  expect(created.headers.location).toBe('/api/v1/wealth/goals/'+firstGoal);
  const again=await post();expect(again.statusCode).toBe(201);expect(again.json().data.id).toBe(firstGoal);
  const viewer=await api.inject({method:'POST',url:'/api/v1/wealth/goals',headers:header(tenantA,'viewer',{'idempotency-key':'goal-viewer-dont-write'}),payload:newGoal('Not allowed')});
  expect(viewer.statusCode).toBe(403);
  const noWriteScope=await api.inject({method:'POST',url:'/api/v1/wealth/goals',headers:header(tenantB,'readonly',{'idempotency-key':'goal-readonly-dont-write'}),payload:newGoal('Not allowed')});
  expect(noWriteScope.statusCode).toBe(403);
  const audit=await admin.query('SELECT COUNT(*)::int AS count FROM wealth_audit.audit_events WHERE tenant_id=$1 AND event_type=$2',[tenantA,'wealth.goal.created']);
  const outbox=await admin.query('SELECT COUNT(*)::int AS count FROM wealth_integration.outbox_events WHERE tenant_id=$1 AND event_type=$2',[tenantA,'wealth.goal.created']);
  expect(audit.rows[0].count).toBe(1);expect(outbox.rows[0].count).toBe(1);
 });
 it('does not allow cross-tenant goal visibility even with a valid token',async()=>{
  const hidden=await api.inject({method:'GET',url:'/api/v1/wealth/goals/'+firstGoal,headers:header(tenantB,'other')});
  expect(hidden.statusCode).toBe(404);
  const list=await api.inject({method:'GET',url:'/api/v1/wealth/goals',headers:header(tenantB,'other')});
  expect(list.statusCode).toBe(200);expect(list.json().data).toHaveLength(0);
  const userMismatch=await api.inject({method:'GET',url:'/api/v1/wealth/goals/'+firstGoal,headers:header(tenantB,'owner')});
  expect(userMismatch.statusCode).toBe(403);
  const authorized=await api.inject({method:'GET',url:'/api/v1/wealth/goals/'+firstGoal,headers:header(tenantA,'viewer')});
  expect(authorized.statusCode).toBe(200);
 });
 it('implements optimistic PATCH with strong If-Match and idempotency conflict checks',async()=>{
  const noIf=await api.inject({method:'PATCH',url:'/api/v1/wealth/goals/'+firstGoal,
   headers:header(tenantA,'owner',{'idempotency-key':'goal-patch-no-etag'}),payload:{title:'New title'}});
  expect(noIf.statusCode).toBe(428);
  const change=()=>api.inject({method:'PATCH',url:'/api/v1/wealth/goals/'+firstGoal,
   headers:header(tenantA,'owner',{'idempotency-key':'goal-patch-unique','if-match':'"1"'}),payload:{title:'New title'}});
  const first=await change();expect(first.statusCode).toBe(200);expect(first.headers.etag).toBe('"2"');
  expect((await change()).json()).toEqual(first.json());
  const conflict=await api.inject({method:'PATCH',url:'/api/v1/wealth/goals/'+firstGoal,
   headers:header(tenantA,'owner',{'idempotency-key':'goal-patch-different','if-match':'"1"'}),payload:{title:'Lost edit'}});
  expect(conflict.statusCode).toBe(409);
  const differentPayload=await api.inject({method:'PATCH',url:'/api/v1/wealth/goals/'+firstGoal,
   headers:header(tenantA,'owner',{'idempotency-key':'goal-patch-unique','if-match':'"1"'}),payload:{title:'Changed with reused key'}});
  expect(differentPayload.statusCode).toBe(409);
 });
 it('rejects invalid money, impossible dates, conflicting key and malformed cursor',async()=>{
  const invalid=await api.inject({method:'POST',url:'/api/v1/wealth/goals',headers:header(tenantA,'owner',{'idempotency-key':'goal-bad-input'}),payload:{...newGoal(),targetAmount:'-50'}});
  expect(invalid.statusCode).toBe(400);
  const invalidDate=await api.inject({method:'POST',url:'/api/v1/wealth/goals',headers:header(tenantA,'owner',{'idempotency-key':'goal-bad-date'}),payload:{...newGoal(),targetDate:'2026-02-30'}});
  expect(invalidDate.statusCode).toBe(400);
  const keyConflict=await api.inject({method:'POST',url:'/api/v1/wealth/goals',headers:header(tenantA,'owner',{'idempotency-key':'goal-a-primary'}),payload:newGoal('Another with same key')});
  expect(keyConflict.statusCode).toBe(409);
  const cursor=await api.inject({method:'GET',url:'/api/v1/wealth/goals?cursor=%%%25',headers:header()});
  expect(cursor.statusCode).toBe(400);
  expect(cursor.json().error).toHaveProperty('correlation_id');
 });
 it('supports keyset pagination and storage across API lifecycle',async()=>{
  for(let i=0;i<3;i++){
   const created=await api.inject({method:'POST',url:'/api/v1/wealth/goals',headers:header(tenantA,'owner',{'idempotency-key':'goal-pagination-'+i}),payload:newGoal('Goal page '+i)});
   expect(created.statusCode).toBe(201);
  }
  const first=await api.inject({method:'GET',url:'/api/v1/wealth/goals?limit=2',headers:header()});
  expect(first.statusCode).toBe(200);
  expect(first.json().data).toHaveLength(2);
  expect(first.json().page.nextCursor).toBeTruthy();
  const second=await api.inject({method:'GET',url:'/api/v1/wealth/goals?limit=2&cursor='+encodeURIComponent(first.json().page.nextCursor),headers:header()});
  expect(second.statusCode).toBe(200);
  expect(second.json().data).toHaveLength(2);
  const ids=[...first.json().data,...second.json().data].map((r:{id:string})=>r.id);
  expect(new Set(ids).size).toBe(4);
 });
 it('FORCE RLS hides another tenant even when calling SQL as the app role directly',async()=>{
  // Without subject/tenant context every tenant-scoped table returns zero rows.
  const raw=await db.query('SELECT COUNT(*)::int AS count FROM wealth_planning.goals');
  expect(raw.rows[0].count).toBe(0);
  const amount=await withTenant(db,users.owner,tenantA,async({client})=>{
   const r=await client.query('SELECT COUNT(*)::int AS count FROM wealth_planning.goals');
   return r.rows[0].count as number;
  });
  expect(amount).toBe(4);
  const other=await withTenant(db,users.other,tenantB,async({client})=>{
   const r=await client.query('SELECT COUNT(*)::int AS count FROM wealth_planning.goals');
   return r.rows[0].count as number;
  });
  expect(other).toBe(0);
  const after=await db.query('SELECT COUNT(*)::int AS count FROM wealth_planning.goals');
  expect(after.rows[0].count).toBe(0);
 });
});
