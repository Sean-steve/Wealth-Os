import {describe,it,expect} from 'vitest';
import {initialState,hydrateState,revalue,summary,commitAllocation} from '../phase2/model';
import {evaluateRisks,assessOpportunity,addOpportunity,updateOpportunityStatus,forecastSeries,validateForecast,updateForecast,simulateScenario,addScenario,deleteScenario,advisorAnswer,seedIntelligence} from './model';
import type {WealthOpportunity,Scenario,ForecastInputs} from './model';
const demo=()=>structuredClone(initialState);
const scenario=(kind:Scenario['kind'],amount:number):Scenario=>({id:'sc-'+kind,title:'Test '+kind,kind,amount,createdAt:'2026-10-31'});
describe('Phase 4 — data migration and transparent risk rules',()=>{
 it('migrates Phase 3 sample state without modifying historical balances',()=>{
  const {intelligence:ignored,...legacy}=demo();expect(ignored).toBeTruthy();
  const loaded=hydrateState(legacy);
  expect(loaded.intelligence.opportunities).toHaveLength(3);
  expect(loaded.intelligence.scenarios).toHaveLength(3);
  expect(loaded.planning.goals).toHaveLength(3);
  expect(summary(loaded).netWorth).toBe(12840000);
 });
 it('initial sample flags business and income concentration with explicit thresholds',()=>{
  const r=evaluateRisks(demo(),'2026-10-31');
  expect(r.signals.find(s=>s.id==='concentration')?.severity).toBe('WATCH');
  expect(r.signals.find(s=>s.id==='income')?.severity).toBe('WATCH');
  expect(r.signals.find(s=>s.id==='reserve')?.severity).toBe('OK');
  expect(r.score).toBe(76);
  expect(r.watch).toBe(2);
  expect(r.high).toBe(0);
 });
 it('responds to actual sample changes instead of relying on static risk cards',()=>{
  const s=demo();const changed=revalue(s,'p-business',14000000,'new estimate','risk-revalue');
  expect(evaluateRisks(changed,'2026-10-31').signals.find(x=>x.id==='concentration')?.severity).toBe('HIGH');
  expect(evaluateRisks(changed,'2026-10-31').score).toBeLessThan(evaluateRisks(s,'2026-10-31').score);
 });
 it('detects emergency reserve deficiencies and stale evidence',()=>{
  const s=demo();s.pools.find(p=>p.id==='c-emergency')!.reserved=200000;
  expect(evaluateRisks(s,'2026-10-31').signals.find(x=>x.id==='reserve')?.severity).toBe('HIGH');
  s.positions[0].valuedAt='2024-01-01';
  expect(evaluateRisks(s,'2026-10-31').signals.find(x=>x.id==='valuation')?.severity).toBe('HIGH');
 });
});
describe('Phase 4 — opportunity eligibility and ranking',()=>{
 it('blocks proposals that exceed uncommitted capital',()=>{
  const s=demo();
  const affordable=assessOpportunity(s,s.intelligence.opportunities[0]);
  const blocked=assessOpportunity(s,s.intelligence.opportunities[2]);
  expect(affordable.eligible).toBe(true);expect(affordable.score).toBeGreaterThan(0);
  expect(blocked.eligible).toBe(false);
  expect(blocked.block).toBe('EXCEEDS_FREE_CAPITAL');
 });
 it('checks reserve floor before a fit score can unlock an opportunity',()=>{
  const s=demo();s.pools.find(p=>p.id==='c-emergency')!.reserved=250000;
  const assessment=assessOpportunity(s,s.intelligence.opportunities[0]);
  expect(assessment.eligible).toBe(false);
  expect(assessment.block).toBe('RESERVE_BELOW_FLOOR');
  expect(assessment.score).toBeGreaterThan(0);
 });
 it('persists research status separately from any financial commitment',()=>{
  const s=demo();const before=summary(s);
  const next=updateOpportunityStatus(s,'opp-diversify','SHORTLISTED');
  expect(next.intelligence.opportunities[0].status).toBe('SHORTLISTED');
  expect(summary(next).committed).toBe(before.committed);
  expect(summary(next).assets).toBe(before.assets);
 });
 it('validates sample opportunity assumptions and IDs',()=>{
  const s=demo(),o:WealthOpportunity={id:'opp-new',title:'New opportunity',kind:'OTHER',description:'Sample only',capitalRequired:50000,returnLowPct:-10,returnHighPct:15,horizonYears:5,risk:'MEDIUM',goalId:'',status:'NEW',createdAt:'2026-10-31'};
  expect(addOpportunity(s,o).intelligence.opportunities).toHaveLength(4);
  expect(()=>addOpportunity(s,{...o,capitalRequired:0})).toThrow();
  expect(()=>addOpportunity(s,{...o,returnLowPct:20,returnHighPct:10})).toThrow();
  expect(()=>addOpportunity(s,{...o,id:'opp-diversify'})).toThrow();
 });
 it('capital commitments immediately lower opportunity affordability',()=>{
  const s=demo(),before=assessOpportunity(s,s.intelligence.opportunities[1]);
  const later=commitAllocation(s,'c-opportunity','sample commitment',250000,'a4-new');
  expect(before.eligible).toBe(true);
  expect(assessOpportunity(later,later.intelligence.opportunities[1]).eligible).toBe(false);
 });
});
describe('Phase 4 — deterministic forecast assumptions',()=>{
 it('starts from investable capital, excluding illiquid business and property equity',()=>{
  const s=demo();const points=forecastSeries(s);
  expect(points.length).toBe(s.intelligence.forecast.years+1);
  expect(points[0].baseline).toBe(3280000);
  expect(points[0].downside).toBe(3280000);
  expect(points[0].contributed).toBe(0);
  expect(points.at(-1)!.baseline).toBeGreaterThan(3280000);
  expect(points.at(-1)!.upside).toBeGreaterThan(points.at(-1)!.baseline);
 });
 it('exposes inflation-adjusted purchasing power',()=>{
  const pts=forecastSeries(demo());const last=pts.at(-1)!;
  expect(last.baselineReal).toBeLessThan(last.baseline);
  expect(last.contributed).toBe(6000000);
 });
 it('validates return order, horizon and cash assumptions',()=>{
  const f:ForecastInputs={years:5,monthlyContribution:30000,baselinePct:7,downsidePct:-8,upsidePct:12,inflationPct:5};
  expect(validateForecast(f)).toBe(f);
  expect(()=>validateForecast({...f,downsidePct:13})).toThrow();
  expect(()=>validateForecast({...f,years:0})).toThrow();
  expect(()=>validateForecast({...f,monthlyContribution:-1})).toThrow();
  expect(()=>validateForecast({...f,inflationPct:50})).toThrow();
 });
 it('saving forecast inputs changes projections without changing holdings or goal records',()=>{
  const s=demo(),next=updateForecast(s,{...seedIntelligence.forecast,years:3});
  expect(forecastSeries(next)).toHaveLength(4);
  expect(summary(next).netWorth).toBe(summary(s).netWorth);
  expect(next.planning.goals).toEqual(s.planning.goals);
 });
});
describe('Phase 4 — scenario lab never mutates source records',()=>{
 it('20% market drop impacts investment values and wealth but not current sample state',()=>{
  const s=demo(),before=JSON.stringify(s),x=simulateScenario(s,scenario('MARKET_DROP',20));
  expect(x.delta).toBe(-580000);
  expect(x.after.investments).toBe(2320000);
  expect(x.after.cash).toBe(x.before.cash);
  expect(JSON.stringify(s)).toBe(before);
 });
 it('cash-funded investment does not magically increase net worth',()=>{
  const x=simulateScenario(demo(),scenario('INVEST_CASH',100000));
  expect(x.feasible).toBe(true);
  expect(x.after.investments-x.before.investments).toBe(100000);
  expect(x.after.cash-x.before.cash).toBe(-100000);
  expect(x.after.assets).toBe(x.before.assets);
  expect(x.after.netWorth).toBe(x.before.netWorth);
 });
 it('debt repayment conserves net worth by reducing cash and liabilities equally',()=>{
  const x=simulateScenario(demo(),scenario('DEBT_REPAY',100000));
  expect(x.feasible).toBe(true);
  expect(x.after.cash).toBe(x.before.cash-100000);
  expect(x.after.assets).toBe(x.before.assets-100000);
  expect(x.after.debt).toBe(x.before.debt-100000);
  expect(x.delta).toBe(0);
 });
 it('property purchase exchanges modeled cash for equivalent property, not profits',()=>{
  const x=simulateScenario(demo(),scenario('PROPERTY_PURCHASE',200000));
  expect(x.feasible).toBe(true);
  expect(x.after.cash-x.before.cash).toBe(-200000);
  expect(x.after.assets).toBe(x.before.assets);
  expect(x.after.netWorth).toBe(x.before.netWorth);
 });
 it('income shocks do not rewrite current financial balances',()=>{
  const x=simulateScenario(demo(),scenario('INCOME_LOSS',30));
  expect(x.after.income).toBeCloseTo(x.before.income*.7);
  expect(x.after.netWorth).toBe(x.before.netWorth);
 });
 it('business equity shock correctly reduces net worth',()=>{
  const x=simulateScenario(demo(),scenario('BUSINESS_DROP',25));
  expect(x.delta).toBe(-1450000);
 });
 it('disallows spending more than uncommitted sample cash',()=>{
  const x=simulateScenario(demo(),scenario('DEBT_REPAY',400000));
  expect(x.feasible).toBe(false);
  expect(x.after).toEqual(x.before);
  expect(()=>simulateScenario(demo(),scenario('MARKET_DROP',101))).toThrow();
  expect(()=>simulateScenario(demo(),scenario('INVEST_CASH',0))).toThrow();
 });
 it('saving or deleting a scenario only changes simulation workspace state',()=>{
  const s=demo(),before=summary(s);
  const fresh=addScenario(s,scenario('PROPERTY_PURCHASE',150000));
  expect(fresh.intelligence.scenarios).toHaveLength(4);
  expect(summary(fresh).netWorth).toBe(before.netWorth);
  const changed=deleteScenario(fresh,'sc-PROPERTY_PURCHASE');
  expect(changed.intelligence.scenarios).toHaveLength(3);
 });
});
describe('Phase 4 — offline evidence-backed advisor',()=>{
 it('grounds net-worth response in sample balance sheet arithmetic',()=>{
  const s=demo(),a=advisorAnswer(s,'How is my net worth calculated?');
  expect(a.topic).toBe('SUMMARY');
  expect(a.facts.some(f=>f.value.includes('12,840,000'))).toBe(true);
  expect(a.limitations).toContain('not a live LLM');
 });
 it('answers supported topics with source labels and no trade execution',()=>{
  const s=demo();
  const checks:[string,string][]=[['What are my risks?','RISK'],['Where is my capital?','CAPITAL'],['When can I retire?','INDEPENDENCE'],['How are my goals?','GOALS'],['Should I repay debt?','DEBT'],['What opportunities are feasible?','OPPORTUNITIES'],['What is the forecast?','FORECAST']];
  for(const [q,topic] of checks){const answer=advisorAnswer(s,q);expect(answer.topic).toBe(topic);expect(answer.facts.length).toBeGreaterThan(0);expect(answer.route.length).toBeGreaterThan(0);}
 });
 it('does not hallucinate unsupported account data or pretend to be a connected AI',()=>{
  const a=advisorAnswer(demo(),'Tell me my bank login password and secret account number');
  expect(a.topic).toBe('UNKNOWN');
  expect(a.facts[0].value).toContain('Illustrative local sample');
  expect(a.limitations).toContain('deterministic');
 });
});
