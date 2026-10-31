/** Strict validation for untrusted browser-local demo state and JSON backups.
 * This is not authentication, encryption, or a security boundary for real financial data. */
import type {WealthState} from '../phase2/model';
const categories=new Set(['Business equity','Property','Investments','Cash & reserves','Other']);
const sources=new Set(['Company OS','Asset OS','Finance OS','Manual sample']);
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const txt=(v:unknown,max=500)=>typeof v==='string'&&v.length>0&&v.length<=max;
const str=(v:unknown,max=500)=>typeof v==='string'&&v.length<=max;
const val=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e15;
const pct=(v:unknown)=>val(v)&&(v as number)<=100;
const positive=(v:unknown)=>val(v)&&(v as number)>0;
const date=(v:unknown)=>txt(v,30)&&/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v as string)&&Number.isFinite(Date.parse(v as string));
function rows(v:unknown,max:number,check:(v:Record<string,unknown>)=>boolean){
 return Array.isArray(v)&&v.length<=max&&v.every(x=>plain(x)&&check(x))&&new Set(v.map(x=>x.id)).size===v.length;
}
export function isValidCoreState(input:unknown):input is WealthState {
 if(!plain(input))return false;
 const s=input;
 if(!rows(s.positions,1000,p=>txt(p.id,100)&&txt(p.name,150)&&categories.has(String(p.category))&&
 val(p.value)&&val(p.cost)&&positive(p.ownership)&&(p.ownership as number)<=100&&
 sources.has(String(p.source))&&date(p.valuedAt)&&str(p.method,350)))return false;
 if(!rows(s.liabilities,1000,p=>txt(p.id,100)&&txt(p.name,150)&&txt(p.type,80)&&val(p.outstanding)&&val(p.apr)&&val(p.payment)))return false;
 if(!rows(s.income,1000,p=>txt(p.id,100)&&txt(p.name,150)&&['ACTIVE','PASSIVE'].includes(String(p.kind))&&
 val(p.monthly)&&str(p.frequency,80)&&str(p.trend,80)))return false;
 if(!rows(s.pools,100,p=>txt(p.id,100)&&txt(p.name,150)&&txt(p.purpose,250)&&val(p.balance)&&
 val(p.reserved)&&val(p.committed)&&(p.reserved as number)+(p.committed as number)<=(p.balance as number)+1e-5))return false;
 if(!rows(s.allocations,3000,p=>txt(p.id,100)&&txt(p.poolId,100)&&txt(p.target,250)&&positive(p.amount)&&date(p.date)))return false;
 if(!rows(s.valuations,5000,p=>txt(p.id,100)&&txt(p.positionId,100)&&val(p.previous)&&val(p.next)&&date(p.at)&&str(p.reason,500)))return false;
 const positions=s.positions as Record<string,unknown>[];
 const pools=s.pools as Record<string,unknown>[];
 const ids=new Set(positions.map(x=>x.id)),poolIds=new Set(pools.map(x=>x.id));
 if((s.allocations as Record<string,unknown>[]).some(x=>!poolIds.has(x.poolId)))return false;
 if((s.valuations as Record<string,unknown>[]).some(x=>!ids.has(x.positionId)))return false;
 const cash=positions.filter(x=>x.category==='Cash & reserves').reduce((n,p)=>n+(p.value as number)*(p.ownership as number)/100,0);
 const pooled=pools.reduce((n,p)=>n+(p.balance as number),0);
 if(pooled>cash+0.01)return false;
 return true;
}
export function hasValidExtensions(input:unknown):boolean {
 if(!plain(input))return false;
 // Legacy Phase 2/3/4 workspaces may legitimately lack newer sections.
 if(input.planning!==undefined){
  const p=input.planning;
  if(!plain(p)||!Array.isArray(p.goals)||!Array.isArray(p.strategies)||!plain(p.independence))return false;
  if(p.goals.length>500||p.strategies.length>500)return false;
  if(!p.goals.every((g:unknown)=>plain(g)&&txt(g.id,100)&&txt(g.title,150)&&positive(g.target)&&date(g.deadline)&&Array.isArray(g.milestones)&&g.milestones.length<=100&&g.milestones.every((m:unknown)=>plain(m)&&txt(m.id,100)&&txt(m.title,150)&&positive(m.target)&&date(m.date))))return false;
  if(!p.strategies.every((s:unknown)=>plain(s)&&txt(s.id,100)&&txt(s.goalId,100)&&txt(s.name,150)&&Array.isArray(s.allocations)&&s.allocations.length<=30&&s.allocations.every((a:unknown)=>plain(a)&&txt(a.id,100)&&txt(a.label,100)&&pct(a.percentage))))return false;
  if(!positive(p.independence.monthlyLifestyleCost)||!positive(p.independence.withdrawalRatePct)||!val(p.independence.monthlyContribution))return false;
 }
 if(input.intelligence!==undefined){
  const v=input.intelligence;
  if(!plain(v)||!Array.isArray(v.opportunities)||!Array.isArray(v.scenarios)||!plain(v.forecast)||v.opportunities.length>500||v.scenarios.length>100)return false;
  if(!v.opportunities.every((o:unknown)=>plain(o)&&txt(o.id,100)&&txt(o.title,150)&&positive(o.capitalRequired)))return false;
  if(!v.scenarios.every((x:unknown)=>plain(x)&&txt(x.id,100)&&txt(x.title,150)&&positive(x.amount)))return false;
 }
 if(input.governance!==undefined){
  const v=input.governance;
  if(!plain(v)||!plain(v.policy)||!plain(v.privacy)||!plain(v.settings)||!Array.isArray(v.cases)||!Array.isArray(v.events)||v.cases.length>500||v.events.length>750||!Number.isInteger(v.policyVersion))return false;
  if(!v.cases.every((c:unknown)=>plain(c)&&txt(c.id,100)&&txt(c.title,200)&&txt(c.rationale,600)&&txt(c.sourceId,100)&&val(c.requestedCapital)&&['DRAFT','UNDER_REVIEW','PLANNING_APPROVED','DECLINED','CLOSED'].includes(String(c.stage))))return false;
 }
 return true;
}
