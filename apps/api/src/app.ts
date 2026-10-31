import Fastify from 'fastify';
import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify';
import {createHash,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {ZodError,z} from 'zod';
import type {VerifyBearer,Principal} from './auth.js';
import {hasScope} from './auth.js';
import {withTenant,requireMemberWrite} from './db.js';
import type {TenantContext} from './db.js';
import {ApiFailure,fail} from './errors.js';
import {tenantHeader,profileInput,createGoalInput,updateGoalInput,uuid,etagFor,expectedVersion,cursorParse,cursorEncode} from './contracts.js';
import {registerPlanningRoutes} from './b1/planningRoutes.js';
import {registerCapitalRoutes} from './b1/capitalRoutes.js';
import {registerProjectionRoutes} from './b1/projectionRoutes.js';

export interface AppDeps {pool:Pool;verifyBearer:VerifyBearer;allowedOrigins?:readonly string[]}
type AuthRequest=FastifyRequest & {principal?:Principal;wealthTenantId?:string};
type HttpResult={status:number;body:Record<string,unknown>;headers?:Record<string,string>};
const profileSelect=`SELECT tenant_id AS "tenantId",base_currency AS "baseCurrency",
wealth_stage AS "wealthStage",strategy_note AS "strategyNote",
version::text AS version,updated_at AS "updatedAt" FROM wealth_core.wealth_profiles`;
const goalSelect=`SELECT id,tenant_id AS "tenantId",title,metric,target_amount::text AS "targetAmount",
target_date::text AS "targetDate",priority,status,version::text AS version,
created_at AS "createdAt",updated_at AS "updatedAt" FROM wealth_planning.goals`;
const keySchema=z.string().min(8).max(128).regex(/^[a-zA-Z0-9:_-]+$/);
function authFor(request:FastifyRequest):{principal:Principal;tenantId:string}{
 const req=request as AuthRequest;
 if(!req.principal||!req.wealthTenantId)fail(401,'AUTH_REQUIRED','Verified identity and tenant membership are required.');
 return {principal:req.principal,tenantId:req.wealthTenantId};
}
function result(reply:FastifyReply,value:HttpResult){
 for(const [name,val] of Object.entries(value.headers??{}))reply.header(name,val);
 return reply.code(value.status).send(value.body);
}
function stripIfInvalid(error:unknown):ApiFailure{
 if(error instanceof ApiFailure)return error;
 if(error instanceof ZodError)return new ApiFailure(400,'INVALID_INPUT','Request validation failed.',{
  fields:error.issues.map(i=>({path:i.path.join('.'),message:i.message})).slice(0,12)
 });
 return new ApiFailure(500,'INTERNAL_ERROR','An unexpected server error occurred.');
}
function writeAuditAndEvent(ctx:TenantContext,request:FastifyRequest,aggregate:string,id:string,eventType:string,prior:unknown,next:unknown){
 const q=ctx.client,correlationId=request.id;
 return Promise.all([
  q.query(`INSERT INTO wealth_audit.audit_events
   (tenant_id,event_type,actor_subject,correlation_id,aggregate_type,aggregate_id,before_state,after_state)
   VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,
   [ctx.tenantId,eventType,ctx.principal.subject,correlationId,aggregate,id,prior===null?null:JSON.stringify(prior),JSON.stringify(next)]),
  q.query(`INSERT INTO wealth_integration.outbox_events
   (tenant_id,event_type,event_version,correlation_id,actor_subject,payload)
   VALUES($1,$2,1,$3,$4,$5::jsonb)`,
   [ctx.tenantId,eventType,correlationId,ctx.principal.subject,JSON.stringify({tenantId:ctx.tenantId,aggregate,id,version:(next as {version:string}).version})])
 ]);
}
async function idempotent(ctx:TenantContext,request:FastifyRequest,body:unknown,run:()=>Promise<HttpResult>):Promise<HttpResult>{
 const raw=request.headers['idempotency-key'];
 const valid=keySchema.safeParse(raw);
 if(!valid.success)fail(428,'IDEMPOTENCY_KEY_REQUIRED','Supply Idempotency-Key (8–128 alphanumeric, dash, underscore or colon).');
 const key=valid.data;
 const pathname=request.url.split('?')[0];
 const hash=createHash('sha256').update(JSON.stringify({method:request.method,path:pathname,ifMatch:request.headers['if-match']??null,body})).digest('hex');
 // INSERT+SELECT FOR UPDATE serializes concurrent requests with the same key.
 await ctx.client.query(`INSERT INTO wealth_integration.idempotency_keys(tenant_id,key,actor_subject,request_hash)
 VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[ctx.tenantId,key,ctx.principal.subject,hash]);
 const stored=await ctx.client.query<{
  actor_subject:string;request_hash:string;response_status:number|null;response_body:HttpResult['body']|null;
  response_headers:Record<string,string>|null;expires_at:Date
 }>(`SELECT actor_subject,request_hash,response_status,response_body,response_headers,expires_at
 FROM wealth_integration.idempotency_keys WHERE tenant_id=$1 AND key=$2 FOR UPDATE`,[ctx.tenantId,key]);
 if(stored.rowCount!==1)fail(500,'IDEMPOTENCY_ERROR','Unable to initialize idempotent request.');
 const row=stored.rows[0];
 if(row.actor_subject!==ctx.principal.subject||row.request_hash!==hash)fail(409,'IDEMPOTENCY_CONFLICT','This key was previously used with different actor, route or payload.');
 if(row.expires_at.getTime()<Date.now())fail(409,'IDEMPOTENCY_EXPIRED','This idempotency key expired; use a fresh key.');
 if(row.response_status!==null){
  return {status:row.response_status,body:row.response_body??{},headers:row.response_headers??{}};
 }
 const response=await run();
 await ctx.client.query(`UPDATE wealth_integration.idempotency_keys
 SET response_status=$3,response_body=$4::jsonb,response_headers=$5::jsonb
 WHERE tenant_id=$1 AND key=$2`,
 [ctx.tenantId,key,response.status,JSON.stringify(response.body),JSON.stringify(response.headers??{})]);
 return response;
}
const pageQuery=z.object({limit:z.coerce.number().int().min(1).max(50).default(20),cursor:z.string().max(300).optional()}).strict();

export function createApp({pool,verifyBearer,allowedOrigins=[]}:AppDeps):FastifyInstance{
 const app=Fastify({bodyLimit:128*1024,genReqId:()=>randomUUID(),logger:false,trustProxy:false});
 app.addHook('onRequest',async(request,reply)=>{
  const origin=request.headers.origin;
  if(typeof origin!=='string'||!allowedOrigins.includes(origin))return;
  reply.header('Access-Control-Allow-Origin',origin);
  reply.header('Vary','Origin');
  reply.header('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,OPTIONS');
  reply.header('Access-Control-Allow-Headers','Authorization,Content-Type,X-Wealth-Tenant-Id,If-Match,Idempotency-Key');
  reply.header('Access-Control-Expose-Headers','ETag,Location');
  reply.header('Access-Control-Max-Age','600');
  if(request.method==='OPTIONS')return reply.status(204).send();
 });
 app.setErrorHandler((err,request,reply)=>{
  const failure=stripIfInvalid(err);
  reply.code(failure.status).send({error:{
   code:failure.code,message:failure.message,details:failure.details??{},correlation_id:request.id
  }});
 });
 app.addHook('preHandler',async request=>{
  if(!request.url.startsWith('/api/v1/wealth'))return;
  const header=request.headers.authorization;
  if(!header||!/^Bearer [^\s]+$/.test(header))fail(401,'AUTH_REQUIRED','A verified bearer access token is required.');
  const token=header.slice(7);
  const principal=await verifyBearer(token);
  const scope=request.method==='GET'?'wealth:read':'wealth:write';
  if(!hasScope(principal,scope))fail(403,'SCOPE_DENIED','The access token lacks the required Wealth OS capability.');
  const tenant=tenantHeader.safeParse(request.headers['x-wealth-tenant-id']);
  if(!tenant.success)fail(400,'TENANT_REQUIRED','A valid X-Wealth-Tenant-Id UUID is required.');
  const current=request as AuthRequest;
  current.principal=principal;
  current.wealthTenantId=tenant.data;
 });
 app.get('/health',async()=>({status:'ok',service:'wealth-os-api',stage:'B0'}));
 app.get('/ready',async(_request,reply)=>{
  try{await pool.query('SELECT 1');return {status:'ready',database:'reachable'}}
  catch{reply.code(503);return {status:'unavailable'}}
 });
 app.get('/api/v1/wealth/capabilities',async request=>{
  const {principal,tenantId}=authFor(request);
  return withTenant(pool,principal,tenantId,async()=>({
   stage:'B1',mode:'durable-planning-and-consent-gated-projections',
   modules:{profile:'durable',goals:'durable',milestones:'durable',strategies:'durable',capitalProposals:'durable-planning-only',portfolio:'consent-gated-read-only',income:'consent-gated-read-only',liabilities:'consent-gated-read-only',wealthState:'source-reconciliation-gated',forecast:'contract-only',execution:'disabled'},
   connectedSourceSystems:[],financialExecutionEnabled:false,frontendConnected:'configured-per-environment'
  }));
 });
 app.get('/api/v1/wealth/profile',async (request,reply)=>{
  const {principal,tenantId}=authFor(request);
  const value=await withTenant(pool,principal,tenantId,async ({client})=>{
   const q=await client.query(profileSelect+' WHERE tenant_id=$1',[tenantId]);
   if(!q.rows.length)fail(404,'PROFILE_NOT_FOUND','No Wealth OS profile has been created for this tenant.');
   return q.rows[0] as Record<string,unknown>;
  });
  reply.header('ETag',etagFor(String(value.version)));
  return {data:value};
 });
 app.put('/api/v1/wealth/profile',async (request,reply)=>{
  const {principal,tenantId}=authFor(request);
  const input=profileInput.parse(request.body);
  const version=expectedVersion(request.headers['if-match']);
  const response=await withTenant(pool,principal,tenantId,async ctx=>{
   requireMemberWrite(ctx.role,'PROFILE');
   return idempotent(ctx,request,input,async()=>{
    const existing=await ctx.client.query(profileSelect+' WHERE tenant_id=$1 FOR UPDATE',[tenantId]);
    if(!existing.rows.length&&version!==0)fail(409,'VERSION_CONFLICT','New profile requires If-Match: "0".');
    if(existing.rows.length&&Number(existing.rows[0].version)!==version)fail(409,'VERSION_CONFLICT','Profile has changed; reload before editing.');
    const updated=existing.rows.length?
     await ctx.client.query(`UPDATE wealth_core.wealth_profiles SET base_currency=$2,wealth_stage=$3,strategy_note=$4,
      version=version+1,updated_at=now() WHERE tenant_id=$1 RETURNING
      tenant_id AS "tenantId",base_currency AS "baseCurrency",wealth_stage AS "wealthStage",
      strategy_note AS "strategyNote",version::text AS version,updated_at AS "updatedAt"`,
      [tenantId,input.baseCurrency,input.wealthStage,input.strategyNote]):
     await ctx.client.query(`INSERT INTO wealth_core.wealth_profiles
      (tenant_id,base_currency,wealth_stage,strategy_note)
      VALUES($1,$2,$3,$4) RETURNING tenant_id AS "tenantId",base_currency AS "baseCurrency",
      wealth_stage AS "wealthStage",strategy_note AS "strategyNote",version::text AS version,updated_at AS "updatedAt"`,
      [tenantId,input.baseCurrency,input.wealthStage,input.strategyNote]);
    const record=updated.rows[0] as Record<string,unknown>;
    const old=existing.rows.length?{version:existing.rows[0].version}:null;
    await writeAuditAndEvent(ctx,request,'wealth_profile',tenantId,old?'wealth.profile.updated':'wealth.profile.created',old,{version:record.version});
    return {status:existing.rows.length?200:201,body:{data:record},headers:{ETag:etagFor(String(record.version))}};
   });
  });
  return result(reply,response);
 });
 app.get('/api/v1/wealth/goals',async (request)=>{
  const {principal,tenantId}=authFor(request);
  const query=pageQuery.parse(request.query),cursor=cursorParse(query.cursor);
  return withTenant(pool,principal,tenantId,async ({client})=>{
   const r=await client.query(`${goalSelect} WHERE tenant_id=$1
    AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid))
    ORDER BY created_at DESC,id DESC LIMIT $4`,
    [tenantId,cursor?.at??null,cursor?.id??null,query.limit+1]);
   const more=r.rows.length>query.limit;
   const data=r.rows.slice(0,query.limit) as Array<Record<string,unknown> & {createdAt:Date|string;id:string}>;
   const last=data.at(-1);
   return {data,page:{limit:query.limit,nextCursor:more&&last?cursorEncode({created_at:last.createdAt,id:last.id}):null}};
  });
 });
 app.get('/api/v1/wealth/goals/:id',async (request,reply)=>{
  const {principal,tenantId}=authFor(request);
  const id=uuid.parse((request.params as {id:string}).id);
  const value=await withTenant(pool,principal,tenantId,async ({client})=>{
   const r=await client.query(goalSelect+' WHERE tenant_id=$1 AND id=$2',[tenantId,id]);
   if(!r.rows.length)fail(404,'GOAL_NOT_FOUND','This wealth goal does not exist in the authorized tenant.');
   return r.rows[0] as Record<string,unknown>;
  });
  reply.header('ETag',etagFor(String(value.version)));
  return {data:value};
 });
 app.post('/api/v1/wealth/goals',async (request,reply)=>{
  const {principal,tenantId}=authFor(request),input=createGoalInput.parse(request.body);
  const response=await withTenant(pool,principal,tenantId,async ctx=>{
   requireMemberWrite(ctx.role,'GOAL');
   return idempotent(ctx,request,input,async()=>{
    const id=randomUUID();
    const r=await ctx.client.query(`INSERT INTO wealth_planning.goals
     (id,tenant_id,title,metric,target_amount,target_date,priority,created_by_subject)
     VALUES($1,$2,$3,$4,$5::numeric,$6::date,$7,$8) RETURNING
     id,tenant_id AS "tenantId",title,metric,target_amount::text AS "targetAmount",
     target_date::text AS "targetDate",priority,status,version::text AS version,
     created_at AS "createdAt",updated_at AS "updatedAt"`,
     [id,tenantId,input.title,input.metric,input.targetAmount,input.targetDate,input.priority,principal.subject]);
    const record=r.rows[0] as Record<string,unknown>;
    await writeAuditAndEvent(ctx,request,'wealth_goal',id,'wealth.goal.created',null,{version:record.version});
    return {status:201,body:{data:record},headers:{Location:'/api/v1/wealth/goals/'+id,ETag:etagFor(String(record.version))}};
   });
  });
  return result(reply,response);
 });
 app.patch('/api/v1/wealth/goals/:id',async (request,reply)=>{
  const {principal,tenantId}=authFor(request);
  const id=uuid.parse((request.params as {id:string}).id);
  const input=updateGoalInput.parse(request.body);
  const expected=expectedVersion(request.headers['if-match']);
  const response=await withTenant(pool,principal,tenantId,async ctx=>{
   requireMemberWrite(ctx.role,'GOAL');
   return idempotent(ctx,request,input,async()=>{
    const before=await ctx.client.query(goalSelect+' WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,id]);
    if(!before.rows.length)fail(404,'GOAL_NOT_FOUND','This wealth goal does not exist in the authorized tenant.');
    if(Number(before.rows[0].version)!==expected)fail(409,'VERSION_CONFLICT','Goal version changed; reload before editing.');
    const r=await ctx.client.query(`UPDATE wealth_planning.goals SET
      title=COALESCE($3::text,title),metric=COALESCE($4::text,metric),
      target_amount=COALESCE($5::numeric,target_amount),target_date=COALESCE($6::date,target_date),
      priority=COALESCE($7::text,priority),status=COALESCE($8::text,status),
      version=version+1,updated_at=now()
      WHERE tenant_id=$1 AND id=$2 AND version=$9 RETURNING
      id,tenant_id AS "tenantId",title,metric,target_amount::text AS "targetAmount",
      target_date::text AS "targetDate",priority,status,version::text AS version,
      created_at AS "createdAt",updated_at AS "updatedAt"`,
      [tenantId,id,input.title??null,input.metric??null,input.targetAmount??null,
       input.targetDate??null,input.priority??null,input.status??null,expected]);
    if(!r.rows.length)fail(409,'VERSION_CONFLICT','Goal version changed; reload before editing.');
    const record=r.rows[0] as Record<string,unknown>;
    await writeAuditAndEvent(ctx,request,'wealth_goal',id,'wealth.goal.updated',
     {version:before.rows[0].version},{version:record.version});
    return {status:200,body:{data:record},headers:{ETag:etagFor(String(record.version))}};
   });
  });
  return result(reply,response);
 });
 const tools={authFor,idempotent,audit:writeAuditAndEvent,result};
 registerPlanningRoutes(app,pool,tools);
 registerCapitalRoutes(app,pool,tools);
 registerProjectionRoutes(app,pool,tools);
 return app;
}
