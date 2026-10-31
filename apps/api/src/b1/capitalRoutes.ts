import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {withTenant,requireMemberWrite} from '../db.js';
import {etagFor,expectedVersion,uuid} from '../contracts.js';
import {proposalInput} from '../domainContracts.js';
import {fail} from '../errors.js';
import type {B1Tools} from './bridge.js';

const poolSelect=`SELECT id,tenant_id AS "tenantId",name,purpose,source_system AS "sourceSystem",
 source_entity_ref AS "sourceEntityRef",source_as_of AS "sourceAsOf",
 classified_cash::text AS "classifiedCash",reserved_cash::text AS "reservedCash",
 committed_cash::text AS "committedCash",
 (classified_cash-reserved_cash-committed_cash)::text AS "uncommittedCash",
 version::text AS version,
 (source_as_of IS NOT NULL AND source_entity_ref IS NOT NULL AND
 source_as_of >= now()-interval '24 hours' AND source_as_of <= now()+interval '5 minutes') AS "freshSource"
 FROM wealth_capital.pools`;
const proposalSelect=`SELECT id,tenant_id AS "tenantId",pool_id AS "poolId",target,amount::text AS amount,
 status,policy_version AS "policyVersion",version::text AS version,
 evidence_snapshot AS "evidenceSnapshot",created_at AS "createdAt",updated_at AS "updatedAt"
 FROM wealth_capital.allocation_proposals`;

export function registerCapitalRoutes(app:FastifyInstance,pool:Pool,t:B1Tools){
 app.get('/api/v1/wealth/capital/pools',async request=>{
  const {principal,tenantId}=t.authFor(request);
  return withTenant(pool,principal,tenantId,async ({client})=>{
   const r=await client.query(poolSelect+' WHERE tenant_id=$1 ORDER BY created_at,id LIMIT 200',[tenantId]);
   return {data:r.rows,notice:'Cash classifications only; the Finance OS is the authoritative balance owner.'};
  });
 });
 app.get('/api/v1/wealth/capital/proposals',async request=>{
  const {principal,tenantId}=t.authFor(request);
  return withTenant(pool,principal,tenantId,async ({client})=>{
   const r=await client.query(proposalSelect+' WHERE tenant_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200',[tenantId]);
   return {data:r.rows,notice:'Planning intent only. No funds held, transferred or deployed.'};
  });
 });
 app.post('/api/v1/wealth/capital/proposals',async (request,reply)=>{
  const {principal,tenantId}=t.authFor(request),input=proposalInput.parse(request.body);
  const version=expectedVersion(request.headers['if-match']);
  const response=await withTenant(pool,principal,tenantId,async ctx=>{
   requireMemberWrite(ctx.role,'GOAL');
   return t.idempotent(ctx,request,{...input,version},async()=>{
    // Serialize proposal affordability checks without UPDATE privileges on Finance OS source classifications.
    await ctx.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,31))',[tenantId+':'+input.poolId]);
    const r=await ctx.client.query<{id:string;version:string;freshSource:boolean;sourceEntityRef:string|null;sourceAsOf:Date|null;classifiedCash:string;reservedCash:string;committedCash:string;uncommittedCash:string}>(
     poolSelect+' WHERE tenant_id=$1 AND id=$2',[tenantId,input.poolId]);
    if(!r.rowCount)fail(404,'POOL_NOT_FOUND','Capital classification not found for this tenant.');
    const source=r.rows[0];
    if(Number(source.version)!==version)fail(409,'VERSION_CONFLICT','Finance-sourced capital data changed. Reload before creating an intent.');
    if(!source.freshSource)fail(422,'SOURCE_STALE','Fresh Finance OS cash evidence (within 24 hours) is required.');
    const policy=await ctx.client.query<{policy_version:number;rules:{maxProposalPercent?:number}}>(`SELECT policy_version,rules
      FROM wealth_core.wealth_policies WHERE tenant_id=$1 AND policy_kind='CAPITAL_PROPOSAL'
      AND effective_from<=now() AND (effective_until IS NULL OR effective_until>now())
      ORDER BY policy_version DESC LIMIT 1`,[tenantId]);
    if(!policy.rowCount)fail(422,'POLICY_MISSING','No authorized capital-proposal policy is effective for this tenant.');
    const pct=policy.rows[0].rules?.maxProposalPercent;
    if(typeof pct!=='number'||!Number.isFinite(pct)||pct<=0||pct>100)fail(422,'POLICY_INVALID','Capital policy has no valid proposal ceiling.');
    const r2=await ctx.client.query<{free:string;eligible:boolean}>(
     `SELECT (p.classified_cash-p.reserved_cash-p.committed_cash-
         COALESCE((SELECT SUM(a.amount) FROM wealth_capital.allocation_proposals a
          WHERE a.tenant_id=p.tenant_id AND a.pool_id=p.id AND a.status IN ('DRAFT','UNDER_REVIEW','PLANNING_ACKNOWLEDGED')),0))::text AS free,
       ($2::numeric<=(p.classified_cash-p.reserved_cash-p.committed_cash)*
         $3::numeric/100 AND
        $2::numeric<=p.classified_cash-p.reserved_cash-p.committed_cash-
         COALESCE((SELECT SUM(a.amount) FROM wealth_capital.allocation_proposals a
          WHERE a.tenant_id=p.tenant_id AND a.pool_id=p.id AND a.status IN ('DRAFT','UNDER_REVIEW','PLANNING_ACKNOWLEDGED')),0)) AS eligible
       FROM wealth_capital.pools p WHERE p.tenant_id=$1 AND p.id=$4`,
     [tenantId,input.amount,pct,input.poolId]);
    if(!r2.rowCount||!r2.rows[0].eligible)fail(422,'CAPITAL_GUARDRAIL','Requested planning amount exceeds policy ceiling or uncommitted, unproposed cash.');
    const id=randomUUID(),snapshot={
     sourceSystem:'Finance OS',sourceEntityRef:source.sourceEntityRef,sourceAsOf:source.sourceAsOf,
     poolVersion:source.version,classifiedCash:source.classifiedCash,
     reservedCash:source.reservedCash,committedCash:source.committedCash,
     uncommittedCash:source.uncommittedCash,availableAfterDrafts:r2.rows[0].free,
     policyVersion:policy.rows[0].policy_version,maxProposalPercent:pct,rationale:input.rationale
    };
    const ins=await ctx.client.query(`INSERT INTO wealth_capital.allocation_proposals
     (id,tenant_id,pool_id,target,amount,policy_version,evidence_snapshot,created_by_subject)
     VALUES($1,$2,$3,$4,$5::numeric,$6,$7::jsonb,$8)
     RETURNING id,tenant_id AS "tenantId",pool_id AS "poolId",target,
     amount::text AS amount,status,policy_version AS "policyVersion",
     version::text AS version,evidence_snapshot AS "evidenceSnapshot",
     created_at AS "createdAt",updated_at AS "updatedAt"`,
     [id,tenantId,input.poolId,input.target,input.amount,policy.rows[0].policy_version,JSON.stringify(snapshot),principal.subject]);
    const record=ins.rows[0] as Record<string,unknown>;
    await t.audit(ctx,request,'wealth_allocation_proposal',id,'wealth.capital.proposal_created',null,{version:record.version});
    return {status:201,body:{data:record,financialExecution:false},headers:{
     Location:'/api/v1/wealth/capital/proposals/'+id,ETag:etagFor(String(record.version))
    }};
   });
  });
  return t.result(reply,response);
 });
 app.post('/api/v1/wealth/capital/proposals/:id/cancel',async(request,reply)=>{
  const {principal,tenantId}=t.authFor(request),id=uuid.parse((request.params as {id:string}).id);
  const version=expectedVersion(request.headers['if-match']);
  const response=await withTenant(pool,principal,tenantId,async ctx=>{
   requireMemberWrite(ctx.role,'GOAL');
   return t.idempotent(ctx,request,{version},async()=>{
    const before=await ctx.client.query<{version:string;status:string}>(
     proposalSelect+' WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,id]);
    if(!before.rowCount)fail(404,'PROPOSAL_NOT_FOUND','Planning proposal not found.');
    if(Number(before.rows[0].version)!==version)fail(409,'VERSION_CONFLICT','Proposal changed, reload before cancelling.');
    if(before.rows[0].status!=='DRAFT')fail(409,'PROPOSAL_NOT_DRAFT','Only a draft planning proposal can be cancelled.');
    const updated=await ctx.client.query(`UPDATE wealth_capital.allocation_proposals
      SET status='CANCELLED',version=version+1,updated_at=now()
      WHERE tenant_id=$1 AND id=$2 RETURNING id,tenant_id AS "tenantId",pool_id AS "poolId",
      target,amount::text AS amount,status,policy_version AS "policyVersion",
      version::text AS version,evidence_snapshot AS "evidenceSnapshot",created_at AS "createdAt",updated_at AS "updatedAt"`,
      [tenantId,id]);
    const record=updated.rows[0] as Record<string,unknown>;
    await t.audit(ctx,request,'wealth_allocation_proposal',id,'wealth.capital.proposal_cancelled',
     {version:before.rows[0].version},{version:record.version});
    return {status:200,body:{data:record,financialExecution:false},headers:{ETag:etagFor(String(record.version))}};
   });
  });
  return t.result(reply,response);
 });
}
