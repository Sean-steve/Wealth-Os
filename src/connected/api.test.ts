import {describe,it,expect,vi,afterEach} from 'vitest';
import {apiRequest,completeLogin,isUuid,makeLoginUrl,readConnectionConfig,WealthApiError} from './api';
import type {ConnectionConfig,Session} from './api';
const cfg:ConnectionConfig={
 apiOrigin:'https://api.example.test',authorizationUrl:'https://oidc.example.test/authorize',
 tokenUrl:'https://oidc.example.test/token',clientId:'public-spa-wealth',
 redirectUri:'https://app.example.test/Wealth-Os/'
};
const session:Session={accessToken:'fake.jwt.for.unit.test.not.a.real.token',expiresAt:Date.now()+180000};
afterEach(()=>{vi.unstubAllGlobals()});
describe('B1 browser-only connected workspace',()=>{
 it('defaults to not configured and rejects insecure non-local endpoints',()=>{
  expect(readConnectionConfig({})).toBeNull();
  expect(()=>readConnectionConfig({VITE_WEALTH_API_URL:'http://api.example.test',
   VITE_WEALTH_OIDC_AUTHORIZE_URL:cfg.authorizationUrl,VITE_WEALTH_OIDC_TOKEN_URL:cfg.tokenUrl,
   VITE_WEALTH_OIDC_CLIENT_ID:cfg.clientId})).toThrow('HTTPS');
  expect(()=>readConnectionConfig({VITE_WEALTH_API_URL:'https://user:password@api.example.test',
   VITE_WEALTH_OIDC_AUTHORIZE_URL:cfg.authorizationUrl,VITE_WEALTH_OIDC_TOKEN_URL:cfg.tokenUrl,
   VITE_WEALTH_OIDC_CLIENT_ID:cfg.clientId})).toThrow('without secrets');
 });
 it('builds an Authorization Code with PKCE S256 and short-lived one-time verifier',async()=>{
  const data=new Map<string,string>();
  const url=await makeLoginUrl(cfg,{setItem:(k,v)=>{data.set(k,v)}});
  const result=new URL(url);
  expect(result.searchParams.get('response_type')).toBe('code');
  expect(result.searchParams.get('code_challenge_method')).toBe('S256');
  expect(result.searchParams.get('code_challenge')).toMatch(/^[a-zA-Z0-9_-]+$/);
  expect(result.searchParams.get('redirect_uri')).toBe(cfg.redirectUri);
  expect(result.searchParams.get('scope')).toContain('wealth:read');
  expect(data.size).toBe(1);
  expect(url).not.toContain('access_token');
 });
 it('rejects mismatched state before token exchange and consumes verifier',async()=>{
  const entries=new Map<string,string>();
  await makeLoginUrl(cfg,{setItem:(k,v)=>{entries.set(k,v)}});
  const storage={getItem:(k:string)=>entries.get(k)??null,removeItem:(k:string)=>{entries.delete(k)}};
  const param=new URLSearchParams({code:'dummy',state:'wrong-state'});
  await expect(completeLogin(cfg,param,storage)).rejects.toThrow('mismatch');
  expect(entries.size).toBe(0);
 });
 it('accepts a provider response only after state validation, but does not persist access tokens',async()=>{
  const entries=new Map<string,string>();
  const loginUrl=await makeLoginUrl(cfg,{setItem:(k,v)=>{entries.set(k,v)}});
  const state=new URL(loginUrl).searchParams.get('state')??'';
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({access_token:'signed.jwt.token.value',expires_in:300,token_type:'Bearer'})});
  vi.stubGlobal('fetch',fetcher);
  const storage={getItem:(k:string)=>entries.get(k)??null,removeItem:(k:string)=>{entries.delete(k)}};
  const auth=await completeLogin(cfg,new URLSearchParams({code:'one-time-code',state}),storage);
  expect(auth.accessToken).toBe('signed.jwt.token.value');
  expect(fetcher).toHaveBeenCalledOnce();
  expect(entries.size).toBe(0);
  expect(JSON.stringify([...entries])).not.toContain(auth.accessToken);
 });
 it('requires tenant membership context and refuses expired memory sessions',async()=>{
  expect(isUuid('4bb884e0-b32e-4b45-9a43-f2ed78499263')).toBe(true);
  expect(isUuid('wrong')).toBe(false);
  await expect(apiRequest(cfg,session,'wrong','/api/v1/wealth/goals')).rejects.toThrow('tenant');
  await expect(apiRequest(cfg,{...session,expiresAt:Date.now()-100},'4bb884e0-b32e-4b45-9a43-f2ed78499263',
   '/api/v1/wealth/goals')).rejects.toMatchObject({code:'SESSION_EXPIRED'});
  expect(()=>{throw new WealthApiError(401,'INVALID_TOKEN','Denied')}).toThrow('Denied');
 });
 it('calls only the designated wealth API origin, with no cookies and explicit bearer scope',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[]})});
  vi.stubGlobal('fetch',fetcher);
  const tenant='4bb884e0-b32e-4b45-9a43-f2ed78499263';
  expect((await apiRequest<{data:unknown[]}>(cfg,session,tenant,'/api/v1/wealth/goals')).data).toEqual([]);
  const [requestUrl,requestOpts]=fetcher.mock.calls[0] as [string,RequestInit];
  expect(requestUrl).toBe('https://api.example.test/api/v1/wealth/goals');
  expect(requestOpts.credentials).toBe('omit');
  expect((requestOpts.headers as Record<string,string>).Authorization).toBe('Bearer '+session.accessToken);
  expect((requestOpts.headers as Record<string,string>)['X-Wealth-Tenant-Id']).toBe(tenant);
  await expect(apiRequest(cfg,session,tenant,'https://other.test/api/v1/wealth/goals')).rejects.toThrow('Unexpected');
  await expect(apiRequest(cfg,session,tenant,'/api/v1/wealth/../../admin')).rejects.toThrow('Unexpected');
  expect(fetcher).toHaveBeenCalledOnce();
 });
});
