import {describe,it,expect} from 'vitest';
import {initialState,summary,groupTotals,commitAllocation,moveCapital,revalue,repay,addManualPosition,addStream,addDebt,available,removeStream} from './model';
describe('Balance sheet and capital boundaries',()=>{
 it('reconciles sample wealth and deployable capital',()=>{
  const m=summary(initialState);
  expect(m.assets).toBe(16100000);
  expect(m.liabilities).toBe(3260000);
  expect(m.netWorth).toBe(12840000);
  expect(m.cash).toBe(2160000);
  expect(m.pooled).toBe(2160000);
  expect(m.reserved).toBe(1405000);
  expect(m.committed).toBe(375000);
  expect(m.deployable).toBe(380000);
  expect(m.passiveIncome).toBe(86500);
 });
 it('does not add strategic pool balances to asset totals',()=>{
  const m=summary(initialState);
  expect(m.assets).toBe(Object.values(groupTotals(initialState)).reduce((sum,val)=>sum+val,0));
  const next=commitAllocation(initialState,'c-opportunity','long-term investments',100000,'a-new');
  expect(summary(next).assets).toBe(m.assets);
  expect(summary(next).netWorth).toBe(m.netWorth);
  expect(summary(next).deployable).toBe(m.deployable-100000);
  expect(summary(next).committed).toBe(m.committed+100000);
 });
 it('enforces availability limits and finite positive amounts',()=>{
  expect(()=>commitAllocation(initialState,'c-emergency','attempt',1,'a')).toThrow();
  expect(()=>commitAllocation(initialState,'c-growth','attempt',85001,'a')).toThrow();
  expect(()=>commitAllocation(initialState,'c-opportunity','attempt',Number.NaN,'a')).toThrow();
 });
 it('reclassifies only free capital without creating cash',()=>{
  const moved=moveCapital(initialState,'c-opportunity','c-growth',50000);
  expect(summary(moved).pooled).toBe(summary(initialState).pooled);
  expect(summary(moved).cash).toBe(summary(initialState).cash);
  expect(summary(moved).netWorth).toBe(summary(initialState).netWorth);
  expect(available(moved.pools.find(p=>p.id==='c-opportunity')!)).toBe(245000);
  expect(()=>moveCapital(initialState,'c-emergency','c-growth',1)).toThrow();
 });
 it('revalues with an immutable-style append-only history',()=>{
  const changed=revalue(initialState,'p-property',4400000,'revised estimate','v-new');
  expect(summary(changed).netWorth).toBe(summary(initialState).netWorth+200000);
  expect(changed.valuations[0].previous).toBe(4200000);
  expect(changed.valuations[0].next).toBe(4400000);
  expect(initialState.positions.find(p=>p.id==='p-property')!.value).toBe(4200000);
  expect(()=>revalue(initialState,'p-cash',1000000,'shortage','v2')).toThrow();
 });
 it('ownership-adjusts new manual holdings',()=>{
  const changed=addManualPosition(initialState,{id:'p-new',name:'Joint sample holding',category:'Property',value:400000,cost:300000,ownership:50,source:'Manual sample',valuedAt:'2026-10-31',method:'Sample'});
  expect(summary(changed).assets).toBe(summary(initialState).assets+200000);
  expect(()=>addManualPosition(initialState,{id:'bad',name:'bad',category:'Other',value:100,cost:100,ownership:120,source:'Manual sample',valuedAt:'2026-10-31',method:'Sample'})).toThrow();
 });
});
describe('Income and liability accounting',()=>{
 it('adds and removes an income stream without changing net worth',()=>{
  const changed=addStream(initialState,{id:'i-new',name:'Test interest',kind:'PASSIVE',monthly:1000,frequency:'Monthly',trend:'Stable'});
  expect(summary(changed).passiveIncome).toBe(87500);
  expect(summary(changed).netWorth).toBe(summary(initialState).netWorth);
  expect(summary(removeStream(changed,'i-new')).passiveIncome).toBe(86500);
 });
 it('repayment uses uncommitted cash, reducing assets and debt equally',()=>{
  const old=summary(initialState),next=repay(initialState,'l-personal',25000,'c-opportunity'),updated=summary(next);
  expect(updated.cash).toBe(old.cash-25000);
  expect(updated.pooled).toBe(old.pooled-25000);
  expect(updated.liabilities).toBe(old.liabilities-25000);
  expect(updated.netWorth).toBe(old.netWorth);
  expect(updated.deployable).toBe(old.deployable-25000);
 });
 it('rejects unsafe repayment funding',()=>{
  expect(()=>repay(initialState,'l-personal',25000,'c-emergency')).toThrow();
  expect(()=>repay(initialState,'l-personal',350000,'c-opportunity')).toThrow();
  expect(()=>repay(initialState,'l-personal',1000000,'c-opportunity')).toThrow();
 });
 it('newly discovered debt lowers net worth without inventing cash',()=>{
  const changed=addDebt(initialState,{id:'l-new',name:'Undisclosed existing obligation',type:'Personal loan',outstanding:100000,apr:10,payment:2000});
  expect(summary(changed).liabilities).toBe(summary(initialState).liabilities+100000);
  expect(summary(changed).netWorth).toBe(summary(initialState).netWorth-100000);
 });
});
