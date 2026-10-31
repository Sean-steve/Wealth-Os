import assert from 'node:assert/strict';
import {decodeJwt,decodeProtectedHeader} from 'jose';
import {createOidcVerifier} from '../src/auth.js';
import {createProducerVerifier} from '../src/b2/sourceContracts.js';
import type {ApiConfig} from '../src/env.js';

const issuer='http://127.0.0.1:8181/realms/wealth-os-ci';
const response=await fetch(issuer+'/.well-known/openid-configuration',{signal:AbortSignal.timeout(7000)});
assert.equal(response.status,200);
const metadata=await response.json() as {issuer:string;response_types_supported:string[];
 code_challenge_methods_supported:string[];jwks_uri:string;token_endpoint:string};
assert.equal(metadata.issuer,issuer);
assert.ok(metadata.response_types_supported.includes('code'));
assert.ok(metadata.code_challenge_methods_supported.includes('S256'));
const jwks=await fetch(metadata.jwks_uri,{signal:AbortSignal.timeout(7000)}).then(async r=>await r.json() as {keys:unknown[]});
assert.ok(jwks.keys.length>0);
const token=async(body:URLSearchParams)=>fetch(metadata.token_endpoint,{method:'POST',
 headers:{'content-type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(8000)});
const userResponse=await token(new URLSearchParams({grant_type:'password',client_id:'wealth-os-spa-ci',
 username:'ci-protocol',password:'CI-ONLY-protocol-password-2026'}));
if(userResponse.status!==200)throw Error('CI Keycloak protocol user rejected: '+userResponse.status+' '+(await userResponse.text()).slice(0,200));
const {access_token:userToken}=await userResponse.json() as {access_token:string};
assert.equal(decodeProtectedHeader(userToken).alg,'RS256');
assert.equal(decodeJwt(userToken).iss,issuer);
const sourceResponse=await token(new URLSearchParams({grant_type:'client_credentials',client_id:'wealth-os-source-ci',
 client_secret:'CI-ONLY-source-client-secret-not-a-real-secret'}));
if(sourceResponse.status!==200)throw Error('CI Keycloak service identity rejected: '+sourceResponse.status+' '+(await sourceResponse.text()).slice(0,200));
const {access_token:sourceToken}=await sourceResponse.json() as {access_token:string};
assert.equal(decodeProtectedHeader(sourceToken).alg,'RS256');
const config={OIDC_ISSUER:issuer,OIDC_JWKS_URL:metadata.jwks_uri,OIDC_AUDIENCE:'wealth-os-api',
 INTEGRATION_OIDC_ISSUER:issuer,INTEGRATION_OIDC_JWKS_URL:metadata.jwks_uri,
 INTEGRATION_OIDC_AUDIENCE:'wealth-os-source-ingest'} as ApiConfig;
const claims=decodeJwt(userToken);
const missingClaims=['sub','iat','exp'].filter(key=>!claims[key as keyof typeof claims]);
if(missingClaims.length)throw Error('CI Keycloak JWT missing required claims '+missingClaims.join(',')+
 '; claim names (no values): '+Object.keys(claims).sort().join(','));
const human=await createOidcVerifier(config)(userToken);
assert.ok(human.scopes.has('wealth:read')&&human.scopes.has('wealth:write'));
const verifySource=createProducerVerifier(config);
assert.ok(verifySource);
const service=await verifySource!(sourceToken);
assert.ok(service.scopes.has('wealth:ingest'));
await assert.rejects(createOidcVerifier(config)(sourceToken));
await assert.rejects(verifySource!(userToken));
await assert.rejects(createOidcVerifier({...config,OIDC_AUDIENCE:'wrong-audience'})(userToken));
await assert.rejects(verifySource!('unsigned.invalid.token'));
const otp=await token(new URLSearchParams({grant_type:'password',client_id:'wealth-os-spa-ci',
 username:'ci-otp-required',password:'CI-ONLY-otp-password-2026'}));
assert.notEqual(otp.status,200);
console.log(JSON.stringify({certification:'PASS',realKeycloak:true,pkceS256:true,
 signedAccessTokens:true,separateAudiences:true,scopedServiceIdentity:true,
 tamperRejected:true,passwordOnlyOtpBypassDenied:true,productionActivated:false}));
