import {describe,it,expect} from 'vitest';
import {loadConfig} from './env.js';
import {createGoalInput,updateGoalInput,profileInput,etagFor,expectedVersion,cursorEncode,cursorParse} from './contracts.js';
import {createApp} from './app.js';
import {Pool} from 'pg';
import {fail} from './errors.js';

describe('B0 configuration — fail closed',()=>{
 const valid={WEALTH_APP_DATABASE_URL:'postgresql://x:y@localhost:5432/db',
 OIDC_ISSUER:'https://id.example.test/',OIDC_JWKS_URL:'https://id.example.test/.well-known/jwks.json',
 OIDC_AUDIENCE:'wealth-os-api'};
 it('requires a verified issuer, JWKS, audience and DB before serving data',()=>{
  expect(()=>loadConfig({})).toThrow('not configured');
  expect(()=>loadConfig({...valid,OIDC_ISSUER:'http://id.example.test'})).toThrow();
  expect(()=>loadConfig({...valid,OIDC_AUDIENCE:''})).toThrow();
  expect(loadConfig(valid).PORT).toBe(3009);
 });
 it('rejects provider credentials embedded in metadata URLs',()=>{
  expect(()=>loadConfig({...valid,OIDC_JWKS_URL:'https://user:secret@id.example.test/key'})).toThrow();
 });
});
describe('L1 local issuer boundaries',()=>{
 it('accepts loopback HTTP OIDC only in development, never in staging',()=>{
  const conf={
   WEALTH_APP_DATABASE_URL:'postgresql://wealth_app:test@127.0.0.1:5432/wealth_os_local',
   OIDC_ISSUER:'http://127.0.0.1:8181/realms/wealth-os-local',
   OIDC_JWKS_URL:'http://127.0.0.1:8181/realms/wealth-os-local/protocol/openid-connect/certs',
   OIDC_AUDIENCE:'wealth-os-api'
  };
  expect(loadConfig(conf).RUNTIME_MODE).toBe('development');
  expect(()=>loadConfig({...conf,RUNTIME_MODE:'staging',
   OIDC_REQUIRED_ACR:'urn:test:mfa',OIDC_REQUIRE_VERIFIED_EMAIL:'true',
   WEALTH_INGEST_DATABASE_URL:'postgres://ingest:example@localhost:5432/wealth_os_local',
   INTEGRATION_OIDC_ISSUER:'https://service.example.test/',
   INTEGRATION_OIDC_JWKS_URL:'https://service.example.test/jwks',
   INTEGRATION_OIDC_AUDIENCE:'wealth-os-source-ingest'})).toThrow('HTTPS');
  expect(()=>loadConfig({...conf,OIDC_ISSUER:'http://public.example.test/realm'})).toThrow();
 });
});
describe('B0 REST contracts',()=>{
 it('accepts only money decimal strings with correct scale',()=>{
  const body={title:'KES wealth target',metric:'NET_WORTH',targetAmount:'2500000.1250',targetDate:'2031-12-31'};
  expect(createGoalInput.parse(body).targetAmount).toBe('2500000.1250');
  for(const amount of [2500,'-1','0','1.12345','x','100000000000000000000000'])expect(createGoalInput.safeParse({...body,targetAmount:amount}).success).toBe(false);
 });
 it('rejects impossible calendar dates and unknown fields',()=>{
  expect(createGoalInput.safeParse({title:'Goal',metric:'NET_WORTH',targetAmount:'1000',targetDate:'2026-02-30'}).success).toBe(false);
  expect(profileInput.safeParse({baseCurrency:'USD',wealthStage:'BUILDING'}).success).toBe(false);
  expect(updateGoalInput.safeParse({}).success).toBe(false);
  expect(updateGoalInput.safeParse({foo:'bar'}).success).toBe(false);
 });
 it('requires strong quoted version numbers and enforces cursor shape',()=>{
  expect(etagFor(2)).toBe('"2"');
  expect(expectedVersion('"0"')).toBe(0);
  expect(expectedVersion('"7"')).toBe(7);
  for(const input of [undefined,'W/"1"','1','"01"'])expect(()=>expectedVersion(input)).toThrow();
  const encoded=cursorEncode({id:'d5e7e636-1688-4779-a1fe-b37e88720ba3',created_at:new Date('2026-10-31T12:00:00Z')});
  expect(cursorParse(encoded)).toEqual({id:'d5e7e636-1688-4779-a1fe-b37e88720ba3',at:'2026-10-31T12:00:00.000Z'});
  expect(()=>cursorParse('%%%%')).toThrow();
 });
 it('does not accidentally enable a test-token authentication backdoor in real app',async()=>{
  const fakePool=new Pool({connectionString:'postgres://bad:bad@127.0.0.1:9/nope',connectionTimeoutMillis:300});
  const app=createApp({pool:fakePool,verifyBearer:async()=>fail(401,'INVALID_TOKEN','Unauthorized')});
  try{
   const health=await app.inject({method:'GET',url:'/health'});
   expect(health.statusCode).toBe(200);
   const protectedRoute=await app.inject({method:'GET',url:'/api/v1/wealth/goals',headers:{authorization:'Bearer invalid','x-wealth-tenant-id':'32d1fc02-fac8-4df9-8389-5cb2e02e902a'}});
   expect(protectedRoute.statusCode).toBe(401);
   expect(protectedRoute.json().error.code).toBe('INVALID_TOKEN');
  }finally{await app.close();await fakePool.end()}
 });
});
