import {Pool} from 'pg';
// CI-only restricted test account; fixed non-production credentials from the CI workflow.
if(!process.env.CI)throw new Error('This test-role provisioner may only run in CI.');
const url=process.env.WEALTH_MIGRATOR_DATABASE_URL;
if(!url)throw new Error('Missing WEALTH_MIGRATOR_DATABASE_URL.');
const pool=new Pool({connectionString:url});
try {
 const found=await pool.query("SELECT 1 FROM pg_roles WHERE rolname='wealth_app'");
 if(!found.rowCount){
  await pool.query("CREATE ROLE wealth_app LOGIN PASSWORD 'local_ci_app_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
 }
 await pool.query('GRANT CONNECT ON DATABASE wealth_os_ci TO wealth_app');
 const ingest=await pool.query("SELECT 1 FROM pg_roles WHERE rolname='wealth_ingest'");
 if(!ingest.rowCount)await pool.query("CREATE ROLE wealth_ingest LOGIN PASSWORD 'local_ci_ingest_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
 await pool.query('GRANT CONNECT ON DATABASE wealth_os_ci TO wealth_ingest');
}finally{await pool.end()}
