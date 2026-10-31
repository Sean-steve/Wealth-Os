import {describe,it,expect} from 'vitest';
import {loadConfig} from './env.js';
import {enforceOidcAssurance} from './auth.js';
const base={
 WEALTH_APP_DATABASE_URL:'postgresql://localhost:5432/wealthos',
 OIDC_ISSUER:'https://identity.example.test/realms/wealth',
 OIDC_JWKS_URL:'https://identity.example.test/realms/wealth/protocol/openid-connect/certs',
 OIDC_AUDIENCE:'wealth-os-api'
};
const complete={
 ...base,RUNTIME_MODE:'staging',OIDC_REQUIRED_ACR:'urn:wealth-os:mfa',
 OIDC_REQUIRE_VERIFIED_EMAIL:'true',OIDC_MAX_AUTH_AGE_SECONDS:'900',
 WEALTH_INGEST_DATABASE_URL:'postgresql://localhost:5432/ingest',
 INTEGRATION_OIDC_ISSUER:'https://identity.example.test/realms/source',
 INTEGRATION_OIDC_JWKS_URL:'https://identity.example.test/realms/source/protocol/openid-connect/certs',
 INTEGRATION_OIDC_AUDIENCE:'wealth-os-source-ingest'
};
describe('B3 provider activation gate',()=>{
 it('refuses staging startup with no MFA issuer assurance or incomplete source trust',()=>{
  expect(()=>loadConfig({...base,RUNTIME_MODE:'staging'})).toThrow('MFA');
  expect(()=>loadConfig({...complete,OIDC_REQUIRED_ACR:''})).toThrow('MFA');
  expect(()=>loadConfig({...complete,OIDC_REQUIRE_VERIFIED_EMAIL:'false'})).toThrow('MFA');
  expect(()=>loadConfig({...complete,INTEGRATION_OIDC_AUDIENCE:''})).toThrow();
  expect(loadConfig(complete).RUNTIME_MODE).toBe('staging');
 });
 it('rejects staging issuer/JWKS origin mismatches and metadata credentials',()=>{
  expect(()=>loadConfig({...complete,INTEGRATION_OIDC_JWKS_URL:'https://other.example.test/jwks'})).toThrow('origin');
  expect(()=>loadConfig({...complete,OIDC_JWKS_URL:'https://other.example.test/jwks'})).toThrow('origin');
  expect(()=>loadConfig({...complete,INTEGRATION_OIDC_JWKS_URL:'https://user:secret@identity.example.test/jwks'})).toThrow('credentials');
 });
 it('rejects missing, stale and wrong ACR MFA assertions',()=>{
  const cfg=loadConfig(complete),now=1772222222;
  expect(()=>enforceOidcAssurance({acr:'urn:wealth-os:mfa',auth_time:now-80,
   email_verified:true},cfg,now)).not.toThrow();
  expect(()=>enforceOidcAssurance({acr:'1',auth_time:now,email_verified:true},cfg,now)).toThrow('MFA');
  expect(()=>enforceOidcAssurance({acr:'urn:wealth-os:mfa',auth_time:now-1800,
   email_verified:true},cfg,now)).toThrow('fresh');
  expect(()=>enforceOidcAssurance({acr:'urn:wealth-os:mfa',auth_time:now+300,
   email_verified:true},cfg,now)).toThrow('fresh');
  expect(()=>enforceOidcAssurance({acr:'urn:wealth-os:mfa',
   email_verified:true},cfg,now)).toThrow('fresh');
  expect(()=>enforceOidcAssurance({acr:'urn:wealth-os:mfa',auth_time:now-10,
   email_verified:false},cfg,now)).toThrow('verify');
 });
});
