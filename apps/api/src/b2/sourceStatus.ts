import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {withTenant} from '../db.js';
import type {B1Tools} from '../b1/bridge.js';
import {sources} from './sourceContracts.js';

export function registerSourceStatusRoutes(app:FastifyInstance,pool:Pool,t:B1Tools){
 app.get('/api/v1/wealth/sources/status',async request=>{
  const {principal,tenantId}=t.authFor(request);
  return withTenant(pool,principal,tenantId,async ({client})=>{
   const granted=await client.query<{source_system:string}>(`SELECT DISTINCT source_system FROM wealth_auth.consent_grants
    WHERE tenant_id=$1 AND subject_id=$2 AND 'wealth.read'=ANY(scopes)
      AND effective_at<=now() AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at>now())`,[tenantId,principal.subject]);
   const bindings=await client.query<{source_system:string;state:string}>(`SELECT source_system,state
     FROM wealth_integration.source_grants
     WHERE tenant_id=$1 AND authorized_subject=$2 AND authorized_issuer=$3`,
     [tenantId,principal.subject,principal.issuer]);
   const receipts=await client.query<{source_system:string;source_revision:string;snapshot_hash:string}>(`
    SELECT i.source_system,i.source_revision,i.snapshot_hash FROM wealth_integration.source_ingestions i
    JOIN wealth_integration.source_grants g ON g.tenant_id=i.tenant_id
     AND g.source_system=i.source_system AND g.producer_issuer=i.producer_issuer
     AND g.producer_subject=i.producer_subject AND g.state='ACTIVE' AND g.revoked_at IS NULL
     AND g.authorized_subject=$2 AND g.authorized_issuer=$3
    JOIN wealth_integration.source_watermarks w ON w.tenant_id=i.tenant_id
     AND w.source_system=i.source_system AND w.snapshot_hash=i.snapshot_hash
     AND w.source_revision=i.source_revision
    WHERE i.tenant_id=$1`,[tenantId,principal.subject,principal.issuer]);
   const watermarks=await client.query<{
    source_system:string;source_revision:string;as_of:Date;complete:boolean
   }>(`SELECT source_system,source_revision,as_of,complete
     FROM wealth_integration.source_watermarks WHERE tenant_id=$1`,[tenantId]);
   return {data:sources.map(system=>{
    const consented=granted.rows.some(x=>x.source_system===system);
    const bound=bindings.rows.some(x=>x.source_system===system&&x.state==='ACTIVE');
    const watermark=consented&&bound?watermarks.rows.find(x=>x.source_system===system):null;
    const hasReceipt=!!watermark&&receipts.rows.some(x=>x.source_system===system&&
     x.source_revision===watermark.source_revision);
    const fresh=!!watermark&&watermark.complete &&
      Date.now()-new Date(watermark.as_of).getTime()<=86400000 &&
      Date.now()-new Date(watermark.as_of).getTime()>=-300000;
    return {sourceSystem:system,consented,authorizedProducerBound:bound,
     status:!consented?'CONSENT_REQUIRED':!bound?'PRODUCER_NOT_BOUND':!watermark?'AWAITING_SNAPSHOT':!hasReceipt?'UNVERIFIED_RECEIPT':!fresh?'STALE':'CURRENT',
     sourceAsOf:watermark?watermark.as_of:null,sourceRevision:watermark?watermark.source_revision:null};
   }),note:'Status is tenant- and subject-scoped. A linked repository does not imply a deployed or certified source connector.'};
  });
 });
}
