import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',
 timeout:45000,
 expect:{timeout:10000},
 fullyParallel:false,
 retries:process.env.CI?1:0,
 workers:process.env.CI?2:1,
 reporter:process.env.CI?[['list'],['html',{open:'never',outputFolder:'playwright-report'}]]:'list',
 use:{
  baseURL:'http://127.0.0.1:4173/Wealth-Os/',
  trace:'retain-on-failure',screenshot:'only-on-failure',
  ...devices['Desktop Chrome']
 },
 webServer:{
  command:'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
  url:'http://127.0.0.1:4173/Wealth-Os/',
  reuseExistingServer:!process.env.CI,
  timeout:120000
 },
 projects:[{name:'chromium',use:{browserName:'chromium'}}]
});
