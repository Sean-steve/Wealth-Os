import {describe,it,expect} from 'vitest';
import {initialState,hydrateState,commitAllocation,revalue,summary,repay} from '../phase2/model';
import {goalProgress} from '../phase3/model';
import {assessOpportunity,simulateScenario} from '../phase4/model';
import {createCase,evaluateCase,submitReview,approveForPlanning,buildReport} from '../phase5/model';
import {isValidCoreState,hasValidExtensions} from './validation';
import {BACKUP_FORMAT,makeWorkspaceBackup,readWorkspaceBackup} from './backup';

const demo=()=>structuredClone(initialState);
const DATE='2026-10-31';
const RATIONALE='Review the illustrative liquidity, projected impacts and uncertain valuations before planning.';
describe('Phase 6 — backup validation and recovery',()=>{
 it('round-trips an unchanged complete demo workspace',()=>{
  const s=demo();
  expect(isValidCoreState(s)).toBe(true);
  expect(hasValidExtensions(s)).toBe(true);
  const result=readWorkspaceBackup(makeWorkspaceBackup(s,'2026-10-31T10:00:00Z'));
  expect(result).toEqual(s);
  expect(summary(result).netWorth).toBe(12840000);
 });
 it('preserves edited assets, capital, goals, strategies, opportunity and governance state',()=>{
  let s=demo();
  s=revalue(s,'p-property',4400000,'updated local sample','v-200');
  s=commitAllocation(s,'c-opportunity','Research option',20000,'alloc-200');
  s=createCase(s,'proposal-opportunity-opp-diversify',RATIONALE);
  const restored=readWorkspaceBackup(makeWorkspaceBackup(s));
  expect(restored).toEqual(s);
  expect(restored.governance.cases[0].stage).toBe('DRAFT');
  expect(summary(restored).committed).toBe(summary(s).committed);
  expect(summary(restored).netWorth).toBe(13040000);
 });
 it('rejects truncated and unsupported backup files without replacing any data',()=>{
  for(const raw of ['','not-json','[]','{}','x'.repeat(3*1024*1024+1)]){
   expect(()=>readWorkspaceBackup(raw)).toThrow();
  }
  expect(()=>readWorkspaceBackup(JSON.stringify({format:BACKUP_FORMAT,version:999,workspace:demo()}))).toThrow();
  expect(()=>readWorkspaceBackup(JSON.stringify({format:'bank-statement',workspace:demo()}))).toThrow();
 });
 it('rejects NaN-like strings, negative values, invalid pool balances and broken references',()=>{
  const changed=demo();
  changed.positions[0].value=-1;
  expect(isValidCoreState(changed)).toBe(false);
  expect(()=>readWorkspaceBackup(makeWorkspaceBackup(changed))).toThrow('integrity');
  const badPool=demo();badPool.pools[0].reserved=badPool.pools[0].balance+1;
  expect(isValidCoreState(badPool)).toBe(false);
  const unknown=demo();unknown.valuations[0].positionId='missing';
  expect(isValidCoreState(unknown)).toBe(false);
  const invalid=demo();invalid.positions[0].value=Number.POSITIVE_INFINITY;
  expect(isValidCoreState(invalid)).toBe(false);
  expect(()=>readWorkspaceBackup(makeWorkspaceBackup(invalid))).toThrow();
 });
 it('rejects malformed planning, governance and intelligence extension data',()=>{
  const s=demo();s.planning.goals[0].target=-2;
  expect(hasValidExtensions(s)).toBe(false);
  const x=demo();x.governance.cases=[{id:'x',title:'Bad case',rationale:'test',sourceId:'xx',requestedCapital:-20,stage:'DRAFT'}] as typeof x.governance.cases;
  expect(hasValidExtensions(x)).toBe(false);
  const o=demo();o.intelligence.scenarios[0].amount=-30;
  expect(hasValidExtensions(o)).toBe(false);
 });
 it('loads legacy Phase 2–5 data with missing subsequent sections',()=>{
  const s=demo();
  const {planning:_p,intelligence:_i,governance:_g,performance:_h,...legacy}=s;
  expect(_p&&_i&&_g&&_h).toBeTruthy();
  const loaded=readWorkspaceBackup(JSON.stringify({format:BACKUP_FORMAT,workspace:legacy}));
  expect(loaded.planning.goals.length).toBeGreaterThan(0);
  expect(loaded.governance.policyVersion).toBe(1);
  expect(loaded.intelligence.opportunities.length).toBeGreaterThan(0);
  expect(summary(loaded)).toEqual(summary(demo()));
 });
 it('falls back to demo seed rather than crashing on corrupt stored state',()=>{
  const corrupt=demo();corrupt.positions[0].category='Fake asset' as typeof corrupt.positions[0]['category'];
  expect(hydrateState(corrupt)).toEqual(demo());
  expect(hydrateState({positions:[null],liabilities:[],income:[],pools:[],allocations:[],valuations:[]})).toEqual(demo());
 });
});
describe('Phase 6 — cross-module capital and decision consistency',()=>{
 it('retains net worth across capital reclassification and debt repayment while protecting reserves',()=>{
  const s=demo(),old=summary(s);
  const c=commitAllocation(s,'c-opportunity','Another planned allocation',20000,'new');
  expect(summary(c).netWorth).toBe(old.netWorth);
  expect(summary(c).deployable).toBe(old.deployable-20000);
  const debt=repay(c,'l-personal',25000,'c-opportunity');
  expect(summary(debt).netWorth).toBe(old.netWorth);
  expect(summary(debt).liabilities).toBe(old.liabilities-25000);
  expect(summary(debt).reserved).toBe(old.reserved);
 });
 it('live wealth changes recalculate goals, opportunity eligibility and wealth reports',()=>{
  const s=demo(),goal=s.planning.goals.find(g=>g.id==='g-networth')!;
  const initial=goalProgress(goal,s,summary(s)).percent;
  const changed=revalue(s,'p-property',4500000,'new estimate','new');
  expect(goalProgress(goal,changed,summary(changed)).percent).toBeGreaterThan(initial);
  expect(buildReport(changed,DATE+'T10:00:00Z').netWorth).toBe(summary(changed).netWorth);
  const option=s.intelligence.opportunities[0];
  expect(assessOpportunity(s,option).eligible).toBe(true);
  const used=commitAllocation(s,'c-opportunity','Other local plan',250000,'allocation');
  expect(assessOpportunity(used,option).eligible).toBe(false);
 });
 it('planning acknowledgement is not a financial execution and rejects stale evidence',()=>{
  const s=demo();
  const c=createCase(s,'proposal-opportunity-opp-diversify',RATIONALE);
  const id=c.governance.cases[0].id;
  expect(evaluateCase(c,c.governance.cases[0],DATE).pass).toBe(true);
  const reviewed=submitReview(c,id,DATE);
  const out=approveForPlanning(reviewed,id,DATE);
  expect(out.governance.cases[0].stage).toBe('PLANNING_APPROVED');
  expect(summary(out)).toEqual(summary(reviewed));
  expect(out.governance.events[0].detail).toContain('NO transaction authorization');
  const stale=revalue(reviewed,'p-property',4500000,'changed valuation','revaluation');
  expect(()=>approveForPlanning(stale,id,DATE)).toThrow('Re-submit');
 });
 it('isolated scenario result cannot mutate holdings, goals, policy or persisted audit data',()=>{
  const s=demo(),snapshot=JSON.stringify(s);
  const result=simulateScenario(s,{id:'what-if',title:'Debt stress',kind:'DEBT_REPAY',amount:100000,createdAt:DATE});
  expect(result.after.netWorth).toBe(result.before.netWorth);
  expect(JSON.stringify(s)).toBe(snapshot);
 });
});
