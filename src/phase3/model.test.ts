import {describe,it,expect} from 'vitest';
import {initialState,summary,hydrateState,appendActivity,commitAllocation,revalue,repay} from '../phase2/model';
import {asOf,goalProgress,createGoal,updateGoal,addMilestone,removeMilestone,createStrategy,editDraftStrategy,activateStrategy,reviseStrategy,independenceMetrics,independenceProjection,futureValue,updateIndependence,performanceSummary} from './model';
import type {WealthGoal,WealthStrategy} from './model';
function sample(){return structuredClone(initialState)}
describe('Phase 3 goals and milestones',()=>{
 it('migrates existing Phase 2 local records without losing assets and liabilities',()=>{
  const {planning:ignoredPlanning,performance:ignoredHistory,...old}=sample();
  expect(ignoredPlanning).toBeTruthy();expect(ignoredHistory).toBeTruthy();
  const migrated=hydrateState(old);
  expect(summary(migrated).netWorth).toBe(12840000);
  expect(migrated.planning.goals).toHaveLength(3);
  expect(migrated.performance.opening.netWorth).toBe(12840000);
  expect(migrated.performance.entries).toHaveLength(0);
 });
 it('calculates goal progress from shared net worth rather than stored percentages',()=>{
  const s=sample(),g=s.planning.goals.find(g=>g.id==='g-networth')!;
  expect(goalProgress(g,s,summary(s)).current).toBe(12840000);
  expect(goalProgress(g,s,summary(s)).percent).toBeCloseTo(64.2,5);
  const changed=revalue(s,'p-property',4400000,'sample','v-new');
  expect(goalProgress(g,changed,summary(changed)).current).toBe(13040000);
 });
 it('tracks passive-income target from Income Intelligence',()=>{
  const s=sample(),g=s.planning.goals.find(g=>g.id==='g-income')!;
  expect(goalProgress(g,s,summary(s)).current).toBe(86500);
  expect(goalProgress(g,s,summary(s)).percent).toBeCloseTo(57.666666,3);
 });
 it('tracks capital goal without counting capital as additional assets',()=>{
  const s=sample(),g=s.planning.goals.find(g=>g.id==='g-property')!;
  expect(goalProgress(g,s,summary(s)).current).toBe(625000);
  expect(summary(s).netWorth).toBe(12840000);
 });
 it('creates and archives goals, with active linked strategies archived too',()=>{
  const s=sample(),g:WealthGoal={id:'g-new',title:'Liquid wealth goal',metric:'LIQUID_WEALTH',target:5000000,deadline:'2030-12-31',priority:'HIGH',status:'ACTIVE',createdAt:asOf,milestones:[]};
  const next=createGoal(s,g);
  expect(next.planning.goals).toHaveLength(4);
  const archived=updateGoal(next,'g-networth',{status:'ARCHIVED'});
  expect(archived.planning.strategies.find(x=>x.id==='s-wealth')?.status).toBe('ARCHIVED');
  expect(()=>createGoal(s,{...g,target:-1,id:'bad'})).toThrow();
  expect(()=>createGoal(s,{...g,deadline:'2030-02-31',id:'bad2'})).toThrow();
 });
 it('validates milestone target, date and removal',()=>{
  const s=sample(),m={id:'ms-new',title:'First checkpoint',target:10000000,date:'2027-12-31'};
  const next=addMilestone(s,'g-networth',m);
  expect(next.planning.goals.find(g=>g.id==='g-networth')?.milestones).toHaveLength(3);
  expect(removeMilestone(next,'g-networth','ms-new').planning.goals.find(g=>g.id==='g-networth')?.milestones).toHaveLength(2);
  expect(()=>addMilestone(s,'g-networth',{...m,target:30000000})).toThrow();
  expect(()=>addMilestone(s,'g-networth',{...m,date:'2032-01-01'})).toThrow();
 });
 it('reports unmet goal as overdue after the deadline',()=>{
  const s=sample(),g=s.planning.goals.find(x=>x.id==='g-networth')!;
  const p=goalProgress(g,s,summary(s),'2032-01-01');
  expect(p.isLate).toBe(true);
  expect(p.requiredPerMonth).toBe(null);
 });
});
describe('Phase 3 versioned strategies',()=>{
 it('requires allocation percentages to total 100',()=>{
  const s=sample(),strategy:WealthStrategy={id:'s-new',goalId:'g-networth',name:'New test strategy',description:'Demo',risk:'BALANCED',annualReturnPct:8,horizonYears:5,version:1,status:'DRAFT',createdAt:asOf,allocations:[{id:'one',label:'Cash',percentage:40},{id:'two',label:'Investments',percentage:40}]};
  expect(()=>createStrategy(s,strategy)).toThrow();
  expect(createStrategy(s,{...strategy,allocations:[{id:'one',label:'Cash',percentage:40},{id:'two',label:'Investments',percentage:60}]}).planning.strategies).toHaveLength(3);
 });
 it('draft revision preserves prior active strategy and activates without capital movement',()=>{
  const s=sample();
  const revised=reviseStrategy(s,'s-wealth','s-rev');
  const old=revised.planning.strategies.find(x=>x.id==='s-wealth')!;
  const next=revised.planning.strategies.find(x=>x.id==='s-rev')!;
  expect(old.status).toBe('ACTIVE');expect(next.status).toBe('DRAFT');expect(next.version).toBe(2);
  const edited=editDraftStrategy(revised,'s-rev',{name:next.name,description:'Improved draft',risk:next.risk,annualReturnPct:9,horizonYears:6,allocations:next.allocations});
  const activated=activateStrategy(edited,'s-rev');
  expect(activated.planning.strategies.find(x=>x.id==='s-wealth')?.status).toBe('ARCHIVED');
  expect(activated.planning.strategies.find(x=>x.id==='s-rev')?.status).toBe('ACTIVE');
  expect(summary(activated).netWorth).toBe(summary(s).netWorth);
  expect(summary(activated).committed).toBe(summary(s).committed);
  expect(()=>editDraftStrategy(s,'s-wealth',{name:'bad',description:'',risk:'BALANCED',annualReturnPct:8,horizonYears:5,allocations:old.allocations})).toThrow();
 });
});
describe('Financial independence assumptions',()=>{
 it('calculates eligible capital from investments and deployable cash, not business/property equity',()=>{
  const s=sample(),x=independenceMetrics(s,summary(s));
  expect(x.capitalRequired).toBe(37500000);
  expect(x.eligible).toBe(3280000);
  expect(x.progress).toBeCloseTo(8.7466666667,5);
  expect(x.incomeCoverage).toBeCloseTo(69.2,5);
  const plan=commitAllocation(s,'c-opportunity','Investment plan',100000,'a-new');
  expect(independenceMetrics(plan,summary(plan)).eligible).toBe(3180000);
 });
 it('produces nominal future-value projections from explicit assumptions',()=>{
  expect(futureValue(1000,100,0,12)).toBe(2200);
  expect(futureValue(1000,0,12,12)).toBeGreaterThan(1000);
  const s=sample(),v=independenceProjection(s,summary(s));
  expect(v.projected).toBeGreaterThan(3280000);
  expect(v.inflatedTarget).toBeGreaterThan(37500000);
  expect(v.years).toBe(9);
 });
 it('validates lifestyle, inflation, withdrawal and contribution assumptions',()=>{
  const s=sample();
  expect(()=>updateIndependence(s,{...s.planning.independence,monthlyLifestyleCost:0})).toThrow();
  expect(()=>updateIndependence(s,{...s.planning.independence,withdrawalRatePct:0})).toThrow();
  expect(()=>updateIndependence(s,{...s.planning.independence,monthlyContribution:-1000})).toThrow();
  const next=updateIndependence(s,{...s.planning.independence,monthlyLifestyleCost:150000});
  expect(independenceMetrics(next,summary(next)).capitalRequired).toBe(45000000);
 });
});
describe('Local-only performance journal',()=>{
 it('records valuation change without portraying opening demo data as historical performance',()=>{
  const s=sample(),valued=revalue(s,'p-property',4500000,'sample revaluation','valuation-local');
  const changed=appendActivity(s,valued);
  const report=performanceSummary(changed);
  expect(report.delta).toBe(300000);
  expect(report.byCategory.Property).toBe(300000);
  expect(report.entries).toHaveLength(1);
  expect(report.entries[0].kind).toBe('VALUATION');
 });
 it('classifies simulated repayment as liability movement and keeps net worth constant',()=>{
  const s=sample(),paid=repay(s,'l-personal',25000,'c-opportunity'),changed=appendActivity(s,paid);
  expect(changed.performance.entries[0].kind).toBe('LIABILITY');
  expect(changed.performance.entries[0].after.netWorth).toBe(changed.performance.entries[0].before.netWorth);
  expect(performanceSummary(changed).delta).toBe(0);
 });
 it('does not log goal or strategy edits as investment performance',()=>{
  const s=sample(),edited=updateGoal(s,'g-networth',{title:'Updated strategic objective'});
  expect(appendActivity(s,edited).performance.entries).toHaveLength(0);
 });
});
