import {Pool} from 'pg';
import type {PoolClient} from 'pg';
import {fail} from './errors.js';
import type {Principal} from './auth.js';

export interface TenantContext {client:PoolClient;tenantId:string;principal:Principal;role:'OWNER'|'ADVISOR'|'VIEWER'}
export function createPool(connectionString:string){return new Pool({connectionString,max:12,connectionTimeoutMillis:5000,idleTimeoutMillis:15000})}
export async function verifyRestrictedRole(pool:Pool):Promise<void>{
 const r=await pool.query<{rolsuper:boolean;rolbypassrls:boolean}>('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
 if(!r.rowCount||r.rows[0].rolsuper||r.rows[0].rolbypassrls)throw new Error('WEALTH_APP_DATABASE_URL must use a restricted, non-superuser, non-BYPASSRLS app role.');
}
export async function withTenant<T>(pool:Pool,principal:Principal,tenantId:string,fn:(ctx:TenantContext)=>Promise<T>):Promise<T>{
 const client=await pool.connect();
 let began=false;
 try{
  await client.query('BEGIN');began=true;
  // Transaction-local settings: pooled connections cannot carry one subject or tenant to the next request.
  await client.query("SELECT set_config('app.subject_id',$1,true)",[principal.subject]);
  const m=await client.query<{role:'OWNER'|'ADVISOR'|'VIEWER'}>(
   "SELECT role FROM wealth_auth.tenant_memberships WHERE tenant_id=$1 AND subject_id=$2 AND status='ACTIVE'",
   [tenantId,principal.subject]
  );
  if(m.rowCount!==1)fail(403,'TENANT_ACCESS_DENIED','No active membership for the requested tenant.');
  await client.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  // Kernel-origin subject proof is mandatory. Never derive an identity from a bare tenant header.
  const bound=await client.query<{kernel_person_ref:string}>(`SELECT kernel_person_ref FROM wealth_auth.identity_bindings
   WHERE tenant_id=$1 AND issuer=$2 AND subject_id=$3 AND state='ACTIVE' AND revoked_at IS NULL`,
   [tenantId,principal.issuer,principal.subject]);
  if(bound.rowCount!==1)fail(403,'KERNEL_IDENTITY_UNBOUND','The verified OIDC subject is not actively bound to a Personal Kernel person in this tenant.');
  const result=await fn({client,tenantId,principal,role:m.rows[0].role});
  await client.query('COMMIT');began=false;
  return result;
 }catch(error){if(began)try{await client.query('ROLLBACK')}catch{/* keep original failure */}throw error}
 finally{client.release()}
}
export function requireMemberWrite(role:TenantContext['role'],resource:'PROFILE'|'GOAL'){
 if(role==='VIEWER'||resource==='PROFILE'&&role!=='OWNER')fail(403,'ROLE_DENIED','This membership cannot modify that resource.');
}
