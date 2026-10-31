import {createApp} from './app.js';
import {createPool,verifyRestrictedRole} from './db.js';
import {createOidcVerifier} from './auth.js';
import {loadConfig} from './env.js';

const config=loadConfig();
const pool=createPool(config.WEALTH_APP_DATABASE_URL);
try{
 await verifyRestrictedRole(pool); // Fail closed if a superuser/bypass-RLS connection is supplied.
 const app=createApp({pool,verifyBearer:createOidcVerifier(config)});
 const shutdown=async()=>{await app.close();await pool.end()};
 process.once('SIGTERM',()=>{void shutdown()});
 process.once('SIGINT',()=>{void shutdown()});
 await app.listen({host:config.HOST,port:config.PORT});
 process.stdout.write('Wealth OS B0 API listening (authenticated tenant-scoped APIs only).\n');
}catch(error){
 await pool.end();
 process.stderr.write('Wealth OS API startup failed: '+(error instanceof Error?error.message:'Unknown failure')+'\n');
 process.exitCode=1;
}
