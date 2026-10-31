// Phase 3 wealth planning: CLIENT-SIDE ILLUSTRATIVE ONLY. No external identity/financial authority.
import type {WealthState, summary, Category} from '../phase2/model';
export type Metrics=ReturnType<typeof summary>;
export type GoalMetric='NET_WORTH'|'PASSIVE_INCOME'|'POOL_BALANCE'|'INVESTMENTS'|'LIQUID_WEALTH';
export type GoalStatus='ACTIVE'|'PAUSED'|'ARCHIVED';
export type GoalPriority='HIGH'|'MEDIUM'|'LOW';
export type StrategyStatus='DRAFT'|'ACTIVE'|'ARCHIVED';
export type StrategyRisk='CONSERVATIVE'|'BALANCED'|'GROWTH';
export interface Milestone {id:string;title:string;target:number;date:string}
export interface WealthGoal {id:string;title:string;metric:GoalMetric;poolId?:string;target:number;deadline:string;priority:GoalPriority;status:GoalStatus;milestones:Milestone[];createdAt:string}
export interface TargetAllocation {id:string;label:string;percentage:number}
export interface WealthStrategy {id:string;goalId:string;name:string;description:string;risk:StrategyRisk;annualReturnPct:number;horizonYears:number;allocations:TargetAllocation[];version:number;supersedesId?:string;status:StrategyStatus;createdAt:string}
export interface IndependencePlan {monthlyLifestyleCost:number;withdrawalRatePct:number;annualInflationPct:number;assumedReturnPct:number;monthlyContribution:number;targetYear:number;updatedAt:string}
export interface PlanningState {goals:WealthGoal[];strategies:WealthStrategy[];independence:IndependencePlan}
export interface FinancialSnapshot {at:string;assets:number;liabilities:number;netWorth:number;income:number;groups:Record<Category,number>}
export type ActivityKind='VALUATION'|'POSITION'|'LIABILITY'|'CAPITAL'|'INCOME'|'OTHER';
export interface WealthActivity {id:string;at:string;kind:ActivityKind;label:string;before:FinancialSnapshot;after:FinancialSnapshot}
export interface PerformanceState {opening:FinancialSnapshot;entries:WealthActivity[]}
export const asOf='2026-10-31';
export const seedPlanning:PlanningState={
 goals:[
  {id:'g-networth',title:'KES 20M total net worth',metric:'NET_WORTH',target:20000000,deadline:'2028-12-31',priority:'HIGH',status:'ACTIVE',createdAt:asOf,milestones:[{id:'gm-net-15',title:'First KES 15M',target:15000000,date:'2027-12-31'},{id:'gm-net-18',title:'KES 18M checkpoint',target:18000000,date:'2028-08-31'}]},
  {id:'g-income',title:'KES 150K monthly passive income',metric:'PASSIVE_INCOME',target:150000,deadline:'2029-06-30',priority:'HIGH',status:'ACTIVE',createdAt:asOf,milestones:[{id:'gm-income-100',title:'Reach KES 100K a month',target:100000,date:'2027-09-30'},{id:'gm-income-125',title:'Reach KES 125K a month',target:125000,date:'2028-09-30'}]},
  {id:'g-property',title:'KES 4M property acquisition fund',metric:'POOL_BALANCE',poolId:'c-goals',target:4000000,deadline:'2029-12-31',priority:'MEDIUM',status:'ACTIVE',createdAt:asOf,milestones:[{id:'gm-prop-1',title:'First KES 1M saved',target:1000000,date:'2027-12-31'},{id:'gm-prop-2',title:'Reach KES 2M',target:2000000,date:'2028-12-31'}]}
 ],
 strategies:[
  {id:'s-wealth',goalId:'g-networth',name:'Balanced wealth acceleration',description:'Balance business exposure with investments, property and a protected liquidity buffer.',risk:'BALANCED',annualReturnPct:8,horizonYears:5,status:'ACTIVE',version:1,createdAt:asOf,allocations:[{id:'sa-business',label:'Business growth',percentage:30},{id:'sa-invest',label:'Diversified investments',percentage:35},{id:'sa-property',label:'Property capital',percentage:20},{id:'sa-cash',label:'Cash reserves',percentage:15}]},
  {id:'s-income',goalId:'g-income',name:'Recurring income expansion',description:'Develop diversified cash-generating positions while maintaining appropriate reserves.',risk:'CONSERVATIVE',annualReturnPct:6,horizonYears:5,status:'DRAFT',version:1,createdAt:asOf,allocations:[{id:'sa-income-invest',label:'Income investments',percentage:55},{id:'sa-income-prop',label:'Property income',percentage:30},{id:'sa-income-reserve',label:'Reserves',percentage:15}]}
 ],
 independence:{monthlyLifestyleCost:125000,withdrawalRatePct:4,annualInflationPct:5,assumedReturnPct:7,monthlyContribution:50000,targetYear:2035,updatedAt:asOf}
};
export function assertPositive(n:number,name:string){if(!Number.isFinite(n)||n<=0)throw new Error(name+' must be a positive number.')}
export function assertNonNegative(n:number,name:string){if(!Number.isFinite(n)||n<0)throw new Error(name+' must be zero or greater.')}
export function parseISO(date:string){const d=new Date(date+'T00:00:00Z');if(!/^\d{4}-\d\d-\d\d$/.test(date)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw new Error('Enter a valid calendar date.');return d}
export function targetMetric(goal:WealthGoal,state:WealthState,metrics:Metrics):number{
 switch(goal.metric){
 case 'NET_WORTH':return metrics.netWorth;
 case 'PASSIVE_INCOME':return metrics.passiveIncome;
 case 'POOL_BALANCE':return state.pools.find(p=>p.id===goal.poolId)?.balance??0;
 case 'INVESTMENTS':return metrics.groups.Investments;
 case 'LIQUID_WEALTH':return metrics.liquid;
 }
}
export function goalProgress(goal:WealthGoal,state:WealthState,metrics:Metrics,now=asOf){
 const current=targetMetric(goal,state,metrics),remaining=Math.max(0,goal.target-current);
 const days=Math.max(0,Math.ceil((parseISO(goal.deadline).getTime()-parseISO(now).getTime())/86400000));
 const months=days/30.4375;
 return {current,remaining,percent:goal.target?Math.max(0,Math.min(100,current/goal.target*100)):0,
  requiredPerMonth:months>0?remaining/months:remaining>0?null:0,daysLeft:days,
  isLate:days===0&&remaining>0,completed:remaining===0};
}
export function createGoal(state:WealthState,goal:WealthGoal):WealthState{
 if(!goal.title.trim())throw new Error('Goal title is required.');assertPositive(goal.target,'Target');parseISO(goal.deadline);
 if(goal.metric==='POOL_BALANCE'&&!state.pools.some(p=>p.id===goal.poolId))throw new Error('Select a valid capital pool.');
 if(state.planning.goals.some(g=>g.id===goal.id))throw new Error('Goal identifier already exists.');
 return {...state,planning:{...state.planning,goals:[...state.planning.goals,goal]}};
}
export function updateGoal(state:WealthState,id:string,patch:Partial<Pick<WealthGoal,'title'|'target'|'deadline'|'priority'|'status'>>):WealthState{
 const goal=state.planning.goals.find(g=>g.id===id);if(!goal)throw new Error('Goal not found.');
 const next={...goal,...patch};if(!next.title.trim())throw new Error('Goal title is required.');
 assertPositive(next.target,'Target');parseISO(next.deadline);
 return {...state,planning:{...state.planning,
  goals:state.planning.goals.map(g=>g.id===id?next:g),
  strategies:next.status==='ARCHIVED'?state.planning.strategies.map(s=>s.goalId===id&&s.status==='ACTIVE'?{...s,status:'ARCHIVED'}:s):state.planning.strategies
 }};
}
export function addMilestone(state:WealthState,goalId:string,milestone:Milestone):WealthState{
 const goal=state.planning.goals.find(g=>g.id===goalId);if(!goal)throw new Error('Goal not found.');
 if(!milestone.title.trim())throw new Error('Milestone name is required.');
 assertPositive(milestone.target,'Milestone target');parseISO(milestone.date);
 if(milestone.target>goal.target)throw new Error('Milestone cannot exceed the goal target.');
 if(milestone.date>goal.deadline)throw new Error('Milestone must be no later than the goal deadline.');
 if(goal.milestones.some(m=>m.id===milestone.id))throw new Error('Duplicate milestone identifier.');
 const m=[...goal.milestones,milestone].sort((a,b)=>a.target-b.target);
 return {...state,planning:{...state.planning,goals:state.planning.goals.map(g=>g.id===goalId?{...g,milestones:m}:g)}};
}
export function removeMilestone(state:WealthState,goalId:string,milestoneId:string):WealthState{
 if(!state.planning.goals.some(g=>g.id===goalId))throw new Error('Goal not found.');
 return {...state,planning:{...state.planning,goals:state.planning.goals.map(g=>g.id===goalId?{...g,milestones:g.milestones.filter(m=>m.id!==milestoneId)}:g)}};
}
export function validateStrategy(strategy:WealthStrategy,state:WealthState){
 if(!state.planning.goals.some(g=>g.id===strategy.goalId&&g.status!=='ARCHIVED'))throw new Error('Choose a current goal.');
 if(!strategy.name.trim())throw new Error('Strategy name is required.');
 assertNonNegative(strategy.annualReturnPct,'Assumed return');
 if(strategy.annualReturnPct>50)throw new Error('Assumed return cannot exceed 50% in the sample planner.');
 assertPositive(strategy.horizonYears,'Horizon');
 if(strategy.horizonYears>60)throw new Error('Planning horizon cannot exceed 60 years.');
 if(strategy.allocations.length<1)throw new Error('Include at least one target allocation.');
 if(strategy.allocations.some(a=>!a.label.trim()||!Number.isFinite(a.percentage)||a.percentage<0||a.percentage>100))throw new Error('Allocation percentages must be between 0 and 100.');
 const total=strategy.allocations.reduce((s,a)=>s+a.percentage,0);
 if(Math.abs(total-100)>0.00001)throw new Error('Target allocations must add up to 100%.');
}
export function createStrategy(state:WealthState,strategy:WealthStrategy):WealthState{
 validateStrategy(strategy,state);
 if(state.planning.strategies.some(s=>s.id===strategy.id))throw new Error('Strategy ID exists.');
 return {...state,planning:{...state.planning,strategies:[...state.planning.strategies,{...strategy,status:'DRAFT'}]}};
}
export function editDraftStrategy(state:WealthState,id:string,patch:Pick<WealthStrategy,'name'|'description'|'risk'|'annualReturnPct'|'horizonYears'|'allocations'>):WealthState{
 const original=state.planning.strategies.find(s=>s.id===id);if(!original)throw new Error('Strategy not found.');
 if(original.status!=='DRAFT')throw new Error('Only draft strategies may be edited. Create a revision first.');
 const updated={...original,...patch,allocations:patch.allocations.map(a=>({...a}))};
 validateStrategy(updated,state);
 return {...state,planning:{...state.planning,strategies:state.planning.strategies.map(s=>s.id===id?updated:s)}};
}
export function reviseStrategy(state:WealthState,id:string,newId:string):WealthState{
 const original=state.planning.strategies.find(s=>s.id===id);if(!original)throw new Error('Strategy not found.');
 const descendants=state.planning.strategies.filter(s=>s.goalId===original.goalId&&s.name===original.name);
 const version=Math.max(...descendants.map(s=>s.version))+1;
 const revision:WealthStrategy={...original,id:newId,version,supersedesId:original.id,status:'DRAFT',createdAt:new Date().toISOString().slice(0,10),allocations:original.allocations.map(a=>({...a}))};
 return {...state,planning:{...state.planning,strategies:[...state.planning.strategies,revision]}};
}
export function activateStrategy(state:WealthState,id:string):WealthState{
 const candidate=state.planning.strategies.find(s=>s.id===id);if(!candidate)throw new Error('Strategy not found.');
 validateStrategy(candidate,state);
 return {...state,planning:{...state.planning,strategies:state.planning.strategies.map(s=>s.id===id?{...s,status:'ACTIVE'}:s.goalId===candidate.goalId&&s.status==='ACTIVE'?{...s,status:'ARCHIVED'}:s)}};
}
export function updateIndependence(state:WealthState,patch:IndependencePlan):WealthState{
 assertPositive(patch.monthlyLifestyleCost,'Monthly lifestyle cost');
 assertPositive(patch.withdrawalRatePct,'Withdrawal rate');
 if(patch.withdrawalRatePct>12)throw new Error('Withdrawal rate must be 12% or lower in the planner.');
 assertNonNegative(patch.annualInflationPct,'Inflation rate');if(patch.annualInflationPct>40)throw new Error('Inflation assumption cannot exceed 40%.');
 assertNonNegative(patch.assumedReturnPct,'Assumed annual return');if(patch.assumedReturnPct>50)throw new Error('Return assumption cannot exceed 50%.');
 assertNonNegative(patch.monthlyContribution,'Monthly contributions');if(!Number.isInteger(patch.targetYear)||patch.targetYear<2026||patch.targetYear>2100)throw new Error('Choose a target year from 2026 to 2100.');
 return {...state,planning:{...state.planning,independence:patch}};
}
export function independenceMetrics(state:WealthState,metrics:Metrics){
 const p=state.planning.independence;
 const annualNeeds=p.monthlyLifestyleCost*12;
 const capitalRequired=annualNeeds/(p.withdrawalRatePct/100);
 // Eligibility rule: investments + free uncommitted cash only. Property, private-company equity and protected capital are excluded.
 const eligible=metrics.groups.Investments+metrics.deployable;
 const progress=Math.max(0,Math.min(100,eligible/capitalRequired*100));
 const incomeCoverage=p.monthlyLifestyleCost?Math.max(0,metrics.passiveIncome/p.monthlyLifestyleCost*100):0;
 return {annualNeeds,capitalRequired,eligible,capitalGap:Math.max(0,capitalRequired-eligible),progress,incomeCoverage,monthlyShortfall:Math.max(0,p.monthlyLifestyleCost-metrics.passiveIncome)};
}
export function futureValue(principal:number,monthly:number,annualRatePct:number,months:number):number{
 assertNonNegative(principal,'Opening capital');assertNonNegative(monthly,'Contribution');assertNonNegative(annualRatePct,'Return');
 if(!Number.isInteger(months)||months<0||months>1200)throw new Error('Invalid month horizon.');
 const r=annualRatePct/100/12;
 if(r===0)return principal+monthly*months;
 return principal*Math.pow(1+r,months)+monthly*((Math.pow(1+r,months)-1)/r);
}
export function independenceProjection(state:WealthState,metrics:Metrics,asOfYear=2026){
 const p=state.planning.independence;const now=independenceMetrics(state,metrics);
 const years=Math.max(0,p.targetYear-asOfYear);
 const projected=futureValue(now.eligible,p.monthlyContribution,p.assumedReturnPct,years*12);
 // Optional future-nominal target with annual lifestyle inflation; "today's KES" target is also shown separately.
 const inflatedTarget=now.capitalRequired*Math.pow(1+p.annualInflationPct/100,years);
 return {years,projected,inflatedTarget,projectedProgress:Math.min(100,projected/inflatedTarget*100)};
}
export function isPlanningState(o:unknown):o is PlanningState{
 if(!o||typeof o!=='object')return false;const p=o as Record<string,unknown>;
 return Array.isArray(p.goals)&&Array.isArray(p.strategies)&&!!p.independence&&typeof p.independence==='object';
}
export function performanceSummary(state:WealthState){
 const opening=state.performance.opening,latest=state.performance.entries.at(-1)?.after??opening;
 const delta=latest.netWorth-opening.netWorth;
 const byCategory=Object.fromEntries(Object.keys(latest.groups).map(k=>[k,(latest.groups[k as Category]??0)-(opening.groups[k as Category]??0)])) as Record<Category,number>;
 const liabilitiesDelta=latest.liabilities-opening.liabilities;
 return {opening,latest,delta,assetDelta:latest.assets-opening.assets,liabilitiesDelta,byCategory,entries:state.performance.entries};
}
