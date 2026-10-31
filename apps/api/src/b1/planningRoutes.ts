import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {withTenant,requireMemberWrite} from '../db.js';
import {etagFor,expectedVersion,uuid} from '../contracts.js';
import {fail} from '../errors.js';
import {milestoneCreate,milestonePatch,strategyInput,strategyEdit} from '../domainContracts.js';
import type {B1Tools} from './bridge.js';
const msSelect=`SELECT id,tenant_id AS "tenantId",goal_id AS "goalId",
title,target_amount::text AS "targetAmount",due_date::text AS "dueDate",
status,version::text AS version,created_at AS "createdAt",updated_at AS "updatedAt"
FROM wealth_planning.goal_milestones`;
const strategySelect=`SELECT h.strategy_id AS id,h.tenant_id AS "tenantId",h.goal_id AS "goalId",
 h.latest_version AS "latestVersion",h.active_version AS "activeVersion",
 v.name,v.thesis,v.allocation_targets AS "allocationTargets",v.assumptions,v.status,
 v.created_at AS "createdAt" FROM wealth_planning.strategy_heads h
 JOIN wealth_planning.strategy_versions v
 ON v.tenant_id=h.tenant_id AND v.strategy_id=h.strategy_id AND v.version=h.latest_version`;
const detailVersion=`SELECT strategy_id AS id,version,goal_id AS "goalId",name,thesis,
allocation_targets AS "allocationTargets",assumptions,status,created_at AS "createdAt"
FROM wealth_planning.strategy_versions`;
const toUnits=(decimal:string):bigint=>{
 const [whole,fraction='']=decimal.split('.');
 return BigInt(whole)*10000n+BigInt(fraction.padEnd(4,'0'));
};
const dateCheck=(due:string,goalDate:Date|string,amount:string,target:string)=>{
 if(due>String(goalDate).slice(0,10))fail(422,'MILESTONE_BEYOND_GOAL','Milestone date must be on or before the goal target date.');
 if(toUnits(amount)>toUnits(target))fail(422,'MILESTONE_EXCEEDS_GOAL','Milestone amount must not exceed the goal target.');
};
const forGoal=(request:{params:unknown})=>uuid.parse((request.params as {id:string}).id);
export function registerPlanningRoutes(app:FastifyInstance,pool:Pool,t:B1Tools){
 app.get('/api/v1/wealth/goals/:id/milestones',async request=>{
  const {principal,tenantId}=t.authFor(request),goalId=forGoal(request);
  return withTenant(pool,principal,tenantId,async ({client})=>{
   const goal=await client.query('SELECT 1 FROM wealth_planning.goals WHERE tenant_id=$1 AND id=$2',[tenantId,goalId]);
   if(!goal.rowCount)fail(404,'GOAL_NOT_FOUND','The goal does not exist for this tenant.');
   const result=await client.query(msSelect+' WHERE tenant_id=$1 AND goal_id=$2 ORDER BY due_date,id',[tenantId,goalId]);
   return {data:result.rows};
  });
 });
 app.post('/api/v1/wealth/goals/:id/milestones',async (request,reply)=>{
  const {principal,tenantId}=t.authFor(request),goalId=forGoal(request);
  const input=milestoneCreate.parse(request.body);
  const response=await withTenant(pool,principal,tenantId,async ctx=>{
   requireMemberWrite(ctx.role,'GOAL');
   return t.idempotent(ctx,request,input,async()=>{
    const g=await ctx.client.query<{target_amount:string;target_date:Date|string}>(
     'SELECT target_amount::text,target_date::text FROM wealth_planning.goals WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,goalId]);
    if(!g.rowCount)fail(404,'GOAL_NOT_FOUND','The goal does not exist for this tenant.');
    dateCheck(input.dueDate,g.rows[0].target_date,input.targetAmount,g.rows[0].target_amount);
    const id=randomUUID();
    const r=await ctx.client.query(`INSERT INTO wealth_planning.goal_milestones
     (id,tenant_id,goal_id,title,target_amount,due_date,created_by_subject)
     VALUES($1,$2,$3,$4,$5::numeric,$6::date,$7) RETURNING
     id,tenant_id AS "tenantId",goal_id AS "goalId",title,target_amount::text AS "targetAmount",
     due_date::text AS "dueDate",status,version::text AS version,created_at AS "createdAt",updated_at AS "updatedAt"`,
     [id,tenantId,goalId,input.title,input.targetAmount,input.dueDate,principal.subject]);
    const record=r.rows[0] as Record<string,unknown>;
    await t.audit(ctx,request,'wealth_milestone',id,'wealth.milestone.created',null,{version:record.version});
    return {status:201,body:{data:record},headers:{Location:'/api/v1/wealth/goals/'+goalId+'/milestones/'+id,ETag:etagFor(String(record.version))}};
   });
  });
  return t.result(reply,response);
 });
 app.patch('/api/v1/wealth/goals/:id/milestones/:milestoneId',async (request,reply)=>{
  const {principal,tenantId}=t.authFor(request);
  const goalId=forGoal(request),id=uuid.parse((request.params as {milestoneId:string}).milestoneId);
  const input=milestonePatch.parse(request.body),version=expectedVersion(request.headers['if-match']);
  const response=await withTenant(pool,principal,tenantId,async ctx=>{
   requireMemberWrite(ctx.role,'GOAL');
   return t.idempotent(ctx,request,{...input,version},async()=>{
    const g=await ctx.client.query<{target_amount:string;target_date:string}>(
     'SELECT target_amount::text,target_date::text FROM wealth_planning.goals WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,goalId]);
    if(!g.rowCount)fail(404,'GOAL_NOT_FOUND','Goal not found.');
    const old=await ctx.client.query<{version:string;targetAmount:string;dueDate:string}>(
     msSelect+' WHERE tenant_id=$1 AND goal_id=$2 AND id=$3 FOR UPDATE',[tenantId,goalId,id]);
    if(!old.rowCount)fail(404,'MILESTONE_NOT_FOUND','Milestone not found.');
    if(Number(old.rows[0].version)!==version)fail(409,'VERSION_CONFLICT','Milestone changed; reload it.');
    dateCheck(input.dueDate??old.rows[0].dueDate,g.rows[0].target_date,input.targetAmount??old.rows[0].targetAmount,g.rows[0].target_amount);
    const r=await ctx.client.query(`UPDATE wealth_planning.goal_milestones SET
     title=COALESCE($4::text,title),target_amount=COALESCE($5::numeric,target_amount),
     due_date=COALESCE($6::date,due_date),status=COALESCE($7::text,status),
     version=version+1,updated_at=now()
     WHERE tenant_id=$1 AND goal_id=$2 AND id=$3 AND version=$8
     RETURNING id,tenant_id AS "tenantId",goal_id AS "goalId",title,
     target_amount::text AS "targetAmount",due_date::text AS "dueDate",
     status,version::text AS version,created_at AS "createdAt",updated_at AS "updatedAt"`,
     [tenantId,goalId,id,input.title??null,input.targetAmount??null,input.dueDate??null,input.status??null,version]);
    if(!r.rowCount)fail(409,'VERSION_CONFLICT','Milestone changed; reload it.');
    const record=r.rows[0] as Record<string,unknown>;
    await t.audit(ctx,request,'wealth_milestone',id,'wealth.milestone.updated',
     {version:old.rows[0].version},{version:record.version});
    return {status:200,body:{data:record},headers:{ETag:etagFor(String(record.version))}};
   });
  });
  return t.result(reply,response);
 });
 app.get('/api/v1/wealth/strategies',async request=>{
  const {principal,tenantId}=t.authFor(request);
  return withTenant(pool,principal,tenantId,async ({client})=>{
   const r=await client.query(strategySelect+' WHERE h.tenant_id=$1 ORDER BY h.created_at DESC,h.strategy_id DESC LIMIT 200',[tenantId]);
   return {data:r.rows};
  });
 });
 app.get('/api/v1/wealth/strategies/:id',async request=>{
  const {principal,tenantId}=t.authFor(request),id=uuid.parse((request.params as {id:string}).id);
  return withTenant(pool,principal,tenantId,async({client})=>{
   const current=await client.query(strategySelect+' WHERE h.tenant_id=$1 AND h.strategy_id=$2',[tenantId,id]);
   if(!current.rowCount)fail(404,'STRATEGY_NOT_FOUND','The strategy does not exist in this tenant.');
   const versions=await client.query(detailVersion+' WHERE tenant_id=$1 AND strategy_id=$2 ORDER BY version DESC',[tenantId,id]);
   return {data:current.rows[0],versions:versions.rows};
  });
 });
 app.post('/api/v1/wealth/strategies',async (request,reply)=>{
  const {principal,tenantId}=t.authFor(request),input=strategyInput.parse(request.body);
  const response=await withTenant(pool,principal,tenantId,async ctx=>{
   requireMemberWrite(ctx.role,'GOAL');
   return t.idempotent(ctx,request,input,async()=>{
    const goal=await ctx.client.query('SELECT 1 FROM wealth_planning.goals WHERE tenant_id=$1 AND id=$2 AND status=$3 FOR UPDATE',[tenantId,input.goalId,'ACTIVE']);
    if(!goal.rowCount)fail(422,'GOAL_NOT_ACTIVE','An active owned wealth goal is required.');
    const id=randomUUID();
    await ctx.client.query(`INSERT INTO wealth_planning.strategy_versions
      (tenant_id,strategy_id,version,goal_id,name,thesis,allocation_targets,assumptions,status,created_by_subject)
      VALUES($1,$2,1,$3,$4,$5,$6::jsonb,$7::jsonb,'DRAFT',$8)`,
      [tenantId,id,input.goalId,input.name,input.thesis,JSON.stringify(input.allocationTargets),JSON.stringify(input.assumptions),principal.subject]);
    await ctx.client.query(`INSERT INTO wealth_planning.strategy_heads
      (tenant_id,strategy_id,goal_id,latest_version) VALUES($1,$2,$3,1)`,[tenantId,id,input.goalId]);
    const rec=await ctx.client.query(strategySelect+' WHERE h.tenant_id=$1 AND h.strategy_id=$2',[tenantId,id]);
    await t.audit(ctx,request,'wealth_strategy',id,'wealth.strategy.drafted',null,{version:'1'});
    return {status:201,body:{data:rec.rows[0] as Record<string,unknown>},headers:{Location:'/api/v1/wealth/strategies/'+id,ETag:etagFor(1)}};
   });
  });
  return t.result(reply,response);
 });
 app.post('/api/v1/wealth/strategies/:id/versions',async (request,reply)=>{
  const {principal,tenantId}=t.authFor(request),id=uuid.parse((request.params as {id:string}).id);
  const input=strategyEdit.parse(request.body),version=expectedVersion(request.headers['if-match']);
  const response=await withTenant(pool,principal,tenantId,async ctx=>{
   requireMemberWrite(ctx.role,'GOAL');
   return t.idempotent(ctx,request,{...input,version},async()=>{
    const h=await ctx.client.query<{latest_version:number;goal_id:string}>(
     'SELECT latest_version,goal_id FROM wealth_planning.strategy_heads WHERE tenant_id=$1 AND strategy_id=$2 FOR UPDATE',[tenantId,id]);
    if(!h.rowCount)fail(404,'STRATEGY_NOT_FOUND','Strategy not found.');
    if(h.rows[0].latest_version!==version)fail(409,'VERSION_CONFLICT','Strategy has a newer version.');
    const next=version+1;
    await ctx.client.query(`INSERT INTO wealth_planning.strategy_versions
     (tenant_id,strategy_id,version,goal_id,name,thesis,allocation_targets,assumptions,status,created_by_subject)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,'DRAFT',$9)`,
     [tenantId,id,next,h.rows[0].goal_id,input.name,input.thesis,JSON.stringify(input.allocationTargets),JSON.stringify(input.assumptions),principal.subject]);
    await ctx.client.query('UPDATE wealth_planning.strategy_heads SET latest_version=$3,updated_at=now() WHERE tenant_id=$1 AND strategy_id=$2',[tenantId,id,next]);
    const r=await ctx.client.query(strategySelect+' WHERE h.tenant_id=$1 AND h.strategy_id=$2',[tenantId,id]);
    await t.audit(ctx,request,'wealth_strategy',id,'wealth.strategy.revised',{version:String(version)},{version:String(next)});
    return {status:201,body:{data:r.rows[0] as Record<string,unknown>},headers:{ETag:etagFor(next)}};
   });
  });
  return t.result(reply,response);
 });
 app.post('/api/v1/wealth/strategies/:id/activate',async (request,reply)=>{
  const {principal,tenantId}=t.authFor(request),id=uuid.parse((request.params as {id:string}).id);
  const version=expectedVersion(request.headers['if-match']);
  if(request.body!==undefined && (typeof request.body!=='object'||request.body===null||Object.keys(request.body).length>0)){
   fail(400,'INVALID_INPUT','Activation request body must be an empty object.');
  }
  const response=await withTenant(pool,principal,tenantId,async ctx=>{
   requireMemberWrite(ctx.role,'GOAL');
   return t.idempotent(ctx,request,{version},async()=>{
    // Lock goal before head to serialize activating *different* strategies for the same goal.
    const info=await ctx.client.query<{goal_id:string}>(
     'SELECT goal_id FROM wealth_planning.strategy_heads WHERE tenant_id=$1 AND strategy_id=$2',[tenantId,id]);
    if(!info.rowCount)fail(404,'STRATEGY_NOT_FOUND','Strategy not found.');
    const goal=await ctx.client.query('SELECT id FROM wealth_planning.goals WHERE tenant_id=$1 AND id=$2 AND status=$3 FOR UPDATE',[tenantId,info.rows[0].goal_id,'ACTIVE']);
    if(!goal.rowCount)fail(422,'GOAL_NOT_ACTIVE','The linked goal is no longer active.');
    const head=await ctx.client.query<{latest_version:number;goal_id:string}>(
     'SELECT latest_version,goal_id FROM wealth_planning.strategy_heads WHERE tenant_id=$1 AND strategy_id=$2 FOR UPDATE',[tenantId,id]);
    if(head.rows[0].latest_version!==version)fail(409,'VERSION_CONFLICT','Strategy version changed; reload.');
    const other=await ctx.client.query(`SELECT strategy_id FROM wealth_planning.strategy_heads
      WHERE tenant_id=$1 AND goal_id=$2 AND strategy_id<>$3 AND active_version IS NOT NULL LIMIT 1`,
      [tenantId,head.rows[0].goal_id,id]);
    if(other.rowCount)fail(409,'ACTIVE_STRATEGY_EXISTS','This wealth goal already has another active strategy.');
    const previous=await ctx.client.query<{status:string;name:string;thesis:string;allocation_targets:unknown;assumptions:unknown}>(
     `SELECT status,name,thesis,allocation_targets,assumptions
      FROM wealth_planning.strategy_versions WHERE tenant_id=$1 AND strategy_id=$2 AND version=$3`,
      [tenantId,id,version]);
    if(!previous.rowCount||previous.rows[0].status!=='DRAFT')fail(409,'NOT_DRAFT','Only a latest draft can be activated.');
    const next=version+1;
    const source=previous.rows[0];
    await ctx.client.query(`INSERT INTO wealth_planning.strategy_versions
     (tenant_id,strategy_id,version,goal_id,name,thesis,allocation_targets,assumptions,status,created_by_subject)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,'ACTIVE',$9)`,
     [tenantId,id,next,head.rows[0].goal_id,source.name,source.thesis,JSON.stringify(source.allocation_targets),JSON.stringify(source.assumptions),principal.subject]);
    await ctx.client.query(`UPDATE wealth_planning.strategy_heads SET latest_version=$3,active_version=$3,updated_at=now()
      WHERE tenant_id=$1 AND strategy_id=$2`,[tenantId,id,next]);
    const r=await ctx.client.query(strategySelect+' WHERE h.tenant_id=$1 AND h.strategy_id=$2',[tenantId,id]);
    await t.audit(ctx,request,'wealth_strategy',id,'wealth.strategy.activated',{version:String(version)},{version:String(next)});
    return {status:200,body:{data:r.rows[0] as Record<string,unknown>},headers:{ETag:etagFor(next)}};
   });
  });
  return t.result(reply,response);
 });
}
