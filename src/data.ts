// Illustrative values only. Phase 1 has no financial or account integrations.
export const series={
'1M':[11.91,11.96,11.90,12.08,12.01,12.14,12.16,12.25,12.39,12.35,12.63,12.84],
'6M':[10.8,10.95,10.90,11.28,11.41,11.32,11.70,11.78,11.84,12.12,12.38,12.84],
'1Y':[10.9,11.04,11.17,11.15,11.37,11.56,11.51,11.86,11.91,12.18,12.46,12.84],
'ALL':[4.2,4.8,5.1,5.9,6.7,7.5,7.9,8.6,9.9,10.8,11.7,12.84]} as const;
export type Period=keyof typeof series;
export const periodChanges:Record<Period,string>={'1M':'+7.8% this month','6M':'+18.9% over six months','1Y':'+17.8% this year','ALL':'+205.7% since 2021'};
export const portfolio=[
{name:'Business equity',share:36,color:'#6557ed'},
{name:'Property',share:26,color:'#a59af6'},
{name:'Investments',share:18,color:'#56a5c9'},
{name:'Cash & reserves',share:12,color:'#42b69a'},
{name:'Other',share:8,color:'#e4b66c'}];
export const goals=[
{name:'KES 20M net worth',detail:'Target · Dec 2028',progress:64,color:'#7b6ef4'},
{name:'KES 150K passive income',detail:'Target · Jun 2029',progress:58,color:'#47b79a'},
{name:'Property acquisition fund',detail:'Target · KES 4M',progress:41,color:'#dea958'}];
export const menu=[
{label:'Command Center',slug:'dashboard',icon:'dashboard',phase:1,group:'WORKSPACE'},
{label:'Net Worth',slug:'net-worth',icon:'networth',phase:2,group:'WORKSPACE'},
{label:'Capital & Allocations',slug:'capital',icon:'capital',phase:2,group:'WORKSPACE'},
{label:'Wealth Portfolio',slug:'portfolio',icon:'portfolio',phase:2,group:'WORKSPACE'},
{label:'Income Intelligence',slug:'income',icon:'income',phase:2,group:'WORKSPACE'},
{label:'Liabilities',slug:'liabilities',icon:'liabilities',phase:2,group:'WORKSPACE'},
{label:'Goals & Strategy',slug:'goals',icon:'goals',phase:3,group:'WORKSPACE'},
{label:'Risk Center',slug:'risk',icon:'risk',phase:4,group:'WORKSPACE'},
{label:'Opportunity Lab',slug:'opportunities',icon:'opportunity',phase:4,group:'WORKSPACE'},
{label:'Forecast & Scenarios',slug:'forecasts',icon:'forecasts',phase:4,group:'WORKSPACE'},
{label:'Financial Independence',slug:'independence',icon:'independence',phase:3,group:'WORKSPACE'},
{label:'AI Wealth Advisor',slug:'advisor',icon:'advisor',phase:4,group:'INTELLIGENCE'},
{label:'Decision Journal',slug:'decisions',icon:'decisions',phase:5,group:'INTELLIGENCE'},
{label:'Governance & Security',slug:'governance',icon:'governance',phase:5,group:'INTELLIGENCE'}] as const;
export type Route=(typeof menu)[number]['slug'];
export const phaseDeliverables:Record<number,string[]>={
2:['Net worth dashboard and history','Capital pools and allocation workspace','Portfolio holdings and valuations','Income and liability views'],
3:['Goal timelines, milestones and strategies','Financial independence planning','Wealth performance analysis'],
4:['Risk exposures and opportunity comparisons','Forecasts and scenario lab','AI advisor experience (local demonstration)'],
5:['Decision journal and recommendation management','Policy, consent and approvals','Reports, integrations and security settings']};
export function money(value:number,compact=true):string{
const abs=Math.abs(value);
if(compact && abs>=1000000) return 'KES '+(value/1000000).toFixed(2)+'M';
if(compact && abs>=1000)return 'KES '+Math.round(value/1000)+'K';
return 'KES '+new Intl.NumberFormat('en-KE',{maximumFractionDigits:0}).format(value);
}
