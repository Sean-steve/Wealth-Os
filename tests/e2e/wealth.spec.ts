import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base='/Wealth-Os/';
const routes=[
 'dashboard','net-worth','capital','portfolio','income','liabilities',
 'goals','strategies','performance','risk','opportunities','forecasts','scenarios',
 'independence','advisor','decisions','governance','security','reports','integrations','settings','connected'
];
async function go(page:import('@playwright/test').Page,route:string){await page.goto(base+'#'+route);await expect(page.locator('main h1')).toBeVisible()}
test.beforeEach(async({page})=>{await page.goto(base+'#dashboard');await page.evaluate(()=>localStorage.clear())});

test('all 22 routes render a navigable module without uncaught browser errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 for(const route of routes){
  await go(page,route);
  await expect(page.locator('main')).toHaveAttribute('aria-label',/\S+/);
  await expect(page.locator('.wos-screen, .dashboard-foot').first()).toBeVisible();
 }
 expect(errors).toEqual([]);
 await page.goto(base+'#unknown-route');
 await expect(page.locator('main h1')).toContainText('Connected Wealth Workspace');
});

test('goals persist across routes and reload; accessible dialogs restore keyboard focus',async({page})=>{
 await go(page,'goals');
 const trigger=page.getByRole('button',{name:'New wealth goal'});
 await trigger.click();
 const modal=page.getByRole('dialog',{name:'Create wealth goal'});
 await expect(modal).toBeVisible();
 await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
 await page.keyboard.press('Escape');
 await expect(modal).toBeHidden();
 await expect(trigger).toBeFocused();
 await trigger.click();
 await page.getByLabel('Goal name').fill('Release certification goal');
 await page.getByLabel('Target (KES)').fill('25000000');
 await page.getByLabel('Target date').fill('2032-10-31');
 await page.getByRole('button',{name:/Save goal/}).click();
 await expect(page.getByText('Release certification goal').first()).toBeVisible();
 await go(page,'dashboard');
 await page.reload();
 await go(page,'goals');
 await expect(page.getByText('Release certification goal').first()).toBeVisible();
});

test('an opportunity flows through planning-only review to report without wealth execution',async({page})=>{
 await go(page,'decisions');
 await expect(page.getByText('Review · Diversified investment allocation').first()).toBeVisible();
 await page.getByRole('button',{name:/Create case/}).first().click();
 await expect(page.getByRole('dialog',{name:'Create planning case'})).toBeVisible();
 await page.getByRole('button',{name:/Save local decision/}).click();
 await expect(page.getByRole('button',{name:/Submit for local review/})).toBeVisible();
 await page.getByRole('button',{name:/Submit for local review/}).click();
 const approve=page.getByRole('button',{name:/Acknowledge planning only/});
 await expect(approve).toBeEnabled();
 await approve.click();
 await expect(page.getByText('Planning acknowledged').first()).toBeVisible();
 await go(page,'reports');
 await expect(page.getByText('Wealth Position & Strategic Review')).toBeVisible();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Export JSON/}).click()]);
 expect(download.suggestedFilename()).toMatch(/wealth-os-sample-report-.*\.json/);
 const {readFile}=await import('node:fs/promises');
 const report=JSON.parse(await readFile(await download.path()!,'utf8')) as {netWorth:number,decisions:{stage:string}[]};
 expect(report.netWorth).toBe(12840000);
 expect(report.decisions.some(c=>c.stage==='PLANNING_APPROVED')).toBe(true);
});

test('export, reset and import recover the edited workspace without a backend',async({page})=>{
 await go(page,'goals');
 await page.getByRole('button',{name:'New wealth goal'}).click();
 await page.getByLabel('Goal name').fill('Recovered from sample backup');
 await page.getByLabel('Target (KES)').fill('16000000');
 await page.getByLabel('Target date').fill('2032-12-31');
 await page.getByRole('button',{name:/Save goal/}).click();
 await go(page,'security');
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export'}).click()]);
 const {readFile}=await import('node:fs/promises');
 const backup=await readFile(await download.path()!);
 const parsed=JSON.parse(backup.toString()) as {format:string,workspace:{planning:{goals:{title:string}[]}}};
 expect(parsed.format).toBe('wealth-os-local-demo');
 expect(parsed.workspace.planning.goals.some(g=>g.title==='Recovered from sample backup')).toBe(true);
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:/Reset/}).last().click();
 await go(page,'goals');
 await expect(page.getByText('Recovered from sample backup')).toHaveCount(0);
 await go(page,'security');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('input[aria-label="Select Wealth OS JSON backup"]').setInputFiles({name:'sample-wealth-backup.json',mimeType:'application/json',buffer:backup});
 await go(page,'goals');
 await expect(page.getByText('Recovered from sample backup').first()).toBeVisible();
 await page.reload();
 await expect(page.getByText('Recovered from sample backup').first()).toBeVisible();
});

test('rejected invalid sample backups do not replace the existing workspace',async({page})=>{
 await go(page,'security');
 await page.locator('input[aria-label="Select Wealth OS JSON backup"]').setInputFiles({
  name:'invalid.json',mimeType:'application/json',
  buffer:Buffer.from('{"format":"wealth-os-local-demo","workspace":{"positions":[null],"liabilities":[],"income":[],"pools":[],"allocations":[],"valuations":[]}}')
 });
 await expect(page.getByRole('alert')).toContainText('integrity checks');
 await go(page,'net-worth');
 await expect(page.locator('main h1')).toHaveText('Net Worth');
 await expect(page.getByText('KES 12,840,000').first()).toBeVisible();
});

test('mobile navigation stays usable and pages do not overflow the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const route of ['dashboard','goals','decisions','security','reports']){
  await go(page,route);
  const width=await page.evaluate(()=>({view:window.innerWidth,scroll:document.documentElement.scrollWidth}));
  expect(width.scroll,route+' caused horizontal scrolling').toBeLessThanOrEqual(width.view+2);
 }
 await go(page,'dashboard');
 const nav=page.getByRole('button',{name:'Open navigation'});
 await nav.click();
 await expect(nav).toHaveAttribute('aria-expanded','true');
 await page.getByRole('button',{name:'Security & Privacy'}).click();
 await expect(page.locator('main h1')).toHaveText('Security & Privacy');
});

test('keyboard skip link and core screens meet automated critical accessibility checks',async({page})=>{
 await go(page,'dashboard');
 await page.keyboard.press('Tab');
 await expect(page.getByRole('link',{name:'Skip to main content'})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.locator('#main-content')).toBeFocused();
 for(const route of ['goals','decisions','security','reports']){
  await go(page,route);
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).disableRules(['color-contrast']).analyze();
  const significant=results.violations.filter(v=>v.impact==='serious'||v.impact==='critical');
  expect(significant.map(v=>({id:v.id,impact:v.impact,affected:v.nodes.length})),route+' accessibility issues').toEqual([]);
 }
});

test('connected authority mode never renders sample figures on supported or unsupported modules',async({page})=>{
 await go(page,'connected');
 await expect(page.getByRole('heading',{name:'Connected Wealth Workspace'})).toBeVisible();
 await expect(page.getByText('Server connection not configured')).toBeVisible();
 await page.getByRole('button',{name:'Goals & Milestones'}).click();
 await expect(page.getByRole('heading',{name:'Connected Wealth Workspace'})).toBeVisible();
 await expect(page.locator('main')).not.toContainText('KES 12.84M');
 await page.getByRole('button',{name:'Wealth Forecasting'}).click();
 await expect(page.getByText('This module is not yet server-backed')).toBeVisible();
 await expect(page.locator('main')).not.toContainText('Illustrative annual return');
 await page.getByRole('button',{name:'Switch to fictional sample workspace'}).click();
 await expect(page.getByRole('heading',{name:'Command Center'})).toBeVisible();
});
