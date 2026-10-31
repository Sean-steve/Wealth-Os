import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {withTenant} from '../db.js';
import type {TenantContext} from '../db.js';
import type {B1Tools} from './bridge.js';
const systems=['Finance OS','Asset OS','Company OS'] as const;
type Source=typeof systems[number];
type Access={allowed:Source[];missing:Source[]};
async function sourceAccess(ctx:TenantContext):Promise<Access>{
 const r=await ctx.client.query<{source_system:Source}>(`SELECT DISTINCT source_system
 FROM wealth_auth.consent_grants WHERE tenant_id=$1 AND subject_id=$2
 AND source_system=ANY($3::text[]) AND 'wealth.read'=ANY(scopes)
 AND revoked_at IS NULL AND effective_at<=now()
 AND (expires_at IS NULL OR expires_at>now())`,
 [ctx.tenantId,ctx.principal.subject,systems]);
 const allowed=systems.filter(x=>r.rows.some(row=>row.source_system===x));
 return {allowed,missing:systems.filter(x=>!allowed.includes(x))};
}
const holdings=`SELECT id,source_system AS "sourceSystem",source_entity_type AS "sourceEntityType",
 source_entity_id AS "sourceEntityId",category,owner_fraction::text AS "ownerFraction",
 valuation_amount::text AS "valuationAmount",valuation_currency AS "valuationCurrency",
 valuation_as_of AS "valuationAsOf",valuation_method AS "valuationMethod",
 source_version AS "sourceVersion",quality_status AS "qualityStatus",
 provenance FROM wealth_portfolio.holdings`;
const incomes=`SELECT id,source_system AS "sourceSystem",source_entity_id AS "sourceEntityId",
 monthly_amount::text AS "monthlyAmount",currency,passive,source_as_of AS "sourceAsOf",provenance
 FROM wealth_portfolio.income_projections`;
const debts=`SELECT id,source_system AS "sourceSystem",source_entity_id AS "sourceEntityId",
 outstanding_amount::text AS "outstandingAmount",currency,source_as_of AS "sourceAsOf",provenance
 FROM wealth_portfolio.liability_projections`;

export function registerProjectionRoutes(app:FastifyInstance,pool:Pool,t:B1Tools){
 app.get('/api/v1/wealth/portfolio/holdings',async request=>{
  const {principal,tenantId}=t.authFor(request);
  return withTenant(pool,principal,tenantId,async ctx=>{
   const access=await sourceAccess(ctx);
   const r=await ctx.client.query(holdings+' WHERE tenant_id=$1 AND source_system=ANY($2::text[]) ORDER BY source_system,source_entity_id,id LIMIT 1000',
    [tenantId,access.allowed]);
   return {data:r.rows,consentedSourceSystems:access.allowed,missingConsents:access.missing,readOnly:true,
    notice:'Authoritative assets are owned by Asset OS, Finance OS and Company OS; projections are not directly editable here.'};
  });
 });
 app.get('/api/v1/wealth/income',async request=>{
  const {principal,tenantId}=t.authFor(request);
  return withTenant(pool,principal,tenantId,async ctx=>{
   const a=await sourceAccess(ctx);
   const r=await ctx.client.query(incomes+' WHERE tenant_id=$1 AND source_system=ANY($2::text[]) ORDER BY source_as_of DESC,id LIMIT 1000',[tenantId,a.allowed]);
   return {data:r.rows,consentedSourceSystems:a.allowed,missingConsents:a.missing,readOnly:true};
  });
 });
 app.get('/api/v1/wealth/liabilities',async request=>{
  const {principal,tenantId}=t.authFor(request);
  return withTenant(pool,principal,tenantId,async ctx=>{
   const a=await sourceAccess(ctx);
   const r=await ctx.client.query(debts+' WHERE tenant_id=$1 AND source_system=ANY($2::text[]) ORDER BY source_as_of DESC,id LIMIT 1000',[tenantId,a.allowed]);
   return {data:r.rows,consentedSourceSystems:a.allowed,missingConsents:a.missing,readOnly:true};
  });
 });
 app.get('/api/v1/wealth/state',async request=>{
  const {principal,tenantId}=t.authFor(request);
  return withTenant(pool,principal,tenantId,async ctx=>{
   const access=await sourceAccess(ctx);
   const watermarks=await ctx.client.query<{sourceSystem:Source;complete:boolean;asOf:Date;revision:string}>(`
    SELECT source_system AS "sourceSystem",complete,as_of AS "asOf",source_revision AS revision
    FROM wealth_integration.source_watermarks WHERE tenant_id=$1 AND source_system=ANY($2::text[])`,
    [tenantId,access.allowed]);
   const reasons:string[]=[];
   for(const source of systems){
    if(!access.allowed.includes(source)){reasons.push(source+': missing subject-scoped read consent');continue}
    const w=watermarks.rows.find(x=>x.sourceSystem===source);
    if(!w){reasons.push(source+': no verified complete snapshot');continue}
    if(!w.complete){reasons.push(source+': snapshot explicitly incomplete');continue}
    const age=Date.now()-new Date(w.asOf).getTime();
    if(!Number.isFinite(age)||age< -300000||age>86400000)reasons.push(source+': snapshot older than 24 hours or invalid');
   }
   const coverage=await ctx.client.query<{count:string;invalidCount:string;staleCount:string;otherCurrencyCount:string}>(`
     SELECT COUNT(*)::text AS count,
     COUNT(*) FILTER (WHERE quality_status<>'VERIFIED' OR valuation_amount IS NULL OR valuation_as_of IS NULL)::text AS "invalidCount",
     COUNT(*) FILTER (WHERE valuation_as_of<now()-interval '24 hours' OR valuation_as_of>now()+interval '5 minutes')::text AS "staleCount",
     COUNT(*) FILTER (WHERE valuation_currency IS DISTINCT FROM 'KES')::text AS "otherCurrencyCount"
     FROM wealth_portfolio.holdings
     WHERE tenant_id=$1 AND source_system=ANY($2::text[])`,[tenantId,access.allowed]);
   if(Number(coverage.rows[0].invalidCount)>0)reasons.push('Asset valuation evidence is unverified or missing');
   if(Number(coverage.rows[0].staleCount)>0)reasons.push('One or more holdings have stale valuations');
   if(Number(coverage.rows[0].otherCurrencyCount)>0)reasons.push('Cross-currency holdings lack authoritative KES FX conversion');
   const liabilityCoverage=await ctx.client.query<{invalidCount:string}>(`SELECT COUNT(*) FILTER (
     WHERE source_as_of<now()-interval '24 hours' OR source_as_of>now()+interval '5 minutes' OR currency<>'KES')::text AS "invalidCount"
     FROM wealth_portfolio.liability_projections WHERE tenant_id=$1 AND source_system=ANY($2::text[])`,[tenantId,access.allowed]);
   if(Number(liabilityCoverage.rows[0].invalidCount)>0)reasons.push('Liability projection is stale or not denominated in KES');
   const complete=reasons.length===0;
   if(!complete){
    return {data:{currency:'KES',status:'INCOMPLETE',netWorth:null,grossAssets:null,liabilities:null,
     checkedAt:new Date().toISOString(),blockers:reasons,consentedSourceSystems:access.allowed,
     sourceWatermarks:watermarks.rows,holdingCount:Number(coverage.rows[0].count),
     financialExecutionEnabled:false},notice:'No net worth total is reported until sources and consent are complete.'};
   }
   // All required sources have reconciled completeness and consent. NUMERIC stays in SQL, never JS floats.
   const sums=await ctx.client.query<{grossAssets:string;liabilities:string;netWorth:string}>(`
    WITH assets AS (SELECT COALESCE(SUM(valuation_amount*owner_fraction),0) AS total
       FROM wealth_portfolio.holdings WHERE tenant_id=$1),
    obligations AS (SELECT COALESCE(SUM(outstanding_amount),0) AS total
       FROM wealth_portfolio.liability_projections WHERE tenant_id=$1)
    SELECT assets.total::text AS "grossAssets",obligations.total::text AS liabilities,
       (assets.total-obligations.total)::text AS "netWorth" FROM assets CROSS JOIN obligations`,[tenantId]);
   return {data:{currency:'KES',status:'RECONCILED_SOURCE_PROJECTION',...sums.rows[0],
    checkedAt:new Date().toISOString(),blockers:[],consentedSourceSystems:access.allowed,
    sourceWatermarks:watermarks.rows,holdingCount:Number(coverage.rows[0].count),
    financialExecutionEnabled:false},
    notice:'Source-complete projection only; not an audited statement or authorization to move money.'};
  });
 });
}
