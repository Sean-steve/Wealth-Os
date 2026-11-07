import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

type LocalState={tenantId:string;testOnly:boolean;oidcPort:number};
type LocalCreds={username:string;password:string;testOnly:boolean};

// Requires the native Ubuntu PostgreSQL + test Keycloak L1 stack to be active.
// Never executes on the public sample/Pages CI.
test.skip(process.env.WEALTH_L1_E2E!=='yes','L1 opt-in test requires isolated localhost PostgreSQL + Keycloak');
test('full local PKCE browser login and PostgreSQL-backed goal',async({page})=>{
 const state=JSON.parse(await readFile('.local/wealth-os/state.json','utf8')) as LocalState;
 const credentials=JSON.parse(await readFile('.local/wealth-os/test-credentials.json','utf8')) as LocalCreds;
 expect(state.testOnly).toBe(true);
 expect(credentials.testOnly).toBe(true);

 await page.goto('/Wealth-Os/#connected');
 await expect(page.getByRole('heading',{name:'Connected Wealth Workspace'})).toBeVisible();
 await expect(page.getByText(/LOCAL DEVELOPMENT TEST IDENTITY/)).toBeVisible();
 // Keycloak may complete an existing SSO session before Playwright observes its login URL.
 // Wait for the actual login page OR authenticated SPA state instead of racing a transient URL.
 await page.getByRole('button',{name:/Sign in via OIDC/}).click();
 const loginForm=page.locator('#username');
 const authenticated=page.getByText('OIDC session active');
 try{
  await expect(loginForm.or(authenticated).first()).toBeVisible({timeout:12000});
 }catch{
  const error=await page.getByRole('alert').allTextContents();
  // Never expose code, state, JWT or the callback URL in a test report.
  throw new Error('L1_OIDC_CALLBACK_BLOCKED: '+error.join(' | ').slice(0,250)+
   ' (browser origin='+new URL(page.url()).origin+')');
 }
 if(await loginForm.isVisible()){
  await loginForm.fill(credentials.username);
  await page.locator('#password').fill(credentials.password);
  await page.locator('#kc-login').click();
 }
 await expect(authenticated).toBeVisible({timeout:30000});
 const input=page.getByPlaceholder('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
 await input.fill(state.tenantId);
 await page.getByRole('button',{name:/Load verified workspace/}).click();
 await expect(page.getByText('Fetched current tenant-scoped PostgreSQL records. No sample values were imported.')).toBeVisible();
 await expect(page.locator('main')).toContainText('Not verified');

 await page.getByRole('tab',{name:'Goals & milestones'}).click();
 const title='LOCAL PLAYWRIGHT '+Date.now().toString();
 await page.getByText('Create an authenticated goal').waitFor();
 // Scope the fields to the form creating an authenticated goal.
 const heading=page.getByText('Create an authenticated goal');
 const card=heading.locator('xpath=ancestor::*[contains(@class,"wos-card")][1]');
 await card.locator('input[maxlength="160"]').fill(title);
 await card.getByRole('button',{name:/Create durable goal/}).click();
 await expect(page.getByText(title)).toBeVisible();

 await page.reload();
 // Browser-local access token must not survive navigation.
 await expect(page.getByRole('button',{name:/Sign in via OIDC/})).toBeVisible();
});
