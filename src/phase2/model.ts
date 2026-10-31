import {isValidCoreState,hasValidExtensions} from '../phase6/validation';
import {seedGovernance,hydrateGovernance} from '../phase5/model';
import type {GovernanceState} from '../phase5/model';
import {seedIntelligence,isIntelligenceState} from '../phase4/model';
import type {IntelligenceState} from '../phase4/model';
import {seedPlanning,isPlanningState} from '../phase3/model';
import type {PlanningState,PerformanceState,FinancialSnapshot,ActivityKind,WealthActivity} from '../phase3/model';
// Wealth OS v2 Phase 2: deterministic CLIENT-ONLY wealth model.
// These records are fictitious and are not authoritative Finance OS/Asset OS/Company OS data.

export const categories=['Business equity','Property','Investments','Cash & reserves','Other'] as const;
export type Category=typeof categories[number];
export type Source='Company OS'|'Asset OS'|'Finance OS'|'Manual sample';
export type IncomeKind='ACTIVE'|'PASSIVE';
export interface Position {id:string;name:string;category:Category;value:number;cost:number;ownership:number;source:Source;valuedAt:string;method:string}
export interface Liability {id:string;name:string;type:string;outstanding:number;apr:number;payment:number}
export interface IncomeStream {id:string;name:string;kind:IncomeKind;monthly:number;frequency:string;trend:string}
export interface CapitalPool {id:string;name:string;purpose:string;balance:number;reserved:number;committed:number}
export interface Allocation {id:string;poolId:string;target:string;amount:number;date:string}
export interface Valuation {id:string;positionId:string;previous:number;next:number;at:string;reason:string}
export interface WealthState {positions:Position[];liabilities:Liability[];income:IncomeStream[];pools:CapitalPool[];allocations:Allocation[];valuations:Valuation[];planning:PlanningState;performance:PerformanceState;intelligence:IntelligenceState;governance:GovernanceState}
export const DEMO_DATE='2026-10-31';
export const initialState:WealthState={
 positions:[
  {id:'p-business',name:'Business ownership',category:'Business equity',value:5800000,cost:2800000,ownership:100,source:'Company OS',valuedAt:DEMO_DATE,method:'Illustrative enterprise value'},
  {id:'p-property',name:'Residential investment property',category:'Property',value:4200000,cost:3500000,ownership:100,source:'Asset OS',valuedAt:DEMO_DATE,method:'Illustrative comparable sales'},
  {id:'p-equities',name:'Diversified equities portfolio',category:'Investments',value:1500000,cost:1290000,ownership:100,source:'Asset OS',valuedAt:DEMO_DATE,method:'Illustrative market pricing'},
  {id:'p-fund',name:'Money market investment fund',category:'Investments',value:1400000,cost:1300000,ownership:100,source:'Asset OS',valuedAt:DEMO_DATE,method:'Illustrative NAV'},
  {id:'p-cash',name:'Bank and cash equivalents',category:'Cash & reserves',value:2160000,cost:2160000,ownership:100,source:'Finance OS',valuedAt:DEMO_DATE,method:'Illustrative account balance'},
  {id:'p-other',name:'Other owned assets',category:'Other',value:1040000,cost:850000,ownership:100,source:'Asset OS',valuedAt:DEMO_DATE,method:'Illustrative fair value'}
 ],
 liabilities:[
  {id:'l-mortgage',name:'Property mortgage',type:'Mortgage',outstanding:2400000,apr:11.5,payment:45000},
  {id:'l-personal',name:'Personal loan',type:'Personal loan',outstanding:860000,apr:16.9,payment:30000}
 ],
 income:[
  {id:'i-business',name:'Business owner distributions',kind:'ACTIVE',monthly:210000,frequency:'Monthly',trend:'Variable'},
  {id:'i-salary',name:'Employment income',kind:'ACTIVE',monthly:130000,frequency:'Monthly',trend:'Stable'},
  {id:'i-contract',name:'Consulting and freelance',kind:'ACTIVE',monthly:60000,frequency:'Monthly',trend:'Growing'},
  {id:'i-rent',name:'Rental income',kind:'PASSIVE',monthly:62000,frequency:'Monthly',trend:'Stable'},
  {id:'i-dividend',name:'Interest and dividends',kind:'PASSIVE',monthly:24500,frequency:'Monthly',trend:'Growing'}
 ],
 pools:[
  {id:'c-emergency',name:'Emergency reserve',purpose:'Protected safety capital',balance:780000,reserved:780000,committed:0},
  {id:'c-goals',name:'Goal capital',purpose:'Major planned commitments',balance:625000,reserved:625000,committed:0},
  {id:'c-growth',name:'Growth capital',purpose:'Investments and business',balance:460000,reserved:0,committed:375000},
  {id:'c-opportunity',name:'Opportunity fund',purpose:'Future strategic choices',balance:295000,reserved:0,committed:0}
 ],
 allocations:[{id:'a-seed',poolId:'c-growth',target:'Diversified growth plan (sample)',amount:375000,date:DEMO_DATE}],
 planning:structuredClone(seedPlanning),
 intelligence:structuredClone(seedIntelligence),
 governance:structuredClone(seedGovernance),
 performance:{opening:{at:DEMO_DATE,assets:16100000,liabilities:3260000,netWorth:12840000,income:486500,groups:{'Business equity':5800000,'Property':4200000,'Investments':2900000,'Cash & reserves':2160000,'Other':1040000}},entries:[]},
 valuations:[
  {id:'v-business',positionId:'p-business',previous:5500000,next:5800000,at:DEMO_DATE,reason:'Sample valuation update'},
  {id:'v-property',positionId:'p-property',previous:4000000,next:4200000,at:DEMO_DATE,reason:'Sample property estimate'}
 ]
};

export const amount=(x:number)=>Math.round(x*100)/100;
export function positionValue(p:Position):number{return amount(p.value*p.ownership/100)}
export function groupTotals(s:WealthState):Record<Category,number>{
 const totals=Object.fromEntries(categories.map(c=>[c,0])) as Record<Category,number>;
 s.positions.forEach(p=>{totals[p.category]+=positionValue(p)});return totals;
}
export function summary(s:WealthState){
 const groups=groupTotals(s);
 const assets=amount(Object.values(groups).reduce((a,b)=>a+b,0));
 const liabilities=amount(s.liabilities.reduce((a,l)=>a+l.outstanding,0));
 const netWorth=amount(assets-liabilities);
 const monthlyIncome=amount(s.income.reduce((a,v)=>a+v.monthly,0));
 const passiveIncome=amount(s.income.filter(v=>v.kind==='PASSIVE').reduce((a,v)=>a+v.monthly,0));
 const monthlyDebt=amount(s.liabilities.reduce((a,v)=>a+v.payment,0));
 const pooled=amount(s.pools.reduce((a,v)=>a+v.balance,0));
 const reserved=amount(s.pools.reduce((a,v)=>a+v.reserved,0));
 const committed=amount(s.pools.reduce((a,v)=>a+v.committed,0));
 const deployable=amount(s.pools.reduce((a,v)=>a+available(v),0));
 const cash=groups['Cash & reserves'];
 const liquid=amount(groups['Cash & reserves']+groups['Investments']-s.liabilities.filter(l=>l.type==='Credit card').reduce((a,l)=>a+l.outstanding,0));
 return {assets,liabilities,netWorth,groups,monthlyIncome,passiveIncome,monthlyDebt,pooled,reserved,committed,deployable,cash,liquid,debtToIncome:monthlyIncome>0?monthlyDebt/monthlyIncome:0,independence:Math.max(0,Math.min(100,(groups.Investments+deployable)/((s.planning?.independence?.monthlyLifestyleCost??125000)*12/((s.planning?.independence?.withdrawalRatePct??4)/100))*100))};
}
export function available(p:CapitalPool){return amount(Math.max(0,p.balance-p.reserved-p.committed))}
export function requirePositive(value:number,label:string){if(!Number.isFinite(value)||value<=0)throw new Error(label+' must be greater than zero.')}
export function requireNotNegative(value:number,label:string){if(!Number.isFinite(value)||value<0)throw new Error(label+' cannot be negative.')}
function findPool(s:WealthState,id:string){const pool=s.pools.find(p=>p.id===id);if(!pool)throw new Error('Capital pool not found.');return pool}
export function commitAllocation(s:WealthState,poolId:string,target:string,value:number,id:string):WealthState{
 requirePositive(value,'Allocation amount');
 if(!target.trim())throw new Error('Enter an allocation purpose.');
 const pool=findPool(s,poolId);
 if(value>available(pool))throw new Error('Allocation exceeds deployable capital in this pool.');
 return {...s,pools:s.pools.map(p=>p.id===poolId?{...p,committed:amount(p.committed+value)}:p),
 allocations:[{id,poolId,target:target.trim(),amount:value,date:DEMO_DATE},...s.allocations]};
}
export function moveCapital(s:WealthState,fromId:string,toId:string,value:number):WealthState{
 requirePositive(value,'Transfer amount');
 if(fromId===toId)throw new Error('Choose two different capital pools.');
 const source=findPool(s,fromId);findPool(s,toId);
 if(value>available(source))throw new Error('Cannot reclassify reserved or committed capital.');
 return {...s,pools:s.pools.map(p=>p.id===fromId?{...p,balance:amount(p.balance-value)}:p.id===toId?{...p,balance:amount(p.balance+value)}:p)};
}
export function revalue(s:WealthState,id:string,next:number,reason:string,valId:string):WealthState{
 requireNotNegative(next,'Valuation');
 const p=s.positions.find(x=>x.id===id);if(!p)throw new Error('Position not found.');
 if(p.category==='Cash & reserves'){
  const availableCash=summary(s).cash-positionValue(p)+next*p.ownership/100;
  if(availableCash<summary(s).pooled)throw new Error('Cash positions must continue to cover all strategic capital pools.');
 }
 return {...s,positions:s.positions.map(x=>x.id===id?{...x,value:next,valuedAt:DEMO_DATE}:x),
 valuations:[{id:valId,positionId:id,previous:p.value,next,at:DEMO_DATE,reason:reason||'Illustrative manual revaluation'},...s.valuations]};
}
export function repay(s:WealthState,id:string,value:number,poolId:string):WealthState{
 requirePositive(value,'Repayment');const liability=s.liabilities.find(x=>x.id===id);if(!liability)throw new Error('Liability not found.');
 if(value>liability.outstanding)throw new Error('Repayment cannot exceed the outstanding balance.');
 const pool=findPool(s,poolId);
 if(value>available(pool))throw new Error('Repayment exceeds uncommitted cash available in this capital pool.');
 const cash=s.positions.find(p=>p.category==='Cash & reserves'&&p.ownership===100&&p.value>=value);
 if(!cash)throw new Error('No fully owned sample cash position can fund this repayment.');
 return {...s,
  liabilities:s.liabilities.map(x=>x.id===id?{...x,outstanding:amount(x.outstanding-value)}:x),
  pools:s.pools.map(p=>p.id===poolId?{...p,balance:amount(p.balance-value)}:p),
  positions:s.positions.map(p=>p.id===cash.id?{...p,value:amount(p.value-value),valuedAt:DEMO_DATE}:p)
 };
}
export function addManualPosition(s:WealthState,p:Position):WealthState{
 requireNotNegative(p.value,'Value');requireNotNegative(p.cost,'Cost basis');
 if(!p.name.trim())throw new Error('Enter an asset name.');
 if(!Number.isFinite(p.ownership)||p.ownership<=0||p.ownership>100)throw new Error('Ownership must be between 0 and 100%.');
 return {...s,positions:[...s.positions,p]};
}
export function addStream(s:WealthState,stream:IncomeStream):WealthState{
 requirePositive(stream.monthly,'Monthly income');
 if(!stream.name.trim())throw new Error('Enter an income stream name.');
 return {...s,income:[...s.income,stream]};
}
export function addDebt(s:WealthState,debt:Liability):WealthState{
 requirePositive(debt.outstanding,'Outstanding balance');requireNotNegative(debt.payment,'Monthly payment');requireNotNegative(debt.apr,'Interest rate');
 if(!debt.name.trim())throw new Error('Enter a liability name.');
 return {...s,liabilities:[...s.liabilities,debt]};
}
export function removeStream(s:WealthState,id:string):WealthState{return {...s,income:s.income.filter(v=>v.id!==id)}}
export function isValidState(obj:unknown):obj is WealthState{
 if(!obj||typeof obj!=='object')return false;
 const d=obj as Record<string,unknown>;
 return Array.isArray(d.positions)&&d.positions.length<1000&&['liabilities','income','pools','allocations','valuations'].every(k=>Array.isArray(d[k]));
}

/** Record what changed in THIS browser's sample state, not historical market returns. */
export function financialSnapshot(s:WealthState,at:string=new Date().toISOString()):FinancialSnapshot {
 const t=summary(s);
 return {at,assets:t.assets,liabilities:t.liabilities,netWorth:t.netWorth,income:t.monthlyIncome,groups:{...t.groups}};
}
export function hydrateState(raw:unknown):WealthState{
 if(!isValidCoreState(raw)||!hasValidExtensions(raw))return structuredClone(initialState);
 const candidate=raw as WealthState;
 const planning=isPlanningState(candidate.planning)?candidate.planning:structuredClone(seedPlanning);
 const intelligence=isIntelligenceState(candidate.intelligence)?candidate.intelligence:structuredClone(seedIntelligence);
 const governance=hydrateGovernance(candidate.governance);
 const previous=candidate.performance;
 const prepared:WealthState={...candidate,planning,intelligence,governance,performance:initialState.performance};
 const valid=previous&&previous.opening&&Array.isArray(previous.entries)&&typeof previous.opening.netWorth==='number';
 return {...prepared,performance:valid?previous:{opening:financialSnapshot(prepared),entries:[]}};
}
export function appendActivity(before:WealthState,after:WealthState):WealthState{
 const domains=['positions','liabilities','income','pools'] as const;
 if(!domains.some(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])))return after;
 const kind:ActivityKind=JSON.stringify(before.liabilities)!==JSON.stringify(after.liabilities)?'LIABILITY'
  :JSON.stringify(before.positions)!==JSON.stringify(after.positions)
  ?before.positions.length!==after.positions.length?'POSITION':'VALUATION'
  :JSON.stringify(before.pools)!==JSON.stringify(after.pools)?'CAPITAL'
  :JSON.stringify(before.income)!==JSON.stringify(after.income)?'INCOME':'OTHER';
 const label:Record<ActivityKind,string>={VALUATION:'Illustrative holding valuation revised',POSITION:'Sample portfolio position changed',LIABILITY:'Sample liability balance changed',CAPITAL:'Strategic capital plan updated',INCOME:'Modeled income stream updated',OTHER:'Sample wealth state changed'};
 const entry:WealthActivity={id:'event-'+new Date().getTime().toString(36)+'-'+Math.random().toString(36).slice(2,7),at:new Date().toISOString(),kind,label:label[kind],before:financialSnapshot(before),after:financialSnapshot(after)};
 return {...after,performance:{...after.performance,entries:[...after.performance.entries,entry].slice(-200)}};
}
