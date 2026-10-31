// Wealth OS Phase 5 — governed PLANNING ONLY. Browser-local demo, never financial authority.
import {summary} from '../phase2/model';
import type {WealthState} from '../phase2/model';
import {evaluateRisks,assessOpportunity} from '../phase4/model';
import {goalProgress,independenceMetrics} from '../phase3/model';

export type DecisionOrigin='OPPORTUNITY'|'RISK'|'GOAL';
export type DecisionStage='DRAFT'|'UNDER_REVIEW'|'PLANNING_APPROVED'|'DECLINED'|'CLOSED';
export interface Proposal {id:string;origin:DecisionOrigin;sourceId:string;title:string;summary:string;capital:number;priority:'HIGH'|'MEDIUM'|'LOW';sourceLabel:string}
export interface DecisionCase {id:string;sourceId:string;origin:DecisionOrigin;title:string;summary:string;rationale:string;requestedCapital:number;stage:DecisionStage;createdAt:string;updatedAt:string;reviewPolicyVersion?:number;reviewSignature?:string}
export interface GovernanceEvent {id:string;caseId?:string;occurredAt:string;action:string;detail:string;actor:'Local browser demo'}
export interface PlanningPolicy {minReserveMonths:number;maxCommitmentPct:number;maxBusinessConcentrationPct:number;maxValuationAgeDays:number;requireRationale:boolean}
export interface PrivacyPrefs {includeAuditInExport:boolean;showSensitiveDemoValues:boolean;rememberAdvisorSessions:boolean;familySharingIntent:boolean}
export interface WorkspaceSettings {currency:'KES';locale:'en-KE';reportPeriod:'CURRENT'|'ALL';defaultScreen:'dashboard'|'decisions'|'reports';compactDisplay:boolean}
export interface GovernanceState {policy:PlanningPolicy;policyVersion:number;cases:DecisionCase[];events:GovernanceEvent[];privacy:PrivacyPrefs;settings:WorkspaceSettings}
export const seedGovernance:GovernanceState={
 policy:{minReserveMonths:6,maxCommitmentPct:80,maxBusinessConcentrationPct:50,maxValuationAgeDays:365,requireRationale:true},
 policyVersion:1,cases:[],events:[],
 privacy:{includeAuditInExport:true,showSensitiveDemoValues:true,rememberAdvisorSessions:false,familySharingIntent:false},
 settings:{currency:'KES',locale:'en-KE',reportPeriod:'CURRENT',defaultScreen:'dashboard',compactDisplay:false}
};
export const phase5At='2026-10-31';
const dateNow=()=>new Date().toISOString();
const uid=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
function event(action:string,detail:string,caseId?:string):GovernanceEvent{
 return {id:uid(),caseId,occurredAt:dateNow(),action,detail,actor:'Local browser demo'};
}
export function isGovernanceState(value:unknown):value is GovernanceState{
 if(!value||typeof value!=='object')return false;
 const x=value as Record<string,unknown>;
 return Array.isArray(x.cases)&&Array.isArray(x.events)&&Number.isInteger(x.policyVersion)&&
  !!x.policy&&typeof x.policy==='object'&&!!x.privacy&&typeof x.privacy==='object'&&!!x.settings&&typeof x.settings==='object';
}
export function hydrateGovernance(value:unknown):GovernanceState{
 if(!isGovernanceState(value))return structuredClone(seedGovernance);
 const x=value as GovernanceState;
 // Non-destructive migration of older locally saved sample governance fields.
 return {...structuredClone(seedGovernance),...x,policy:{...seedGovernance.policy,...x.policy},privacy:{...seedGovernance.privacy,...x.privacy},settings:{...seedGovernance.settings,...x.settings},
 cases:x.cases.slice(-500),events:x.events.slice(-750)};
}
export function proposals(state:WealthState):Proposal[]{
 const risks=evaluateRisks(state),wealth=summary(state);
 const opportunity:Proposal[]=state.intelligence.opportunities.filter(o=>o.status!=='REJECTED').map(o=>{
  const fit=assessOpportunity(state,o);
  return {id:'proposal-opportunity-'+o.id,origin:'OPPORTUNITY' as const,sourceId:o.id,
   title:'Review · '+o.title,summary:'Strategic research idea; '+fit.score+'/100 heuristic fit. '+(fit.eligible?'Within sample funding checks.':'Fails sample funding guardrails.'),
   capital:o.capitalRequired,priority:fit.eligible?'MEDIUM' as const:'HIGH' as const,sourceLabel:'Opportunity Lab'};
 });
 const risk:Proposal[]=risks.signals.filter(s=>s.severity!=='OK').map(s=>({
  id:'proposal-risk-'+s.id,origin:'RISK' as const,sourceId:s.id,title:'Review · '+s.title,
  summary:s.observed+' · '+s.nextStep,capital:0,priority:s.severity==='HIGH'?'HIGH' as const:'MEDIUM' as const,sourceLabel:'Risk Center'
 }));
 const goals:Proposal[]=state.planning.goals.filter(g=>g.status==='ACTIVE'&&!goalProgress(g,state,wealth).completed).map(g=>({
  id:'proposal-goal-'+g.id,origin:'GOAL' as const,sourceId:g.id,title:'Plan · '+g.title,
  summary:goalProgress(g,state,wealth).percent.toFixed(1)+'% measured progress toward '+g.deadline,
  capital:0,priority:g.priority,sourceLabel:'Goals & Milestones'
 }));
 return [...opportunity,...risk,...goals];
}
export function createCase(state:WealthState,proposalId:string,rationale:string):WealthState{
 const proposal=proposals(state).find(p=>p.id===proposalId);
 if(!proposal)throw Error('The source recommendation is unavailable; refresh the proposals.');
 if(!rationale.trim())throw Error('Enter a planning rationale for this case.');
 if(rationale.trim().length>600)throw Error('Rationale must be 600 characters or shorter.');
 if(state.governance.cases.some(c=>c.origin===proposal.origin&&c.sourceId===proposal.sourceId&&['DRAFT','UNDER_REVIEW','PLANNING_APPROVED'].includes(c.stage)))throw Error('This proposal already has an open planning case.');
 const now=dateNow(),record:DecisionCase={id:uid(),sourceId:proposal.sourceId,origin:proposal.origin,title:proposal.title,summary:proposal.summary,rationale:rationale.trim(),requestedCapital:proposal.capital,stage:'DRAFT',createdAt:now,updatedAt:now};
 return {...state,governance:{...state.governance,cases:[record,...state.governance.cases],events:[event('CASE_CREATED','Local planning case created from '+proposal.sourceLabel+'.',record.id),...state.governance.events].slice(0,750)}};
}
export function policyFingerprint(state:WealthState):string{
 // Includes every source used in Phase 5 policy evaluation. No hashes/security guarantees.
 return JSON.stringify({
  version:state.governance.policyVersion,policy:state.governance.policy,
  positions:state.positions.map(p=>[p.id,p.category,p.value,p.ownership,p.valuedAt]),
  liabilities:state.liabilities.map(l=>[l.id,l.outstanding,l.payment,l.apr]),
  pools:state.pools.map(p=>[p.id,p.balance,p.reserved,p.committed]),
  income:state.income.map(i=>[i.id,i.monthly]),
  monthlyLifestyleCost:state.planning.independence.monthlyLifestyleCost,
  opportunities:state.intelligence.opportunities.map(o=>[o.id,o.status,o.capitalRequired]),
  goals:state.planning.goals.map(g=>[g.id,g.status,g.target])
 });
}
export interface PolicyEvaluation {pass:boolean;blockers:string[];checks:{name:string;pass:boolean;observed:string;condition:string}[];version:number;signature:string}
export function evaluateCase(state:WealthState,c:DecisionCase,at:string=dateNow().slice(0,10)):PolicyEvaluation{
 const p=state.governance.policy,m=summary(state),checks:PolicyEvaluation['checks']=[];
 const include=(name:string,pass:boolean,observed:string,condition:string)=>checks.push({name,pass,observed,condition});
 const emergency=state.pools.find(x=>x.id==='c-emergency');
 const reserveMonths=state.planning.independence.monthlyLifestyleCost>0?(emergency?.reserved??0)/state.planning.independence.monthlyLifestyleCost:0;
 include('Emergency reserve',reserveMonths>=p.minReserveMonths,reserveMonths.toFixed(1)+' months','At least '+p.minReserveMonths+' months');
 const needsCash=c.requestedCapital>0;
 include('Deployable capital',!needsCash||c.requestedCapital<=m.deployable,needsCash?'KES '+c.requestedCapital.toLocaleString('en-KE')+' requested / KES '+m.deployable.toLocaleString('en-KE')+' available':'No cash commitment','Requested ≤ current uncommitted cash');
 const maxCommitment=m.deployable*p.maxCommitmentPct/100;
 include('Single commitment cap',!needsCash||c.requestedCapital<=maxCommitment,needsCash?'KES '+c.requestedCapital.toLocaleString('en-KE'):'No cash commitment','Requested ≤ '+p.maxCommitmentPct+'% of deployable capital');
 const linkedOpportunity=c.origin==='OPPORTUNITY'?state.intelligence.opportunities.find(o=>o.id===c.sourceId):undefined;
 const opportunityEligible=!linkedOpportunity||assessOpportunity(state,linkedOpportunity).eligible;
 include('Opportunity research eligibility',opportunityEligible,linkedOpportunity?(opportunityEligible?'Passes Phase 4 risk/cash gates':'Blocked by Phase 4 risk/cash gates'):'Not an opportunity','Pass Phase 4 sample funding and reserve gates');
 const concentration=m.assets>0?m.groups['Business equity']/m.assets*100:0;
 const linkedOpp=linkedOpportunity;
 const businessRelated=linkedOpp?.kind==='BUSINESS';
 include('Business exposure for expansion',!businessRelated||concentration<=p.maxBusinessConcentrationPct,concentration.toFixed(1)+'% gross assets','Business expansion only if ≤ '+p.maxBusinessConcentrationPct+'%');
 const today=Date.parse(at+'T00:00:00Z');
 const age=state.positions.reduce((age,x)=>{const time=Date.parse(x.valuedAt+'T00:00:00Z');return Math.max(age,Number.isFinite(time)?Math.max(0,Math.floor((today-time)/86400000)):Infinity)},0);
 include('Valuation evidence freshness',Number.isFinite(age)&&age<=p.maxValuationAgeDays,Number.isFinite(age)?age+' days oldest':'Undated positions','Oldest valuation ≤ '+p.maxValuationAgeDays+' days');
 include('Decision rationale',!p.requireRationale||c.rationale.trim().length>=20,c.rationale.trim().length+' characters','At least 20 characters when enabled');
 const srcAvailable=c.origin==='RISK'?evaluateRisks(state,at).signals.some(x=>x.id===c.sourceId&&x.severity!=='OK'):
 c.origin==='OPPORTUNITY'?!!linkedOpp&&linkedOpp.status!=='REJECTED':
 state.planning.goals.some(g=>g.id===c.sourceId&&g.status==='ACTIVE');
 include('Source still current',srcAvailable,srcAvailable?'Active source':'Missing, resolved or rejected source','Active source required');
 const blockers=checks.filter(x=>!x.pass).map(x=>x.name+': '+x.observed+' ('+x.condition+')');
 return {pass:!blockers.length,blockers,checks,version:state.governance.policyVersion,signature:policyFingerprint(state)};
}
export function submitReview(state:WealthState,id:string,at?:string):WealthState{
 const c=state.governance.cases.find(x=>x.id===id);
 if(!c)throw Error('Planning case not found.');
 if(c.stage!=='DRAFT'&&c.stage!=='UNDER_REVIEW')throw Error('Only drafts or already reviewed cases may be submitted.');
 const reviewed=evaluateCase(state,c,at);
 return {...state,governance:{...state.governance,
  cases:state.governance.cases.map(x=>x.id===id?{...x,stage:'UNDER_REVIEW' as const,reviewPolicyVersion:reviewed.version,reviewSignature:reviewed.signature,updatedAt:dateNow()}:x),
  events:[event('REVIEW_REQUESTED','Local policy assessment recorded; '+reviewed.blockers.length+' blockers.',id),...state.governance.events].slice(0,750)
 }};
}
export function reviseCaseRationale(state:WealthState,id:string,rationale:string):WealthState{
 const c=state.governance.cases.find(x=>x.id===id);
 if(!c||!['DRAFT','UNDER_REVIEW'].includes(c.stage))throw Error('Only open planning cases can be revised.');
 if(!rationale.trim()||rationale.trim().length>600)throw Error('Enter a rationale of 1–600 characters.');
 return {...state,governance:{...state.governance,
  cases:state.governance.cases.map(x=>x.id===id?{...x,rationale:rationale.trim(),stage:'DRAFT' as const,reviewPolicyVersion:undefined,reviewSignature:undefined,updatedAt:dateNow()}:x),
  events:[event('RATIONALE_REVISED','Local rationale revised; a new policy review is required.',id),...state.governance.events].slice(0,750)
 }};
}
export function approveForPlanning(state:WealthState,id:string,at?:string):WealthState{
 const c=state.governance.cases.find(x=>x.id===id);
 if(!c||c.stage!=='UNDER_REVIEW')throw Error('Submit this case for local review first.');
 const evaluation=evaluateCase(state,c,at);
 if(!evaluation.pass)throw Error('Cannot acknowledge planning approval: '+evaluation.blockers.join('; '));
 if(c.reviewPolicyVersion!==evaluation.version||c.reviewSignature!==evaluation.signature)throw Error('Source data or policy changed. Re-submit this case for fresh review.');
 return {...state,governance:{...state.governance,
  cases:state.governance.cases.map(x=>x.id===id?{...x,stage:'PLANNING_APPROVED' as const,updatedAt:dateNow()}:x),
  events:[event('PLANNING_ACKNOWLEDGED','Local planning-only acknowledgement. NO transaction authorization or finance execution.',id),...state.governance.events].slice(0,750)
 }};
}
export function declineCase(state:WealthState,id:string,reason:string):WealthState{
 const c=state.governance.cases.find(x=>x.id===id);
 if(!c||c.stage==='CLOSED'||c.stage==='DECLINED')throw Error('This case is no longer open for decline.');
 if(reason.trim().length<8)throw Error('Provide a reason of at least 8 characters.');
 return {...state,governance:{...state.governance,
  cases:state.governance.cases.map(x=>x.id===id?{...x,stage:'DECLINED' as const,updatedAt:dateNow()}:x),
  events:[event('CASE_DECLINED',reason.trim().slice(0,240),id),...state.governance.events].slice(0,750)
 }};
}
export function closeCase(state:WealthState,id:string,reason:string):WealthState{
 const c=state.governance.cases.find(x=>x.id===id);
 if(!c||c.stage!=='PLANNING_APPROVED')throw Error('Only acknowledged planning cases may be closed.');
 if(reason.trim().length<8)throw Error('Provide a closure note of at least 8 characters.');
 return {...state,governance:{...state.governance,
  cases:state.governance.cases.map(x=>x.id===id?{...x,stage:'CLOSED' as const,updatedAt:dateNow()}:x),
  events:[event('CASE_CLOSED',reason.trim().slice(0,240),id),...state.governance.events].slice(0,750)
 }};
}
export function validatePolicy(policy:PlanningPolicy):PlanningPolicy{
 const check=(n:number,min:number,max:number,label:string)=>{if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' must be between '+min+' and '+max+'.')};
 check(policy.minReserveMonths,0,36,'Reserve months');
 check(policy.maxCommitmentPct,1,100,'Commitment cap');
 check(policy.maxBusinessConcentrationPct,0,100,'Business concentration cap');
 check(policy.maxValuationAgeDays,1,3650,'Valuation age');
 if(typeof policy.requireRationale!=='boolean')throw Error('Rationale requirement must be true or false.');
 return policy;
}
export function updatePolicy(state:WealthState,policy:PlanningPolicy):WealthState{
 validatePolicy(policy);
 if(JSON.stringify(state.governance.policy)===JSON.stringify(policy))return state;
 return {...state,governance:{...state.governance,policy:{...policy},policyVersion:state.governance.policyVersion+1,
  events:[event('SAMPLE_POLICY_CHANGED','Local policy revision '+(state.governance.policyVersion+1)+'; existing reviews must be repeated.'),...state.governance.events].slice(0,750)}};
}
export function updatePrivacy(state:WealthState,privacy:PrivacyPrefs):WealthState{
 if(Object.values(privacy).some(x=>typeof x!=='boolean'))throw Error('Privacy preferences must be boolean.');
 return {...state,governance:{...state.governance,privacy:{...privacy},
 events:[event('DEMO_PREFERENCE_CHANGED','Browser-local privacy/export preference revised.'),...state.governance.events].slice(0,750)}};
}
export function updateWorkspaceSettings(state:WealthState,settings:WorkspaceSettings):WealthState{
 if(settings.currency!=='KES'||settings.locale!=='en-KE')throw Error('Only KES/en-KE presentation is available; no exchange rates are connected.');
 if(!['CURRENT','ALL'].includes(settings.reportPeriod)||!['dashboard','decisions','reports'].includes(settings.defaultScreen)||typeof settings.compactDisplay!=='boolean')throw Error('Invalid workspace settings.');
 return {...state,governance:{...state.governance,settings:{...settings}}};
}
export interface ReportData {generatedAt:string;label:string;netWorth:number;assets:number;liabilities:number;cash:number;reserves:number;committed:number;deployable:number;passiveMonthly:number;monthlyIncome:number;debtService:number;investmentAssets:number;independenceTarget:number;independenceEligible:number;goals:{name:string;current:number;target:number;progress:number;date:string}[];risks:{title:string;severity:string;observed:string}[];decisions:{title:string;stage:DecisionStage;amount:number;date:string}[];events:GovernanceEvent[]}
export function buildReport(state:WealthState,generatedAt:string=dateNow()):ReportData{
 const m=summary(state),ind=independenceMetrics(state,m);
 const risks=evaluateRisks(state,generatedAt.slice(0,10));
 return {generatedAt,label:'Illustrative Wealth OS browser-local report',netWorth:m.netWorth,assets:m.assets,liabilities:m.liabilities,cash:m.cash,reserves:m.reserved,committed:m.committed,deployable:m.deployable,passiveMonthly:m.passiveIncome,monthlyIncome:m.monthlyIncome,debtService:m.monthlyDebt,investmentAssets:m.groups.Investments,independenceTarget:ind.capitalRequired,independenceEligible:ind.eligible,
 goals:state.planning.goals.filter(g=>g.status!=='ARCHIVED').map(g=>{const p=goalProgress(g,state,m);return {name:g.title,current:p.current,target:g.target,progress:p.percent,date:g.deadline}}),
 risks:risks.signals.map(x=>({title:x.title,severity:x.severity,observed:x.observed})),
 decisions:state.governance.cases.map(x=>({title:x.title,stage:x.stage,amount:x.requestedCapital,date:x.updatedAt})),
 events:state.governance.privacy.includeAuditInExport&&state.governance.settings.reportPeriod==='ALL'?[...state.governance.events]:[]};
}
function csvValue(value:string|number){
 const s=String(value);
 // Prevent formula injection in Excel / Sheets by escaping user-controlled cell starts.
 const safe=/^[\s]*[=+@\-\t\r]/.test(s)&&typeof value==='string'?"'"+s:s;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export function reportCsv(report:ReportData):string{
 const rows:[string,string|number][]=[
 ['Report type',report.label],['Generated at',report.generatedAt],
 ['Gross assets',report.assets],['Liabilities',report.liabilities],['Net worth',report.netWorth],
 ['Cash',report.cash],['Protected reserves',report.reserves],['Committed capital',report.committed],['Deployable capital',report.deployable],
 ['Investments',report.investmentAssets],['Monthly income',report.monthlyIncome],['Monthly passive income',report.passiveMonthly],
 ['Monthly debt service',report.debtService],['Independence target',report.independenceTarget],['Eligible independence capital',report.independenceEligible],
 ...report.goals.map(g=>['Goal: '+g.name,g.progress] as [string,number]),
 ...report.risks.map(r=>['Risk: '+r.title,r.severity+' · '+r.observed] as [string,string]),
 ...report.decisions.map(d=>['Decision: '+d.title,d.stage] as [string,string])
 ];
 return '\uFEFF'+'Metric,Value\r\n'+rows.map(([a,b])=>csvValue(a)+','+csvValue(b)).join('\r\n')+'\r\n';
}
export function reportJson(report:ReportData):string{return JSON.stringify({...report,notice:'Fictional sample, browser-local. No live account, financial institution or user identity has been verified.'},null,2)}
