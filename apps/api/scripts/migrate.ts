import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';

const connectionString=process.env.WEALTH_MIGRATOR_DATABASE_URL;
if(!connectionString)throw new Error('WEALTH_MIGRATOR_DATABASE_URL is required for privileged migrations.');
const pool=new Pool({connectionString,max:1});
const folder=resolve(process.cwd(),'db/migrations');
try{
 const files=(await readdir(folder)).filter(x=>/^\d{3}_[a-z0-9_]+\.sql$/.test(x)).sort();
 if(!files.length)throw new Error('No versioned migrations found.');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(82461, 1001)');
  await client.query('CREATE SCHEMA IF NOT EXISTS wealth_core');
  await client.query(`CREATE TABLE IF NOT EXISTS wealth_core.schema_migrations (
   version TEXT PRIMARY KEY,checksum_sha256 TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  for(const file of files){
   const sql=await readFile(resolve(folder,file),'utf8');
   const digest=createHash('sha256').update(sql).digest('hex');
   const applied=await client.query<{checksum_sha256:string}>(
    'SELECT checksum_sha256 FROM wealth_core.schema_migrations WHERE version=$1',[file]);
   if(applied.rowCount){
    if(applied.rows[0].checksum_sha256!==digest)throw new Error('Migration checksum mismatch: '+file+' (history was modified).');
    process.stdout.write('VERIFIED '+file+'\n');continue;
   }
   await client.query(sql);
   await client.query('INSERT INTO wealth_core.schema_migrations(version,checksum_sha256) VALUES($1,$2)',[file,digest]);
   process.stdout.write('APPLIED '+file+'\n');
  }
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}finally{await pool.end()}
