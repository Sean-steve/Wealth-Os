// Wealth OS — Phase 4: deterministic, local-only wealth intelligence demonstrations.
// No external financial data, trades, LLM, authorized advice, market feed or transaction execution.
import {summary} from '../phase2/model';
import type {WealthState} from '../phase2/model';
import {goalProgress,independenceMetrics} from '../phase3/model';

export type Severity='OK'|'WATCH'|'HIGH';
export interface RiskSignal {id:string;title:string;category:string;severity:Severity;observed:string;threshold:string;explanation:string;nextStep:string;numeric:number}
export interface RiskReport {signals:RiskSignal[];watch:number;high:number;healthy:number;score:number;headline:string}
export const riskPolicies={businessWatch:35,businessHigh:50,incomeWatch:40,incomeHigh:60,debtServiceWatch:25,debtServiceHigh:40,debtAssetsWatch:35,debtAssetsHigh:50,reserveMonths:6,valuationStaleDays:180} as const;
const pct=(n:number)=>(n*100).toFixed(1)+'%';
const fmt=(n:number)=>'KES '+Math.round(n).toLocaleString('en-KE');
const sev=(value:number,watch:number,high:number):Severity=>value>=high?'HIGH':value>=watch?'WATCH':'OK';
const revSev=(value:number,minimum:number):Severity=>value<minimum*.5?'HIGH':value<minimum?'WATCH':'OK';
export function evaluateRisks(state:WealthState,at:string=new Date().toISOString().slice(0,10)):RiskReport {
 const m=summary(state);
 const businessShare=m.assets>0?m.groups['Business equity']/m.assets*100:0;
 const largest=Math.max(0,...state.income.map(i=>i.monthly));
 const incomeShare=m.monthlyIncome>0?largest/m.monthlyIncome*100:0;
 const debtService=m.debtToIncome*100;
 const leverage=m.assets>0?m.liabilities/m.assets*100:0;
 const reserve=state.pools.find(p=>p.id==='c-emergency');
 const expenses=state.planning.independence.monthlyLifestyleCost;
 const months=expenses>0?(reserve?.reserved??0)/expenses:0;
 const dates=state.positions.map(p=>Date.parse(p.valuedAt+'T00:00:00Z')).filter(Number.isFinite);
 const reference=Date.parse(at+'T00:00:00Z');
 const oldest=dates.length?Math.max(0,Math.floor((reference-Math.min(...dates))/86400000)):Infinity;
 const signals:RiskSignal[]=[
 {id:'concentration',title:'Business concentration',category:'Portfolio',numeric:businessShare,severity:sev(businessShare,riskPolicies.businessWatch,riskPolicies.businessHigh),observed:businessShare.toFixed(1)+'% of gross assets',threshold:'Watch ≥35% · High ≥50%',explanation:'Private business equity as a portion of total gross asset value. Concentrated exposure may make wealth sensitive to one enterprise.',nextStep:'Compare diversified allocation strategies and avoid assuming business value is liquid.'},
 {id:'income',title:'Largest income source',category:'Income',numeric:incomeShare,severity:sev(incomeShare,riskPolicies.incomeWatch,riskPolicies.incomeHigh),observed:incomeShare.toFixed(1)+'% of modeled monthly income',threshold:'Watch ≥40% · High ≥60%',explanation:'Largest single monthly income stream divided by total modeled income, using locally entered estimates.',nextStep:'Review other recurring income sources and their reliability.'},
 {id:'debt-service',title:'Debt service burden',category:'Liabilities',numeric:debtService,severity:sev(debtService,riskPolicies.debtServiceWatch,riskPolicies.debtServiceHigh),observed:debtService.toFixed(1)+'% of modeled income',threshold:'Watch ≥25% · High ≥40%',explanation:'Scheduled monthly debt payments divided by modeled monthly income. Not a contractual affordability assessment.',nextStep:'Inspect interest rates, scheduled payments and debt-reduction scenarios.'},
 {id:'leverage',title:'Balance-sheet leverage',category:'Liabilities',numeric:leverage,severity:sev(leverage,riskPolicies.debtAssetsWatch,riskPolicies.debtAssetsHigh),observed:leverage.toFixed(1)+'% of gross assets',threshold:'Watch ≥35% · High ≥50%',explanation:'Outstanding modeled liabilities divided by gross owned assets.',nextStep:'Compare debt exposure with asset liquidity and loan maturity.'},
 {id:'reserve',title:'Emergency reserve coverage',category:'Liquidity',numeric:months,severity:revSev(months,riskPolicies.reserveMonths),observed:months.toFixed(1)+' months at planned lifestyle cost',threshold:'Minimum 6 months · High below 3 months',explanation:'Protected emergency-pool cash divided by monthly lifestyle estimate. Other reserves, obligations and dependants are not assessed.',nextStep:'Preserve the reserve floor before considering deployable capital.'},
 {id:'valuation',title:'Valuation freshness',category:'Data quality',numeric:oldest,severity:!Number.isFinite(oldest)||oldest>365?'HIGH':oldest>riskPolicies.valuationStaleDays?'WATCH':'OK',observed:Number.isFinite(oldest)?oldest+' days since oldest valuation':'No dated valuations',threshold:'Watch >180 days · High >365 days',explanation:'Age of the oldest sample position valuation. Source-system labels are not live data connections.',nextStep:'Refresh evidence in the authoritative source before relying on capital decisions.'}
 ];
 const watch=signals.filter(s=>s.severity==='WATCH').length,high=signals.filter(s=>s.severity==='HIGH').length;
 // A transparent HEURISTIC exposure index, not a probability or credit/health rating.
 const score=Math.max(0,100-watch*12-high*25);
 return {signals,watch,high,healthy:signals.length-watch-high,score,headline:high?'Elevated sample exposures':watch?'Some exposures need review':'No sample thresholds breached'};
}

export type OpportunityKind='DIVERSIFICATION'|'DEBT_REDUCTION'|'INCOME'|'BUSINESS'|'PROPERTY'|'OTHER';
export type OpportunityRisk='LOW'|'MEDIUM'|'HIGH';
export type OpportunityStatus='NEW'|'SHORTLISTED'|'REJECTED';
export interface WealthOpportunity {id:string;title:string;kind:OpportunityKind;description:string;capitalRequired:number;returnLowPct:number;returnHighPct:number;horizonYears:number;risk:OpportunityRisk;goalId:string;status:OpportunityStatus;createdAt:string}
export type OpportunityBlock='NONE'|'EXCEEDS_FREE_CAPITAL'|'RESERVE_BELOW_FLOOR';
export interface OpportunityEvaluation {score:number;eligible:boolean;block:OpportunityBlock;reasons:string[];components:{name:string;points:number;max:number}[];capitalLeft:number}
export interface ForecastInputs {years:number;monthlyContribution:number;baselinePct:number;downsidePct:number;upsidePct:number;inflationPct:number}
export interface ForecastPoint {year:number;baseline:number;downside:number;upside:number;baselineReal:number;contributed:number}
export type ScenarioKind='INVEST_CASH'|'MARKET_DROP'|'DEBT_REPAY'|'PROPERTY_PURCHASE'|'INCOME_LOSS'|'BUSINESS_DROP';
export interface Scenario {id:string;title:string;kind:ScenarioKind;amount:number;createdAt:string}
export interface ScenarioResult {before:{assets:number;debt:number;netWorth:number;cash:number;investments:number;income:number;deployable:number};after:{assets:number;debt:number;netWorth:number;cash:number;investments:number;income:number;deployable:number};feasible:boolean;warnings:string[];narrative:string;delta:number}
export interface IntelligenceState {opportunities:WealthOpportunity[];forecast:ForecastInputs;scenarios:Scenario[]}
export const seedIntelligence:IntelligenceState={
 opportunities:[
  {id:'opp-diversify',title:'Diversified investment allocation',kind:'DIVERSIFICATION',description:'Consider how new uncommitted cash could change equity and business concentration exposure.',capitalRequired:150000,returnLowPct:-8,returnHighPct:10,horizonYears:5,risk:'MEDIUM',goalId:'g-networth',status:'NEW',createdAt:'2026-10-31'},
  {id:'opp-debt',title:'Reduce high-interest personal loan',kind:'DEBT_REDUCTION',description:'Explore redirecting free cash to a modeled high-interest loan balance.',capitalRequired:200000,returnLowPct:0,returnHighPct:0,horizonYears:2,risk:'LOW',goalId:'g-networth',status:'NEW',createdAt:'2026-10-31'},
  {id:'opp-property',title:'Property acquisition feasibility',kind:'PROPERTY',description:'Evaluate the liquidity requirement before funding a planned property purchase.',capitalRequired:1250000,returnLowPct:-5,returnHighPct:8,horizonYears:7,risk:'HIGH',goalId:'g-property',status:'NEW',createdAt:'2026-10-31'}
 ],
 forecast:{years:10,monthlyContribution:50000,baselinePct:7,downsidePct:-8,upsidePct:12,inflationPct:5},
 scenarios:[
  {id:'scenario-market',title:'Market correction · 20%',kind:'MARKET_DROP',amount:20,createdAt:'2026-10-31'},
  {id:'scenario-debt',title:'Debt reduction · KES 100K',kind:'DEBT_REPAY',amount:100000,createdAt:'2026-10-31'},
  {id:'scenario-income',title:'Income shock · 30%',kind:'INCOME_LOSS',amount:30,createdAt:'2026-10-31'}
 ]
};
export function validateOpportunity(o:WealthOpportunity,state:WealthState):void{
 if(!o.title.trim())throw Error('Enter an opportunity title.');
 if(!Number.isFinite(o.capitalRequired)||o.capitalRequired<=0)throw Error('Capital required must be positive.');
 for(const k of [o.returnLowPct,o.returnHighPct])if(!Number.isFinite(k)||k< -100||k>100)throw Error('Return assumptions must be between -100% and 100%.');
 if(o.returnLowPct>o.returnHighPct)throw Error('Lower return assumption cannot exceed upper assumption.');
 if(!Number.isInteger(o.horizonYears)||o.horizonYears<1||o.horizonYears>40)throw Error('Select a 1–40 year horizon.');
 if(o.goalId&&!state.planning.goals.some(g=>g.id===o.goalId&&g.status==='ACTIVE'))throw Error('Select an active goal.');
}
export function addOpportunity(state:WealthState,o:WealthOpportunity):WealthState{
 validateOpportunity(o,state);
 if(state.intelligence.opportunities.some(x=>x.id===o.id))throw Error('Duplicate opportunity ID.');
 return {...state,intelligence:{...state.intelligence,opportunities:[o,...state.intelligence.opportunities]}};
}
export function updateOpportunityStatus(state:WealthState,id:string,status:OpportunityStatus):WealthState{
 if(!state.intelligence.opportunities.some(o=>o.id===id))throw Error('Unknown opportunity.');
 return {...state,intelligence:{...state.intelligence,opportunities:state.intelligence.opportunities.map(o=>o.id===id?{...o,status}:o)}};
}
export function assessOpportunity(state:WealthState,o:WealthOpportunity):OpportunityEvaluation{
 const m=summary(state),risk=evaluateRisks(state);
 const reserve=risk.signals.find(x=>x.id==='reserve')!;
 const reserveOk=reserve.severity==='OK';
 const affordable=o.capitalRequired<=m.deployable;
 const block:OpportunityBlock=!reserveOk?'RESERVE_BELOW_FLOOR':!affordable?'EXCEEDS_FREE_CAPITAL':'NONE';
 const goal=state.planning.goals.find(g=>g.id===o.goalId);
 const alignment=goal&&goal.status==='ACTIVE'&&!goalProgress(goal,state,m).completed?25:8;
 const diversification=o.kind==='DIVERSIFICATION'&&risk.signals.find(x=>x.id==='concentration')?.severity!=='OK'?25:o.kind==='DEBT_REDUCTION'&&state.liabilities.some(l=>l.apr>=12)?22:o.kind==='INCOME'?20:10;
 const available=affordable?25:o.capitalRequired<=m.deployable*2?10:0;
 const suitability:Record<OpportunityRisk,number>={LOW:25,MEDIUM:15,HIGH:5};
 const components=[{name:'Goal alignment',points:alignment,max:25},{name:'Exposure improvement',points:diversification,max:25},{name:'Liquidity fit',points:available,max:25},{name:'Risk complexity',points:suitability[o.risk],max:25}];
 const score=components.reduce((a,v)=>a+v.points,0);
 const reasons=[
  block==='NONE'?'Passes sample cash/reserve guardrails':block==='EXCEEDS_FREE_CAPITAL'?'Insufficient uncommitted capital in this sample':'Emergency reserve is below the sample six-month minimum',
  'Heuristic fit score only: no verified return probability, provider quotes or investment due diligence.',
  'No financial approval, brokerage order or transfer can be triggered here.'
 ];
 return {score,eligible:block==='NONE',block,reasons,components,capitalLeft:m.deployable-o.capitalRequired};
}
export function validateForecast(x:ForecastInputs):ForecastInputs{
 if(!Number.isInteger(x.years)||x.years<1||x.years>30)throw Error('Horizon must be 1–30 years.');
 if(!Number.isFinite(x.monthlyContribution)||x.monthlyContribution<0||x.monthlyContribution>10000000)throw Error('Monthly contribution must be from 0 to KES 10M.');
 for(const v of [x.baselinePct,x.downsidePct,x.upsidePct])if(!Number.isFinite(v)||v< -50||v>50)throw Error('Assumed return must be between -50% and 50%.');
 if(x.downsidePct>x.baselinePct||x.baselinePct>x.upsidePct)throw Error('Downside ≤ baseline ≤ upside is required.');
 if(!Number.isFinite(x.inflationPct)||x.inflationPct<0||x.inflationPct>40)throw Error('Inflation must be between 0% and 40%.');
 return x;
}
export function updateForecast(state:WealthState,inputs:ForecastInputs):WealthState{
 validateForecast(inputs);
 return {...state,intelligence:{...state.intelligence,forecast:{...inputs}}};
}
function compound(start:number,monthly:number,annualRate:number,months:number):number{
 const r=annualRate/1200;
 if(r===0)return start+monthly*months;
 return start*Math.pow(1+r,months)+monthly*(Math.pow(1+r,months)-1)/r;
}
export function forecastSeries(state:WealthState,opts=state.intelligence.forecast):ForecastPoint[]{
 validateForecast(opts);
 const m=summary(state);
 // Investable capital projection, NOT all-property/business net worth.
 const opening=Math.max(0,m.groups.Investments+m.deployable);
 return Array.from({length:opts.years+1},(_,i)=>{
  const months=i*12;
  const baseline=compound(opening,opts.monthlyContribution,opts.baselinePct,months);
  const realFactor=Math.pow(1+opts.inflationPct/100,i);
  return {year:2026+i,baseline,downside:compound(opening,opts.monthlyContribution,opts.downsidePct,months),
   upside:compound(opening,opts.monthlyContribution,opts.upsidePct,months),baselineReal:baseline/realFactor,
   contributed:opts.monthlyContribution*months};
 });
}
export function validateScenario(s:Scenario):void{
 if(!s.title.trim())throw Error('Scenario name required.');
 if(!Number.isFinite(s.amount)||s.amount<=0)throw Error('Scenario amount must be positive.');
 if(['MARKET_DROP','INCOME_LOSS','BUSINESS_DROP'].includes(s.kind)&&s.amount>100)throw Error('Impact percentage must not exceed 100%.');
 if(['DEBT_REPAY','PROPERTY_PURCHASE','INVEST_CASH'].includes(s.kind)&&s.amount>1000000000000)throw Error('Scenario amount exceeds allowed demonstration limit.');
}
export function simulateScenario(state:WealthState,s:Scenario):ScenarioResult{
 validateScenario(s);
 const m=summary(state);
 const before={assets:m.assets,debt:m.liabilities,netWorth:m.netWorth,cash:m.cash,investments:m.groups.Investments,income:m.monthlyIncome,deployable:m.deployable};
 const after={...before};
 let narrative='',feasible=true;
 const warnings=['Hypothetical isolated calculation; no account, asset, goal, pool or liability is changed.'];
 if(s.kind==='MARKET_DROP'){const drop=m.groups.Investments*s.amount/100;after.assets-=drop;after.investments-=drop;after.netWorth-=drop;narrative='Market loss applied only to sample investment positions.'}
 if(s.kind==='BUSINESS_DROP'){const drop=m.groups['Business equity']*s.amount/100;after.assets-=drop;after.netWorth-=drop;narrative='Business valuation shock reduces the estimated owned equity value.'}
 if(s.kind==='INCOME_LOSS'){after.income=m.monthlyIncome*(1-s.amount/100);narrative='Income reduction affects modeled monthly income, but not current assets or net worth; future saving capacity may change.'}
 if(s.kind==='INVEST_CASH'||s.kind==='DEBT_REPAY'||s.kind==='PROPERTY_PURCHASE'){
  feasible=s.amount<=m.deployable&&(s.kind!=='DEBT_REPAY'||s.amount<=m.liabilities);
  if(!feasible)warnings.push('Blocked by insufficient uncommitted cash or outstanding debt; balance sheet is unchanged.');
  else {
   after.cash-=s.amount;after.deployable-=s.amount;
   if(s.kind==='INVEST_CASH'){after.investments+=s.amount;narrative='Cash is reclassified into investments; total assets and net worth do not increase.'}
   if(s.kind==='PROPERTY_PURCHASE'){narrative='Available cash is exchanged for a property of equal modeled value; ignores fees, taxes, and financing.'}
   if(s.kind==='DEBT_REPAY'){after.assets-=s.amount;after.debt-=s.amount;narrative='Cash and debt fall equally; there is no instant net-worth gain.'}
  }
  if(!narrative)narrative='This scenario needs more free capital and remains an unexecuted thought experiment.';
 }
 if(s.kind==='DEBT_REPAY'||s.kind==='PROPERTY_PURCHASE'||s.kind==='INVEST_CASH')warnings.push('Protected emergency reserves and existing capital commitments are excluded from spending capacity.');
 if(s.kind==='MARKET_DROP'||s.kind==='BUSINESS_DROP')warnings.push('This stress applies a single shock; correlations, taxes and recovery paths are not modeled.');
 return {before,after,feasible,warnings,narrative,delta:after.netWorth-before.netWorth};
}
export function addScenario(state:WealthState,scenario:Scenario):WealthState{
 validateScenario(scenario);
 if(state.intelligence.scenarios.some(s=>s.id===scenario.id))throw Error('Duplicate scenario ID.');
 return {...state,intelligence:{...state.intelligence,scenarios:[scenario,...state.intelligence.scenarios].slice(0,30)}};
}
export function deleteScenario(state:WealthState,id:string):WealthState{
 return {...state,intelligence:{...state.intelligence,scenarios:state.intelligence.scenarios.filter(s=>s.id!==id)}};
}
export function isIntelligenceState(o:unknown):o is IntelligenceState{
 if(!o||typeof o!=='object')return false;
 const x=o as Record<string,unknown>;
 return Array.isArray(x.opportunities)&&Array.isArray(x.scenarios)&&typeof x.forecast==='object'&&!!x.forecast;
}
export type AdvisorTopic='SUMMARY'|'RISK'|'CAPITAL'|'GOALS'|'INDEPENDENCE'|'DEBT'|'OPPORTUNITIES'|'FORECAST'|'UNKNOWN';
export interface AdvisorAnswer {topic:AdvisorTopic;headline:string;body:string;facts:{label:string;value:string;origin:string}[];limitations:string;next:string;route:string}
export function advisorAnswer(state:WealthState,question:string):AdvisorAnswer{
 const q=question.toLowerCase().trim(),m=summary(state),risk=evaluateRisks(state),ind=independenceMetrics(state,m),opps=state.intelligence.opportunities;
 let topic:AdvisorTopic='UNKNOWN';
 if(/risk|expos|vulnerab|concentrat|safe|resilien/.test(q))topic='RISK';
 else if(/capital|cash|allocat|invest|deploy|reserve|spend|afford/.test(q))topic='CAPITAL';
 else if(/independ|retire|freedom|lifestyle/.test(q))topic='INDEPENDENCE';
 else if(/goal|target|milestone|strateg/.test(q))topic='GOALS';
 else if(/debt|loan|repay|liabilit/.test(q))topic='DEBT';
 else if(/opportunit|compare|idea|rank/.test(q))topic='OPPORTUNITIES';
 else if(/forecast|scenario|future|projection|year|grow/.test(q))topic='FORECAST';
 else if(/wealth|worth|overview|doing|status|summary|financial/.test(q))topic='SUMMARY';
 const common='This is a deterministic, rules-based sample explanation, not a live LLM, personal financial advice, or evidence of real funds.';
 const facts=(entries:[string,string,string][])=>entries.map(([label,value,origin])=>({label,value,origin}));
 const out=(headline:string,body:string,entries:[string,string,string][],next:string,route:string):AdvisorAnswer=>({topic,headline,body,facts:facts(entries),limitations:common,next,route});
 switch(topic){
 case 'RISK':return out(risk.headline,'The local model currently has '+risk.high+' high and '+risk.watch+' watch-level threshold signals. Thresholds are demonstration policies, not probability estimates.',[['Business exposure',pct(m.assets>0?m.groups['Business equity']/m.assets:0),'Wealth Portfolio → Business equity'],['Reserve coverage',risk.signals.find(s=>s.id==='reserve')!.observed,'Capital Pools + Independence Plan'],['Sample risk index',risk.score+'/100 (heuristic)','Phase 4 threshold policy']], 'Inspect each signal and its assumptions.','risk');
 case 'CAPITAL':return out('Capital after protection and commitments','Only unreserved, uncommitted cash may be considered deployable in this sample. Strategic pools classify existing cash rather than adding to assets.',[['Deployable capital',fmt(m.deployable),'Capital pools → balance − reserved − committed'],['Protected reserves',fmt(m.reserved),'Capital Pools'],['Committed plans',fmt(m.committed),'Capital allocations']], 'Compare goal priorities before drafting new allocations.','capital');
 case 'INDEPENDENCE':return out('Independence depends on investable resources','The sample plan counts investments and free cash, excluding illiquid private business and property values from eligible capital.',[['Eligible today',fmt(ind.eligible),'Investments + deployable cash'],['Target required',fmt(ind.capitalRequired),'Lifestyle × 12 / withdrawal assumption'],['Progress',ind.progress.toFixed(1)+'%','Eligible / required capital']], 'Adjust assumptions and examine downside scenarios.','independence');
 case 'GOALS':{const g=state.planning.goals.find(x=>x.status==='ACTIVE');return out('Wealth goals are linked to measured state',g?'The leading goal is '+g.title+'. Progress updates when underlying sample assets or income change.':'No active goals are currently recorded.',g?[[g.title,goalProgress(g,state,m).percent.toFixed(1)+'% of target','Goals → '+g.metric],['Active goals',String(state.planning.goals.filter(x=>x.status==='ACTIVE').length),'Planning workspace']]:[], 'Review milestones and strategy assumptions.','goals')}
 case 'DEBT':return out('Debt affects both liquidity and financial resilience','Debt reduction by cash repayment decreases debt and cash by equal amounts, with no instant net-worth gain.',[['Outstanding debt',fmt(m.liabilities),'Liabilities → outstanding balance'],['Monthly debt service',fmt(m.monthlyDebt),'Liabilities → scheduled payments'],['Debt service burden',pct(m.debtToIncome),'Scheduled payments / modeled income']], 'Review repayment feasibility before setting capital aside.','liabilities');
 case 'OPPORTUNITIES':return out('Ideas need eligibility before ranking','Opportunities are scored using transparent weights; lack of free capital or reserves prevents passing sample guardrails.',[['Ideas tracked',String(opps.length),'Opportunity Lab'],['Eligible for simulation',String(opps.filter(o=>assessOpportunity(state,o).eligible).length),'Opportunity feasibility checks'],['Free capital',fmt(m.deployable),'Capital Pools']], 'Compare at least two eligible ideas and disclose unknown risks.','opportunities');
 case 'FORECAST':return out('Future outcomes are conditional estimates','The illustrative forecast starts with investments and deployable cash, and compounds explicit contributions and annual-return assumptions.',[['Baseline return assumption',state.intelligence.forecast.baselinePct+'% nominal','Forecast & Scenarios'],['Monthly new contributions',fmt(state.intelligence.forecast.monthlyContribution),'Forecast inputs'],['Horizon',state.intelligence.forecast.years+' years','Forecast inputs']], 'Change the downside case and see how sensitive the result is.','forecasts');
 case 'SUMMARY':return out('Illustrative net worth is '+fmt(m.netWorth),'Net worth is owned assets minus outstanding liabilities. The sample is not linked to real institutions.',[['Gross assets',fmt(m.assets),'Portfolio → ownership-adjusted values'],['Liabilities',fmt(m.liabilities),'Liabilities → outstanding'],['Net worth',fmt(m.netWorth),'Assets minus liabilities']], 'Review what is liquid versus tied up in property and business.','net-worth');
 default:return out('Ask a wealth-specific question','This offline rules preview currently supports net worth, risk, available capital, goals, debt, independence, opportunities, and forecasts. It does not generate free-form financial advice.',[['Data mode','Illustrative local sample','Browser-local Wealth OS workspace']], 'Choose one of the suggested prompts to explore a verified calculation path.','dashboard');
 }
}
