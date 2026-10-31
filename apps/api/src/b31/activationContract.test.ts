import {describe,it,expect} from 'vitest';
import {activationGate,parseActivationConfig} from './activationContract.js';
const token='t'.repeat(90);
const good={
 STAGING_API_URL:'https://wealth-stage.example.net',
 STAGING_TEST_TENANT_ID:'c7b08527-5e5b-48f8-a755-b62a584b8483',
 STAGING_TEST_HUMAN_TOKEN:token,
 OIDC_ISSUER:'https://login.example.net/realms/human',
 OIDC_JWKS_URL:'https://login.example.net/realms/human/certs',
 OIDC_AUDIENCE:'wealth-os-api',
 OIDC_REQUIRED_ACR:'urn:example:mfa',
 STAGING_FINANCE_SERVICE_TOKEN:token,
 STAGING_ASSET_SERVICE_TOKEN:token,
 STAGING_COMPANY_SERVICE_TOKEN:token,
 INTEGRATION_OIDC_ISSUER:'https://identity.example.net/realms/integration',
 INTEGRATION_OIDC_JWKS_URL:'https://identity.example.net/realms/integration/certs',
 INTEGRATION_OIDC_AUDIENCE:'wealth-os-source-ingest',
 STAGING_FINANCE_SNAPSHOT_FILE:'/private/staging-snapshots/finance.json',
 STAGING_ASSET_SNAPSHOT_FILE:'/private/staging-snapshots/asset.json',
 STAGING_COMPANY_SNAPSHOT_FILE:'/private/staging-snapshots/company.json',
 WEALTH_ACTIVATION_APPLY_SNAPSHOTS:'yes',
 WEALTH_TEST_TENANT_ISOLATED:'yes'
};
const sources=['Finance OS','Asset OS','Company OS'].map(sourceSystem=>({
 sourceSystem,status:'CURRENT',consented:true,authorizedProducerBound:true
}));
const state={status:'RECONCILED_SOURCE_PROJECTION',netWorth:'-15000.0000',
 grossAssets:'900000.0000',liabilities:'915000.0000',blockers:[],
 financialExecutionEnabled:false};
describe('B3.1 live activation fails closed',()=>{
 it('requires all three freshly issued JWTs, isolated test tenant and explicit write approval',()=>{
  expect(parseActivationConfig(good).OIDC_AUDIENCE).toBe('wealth-os-api');
  for(const name of ['STAGING_TEST_HUMAN_TOKEN','STAGING_FINANCE_SERVICE_TOKEN',
   'STAGING_ASSET_SERVICE_TOKEN','STAGING_COMPANY_SERVICE_TOKEN','WEALTH_TEST_TENANT_ISOLATED',
   'WEALTH_ACTIVATION_APPLY_SNAPSHOTS'] as const){
    expect(()=>parseActivationConfig({...good,[name]:undefined})).toThrow('BLOCKED');
  }
  expect(()=>parseActivationConfig({...good,WEALTH_TEST_TENANT_ISOLATED:'no'})).toThrow('BLOCKED');
 });
 it('rejects password-bearing API URLs, HTTP staging, JWKS mismatch and API-hosted issuer',()=>{
  expect(()=>parseActivationConfig({...good,STAGING_API_URL:'http://stage.example.net'})).toThrow('BLOCKED');
  expect(()=>parseActivationConfig({...good,STAGING_API_URL:'https://user:password@stage.example.net'})).toThrow('BLOCKED');
  expect(()=>parseActivationConfig({...good,INTEGRATION_OIDC_JWKS_URL:'https://attacker.example.net/jwks'})).toThrow('BLOCKED');
  expect(()=>parseActivationConfig({...good,OIDC_ISSUER:'https://wealth-stage.example.net/realm',
   OIDC_JWKS_URL:'https://wealth-stage.example.net/realm/certs'})).toThrow('independently');
 });
 it('requires 3 distinct current producer-bound consented snapshots',()=>{
  expect(()=>activationGate(sources,state)).not.toThrow();
  expect(()=>activationGate(sources.slice(0,2),state)).toThrow('all three');
  expect(()=>activationGate(sources.map(s=>({...s,status:'UNVERIFIED_RECEIPT'})),state)).toThrow('all three');
  expect(()=>activationGate(sources.map(s=>({...s,consented:false})),state)).toThrow('all three');
  expect(()=>activationGate(sources.map(s=>({...s,authorizedProducerBound:false})),state)).toThrow('all three');
 });
 it('never certifies fabricated, incomplete or money-executing wealth state',()=>{
  expect(()=>activationGate(sources,{...state,netWorth:null})).toThrow('incomplete');
  expect(()=>activationGate(sources,{...state,status:'INCOMPLETE'})).toThrow('incomplete');
  expect(()=>activationGate(sources,{...state,netWorth:'NaN'})).toThrow('incomplete');
  expect(()=>activationGate(sources,{...state,financialExecutionEnabled:true})).toThrow('incomplete');
  expect(()=>activationGate(sources,{...state,blockers:['missing consent']})).toThrow('incomplete');
 });
});
