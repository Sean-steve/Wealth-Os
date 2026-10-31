import {describe,it,expect} from 'vitest';
import {initialState,hydrateState,revalue,summary,commitAllocation} from '../phase2/model';
import {updateGoal} from '../phase3/model';
import {updateOpportunityStatus} from '../phase4/model';
import {
 seedGovernance,isGovernanceState,proposals,createCase,policyFingerprint,evaluateCase,submitReview,approveForPlanning,
 reviseCaseRationale,declineCase,closeCase,updatePolicy,validatePolicy,updatePrivacy,updateWorkspaceSettings,
 buildReport,reportCsv,reportJson
} from './model';
import type {DecisionCase,PlanningPolicy,PrivacyPrefs,WorkspaceSettings} from './model';

const DATE='2026-10-31';
const REASON='Review this hypothetical option against current sample reserves, goals and valuation evidence.';
const demo=()=>structuredClone(initialState);
function newOppCase(s=demo(),id='proposal-opportunity-opp-diversify'){
 const next=createCase(s,id,REASON);return {state:next,caseId:next.governance.cases[0].id};
}
function underReview(){
 const x=newOppCase();
 return {state:submitReview(x.state,x.caseId,DATE),caseId:x.caseId};
}
describe('Phase 5 — non-destructive migration and local record boundaries',()=>{
 it('retains old Phase 4 wealth, goals and intelligence when adding governance',()=>{
  const original=demo(),wealth=commitAllocation(original,'c-opportunity','illustrative funding',10000,'migrate-test');
  const {governance:old,...legacy}=wealth;expect(old).toBeTruthy();
  const restored=hydrateState(legacy);
  expect(summary(restored).netWorth).toBe(summary(wealth).netWorth);
  expect(summary(restored).committed).toBe(summary(wealth).committed);
  expect(restored.intelligence.opportunities).toHaveLength(3);
  expect(restored.planning.goals).toHaveLength(3);
  expect(restored.governance.policyVersion).toBe(1);
  expect(restored.governance.cases).toHaveLength(0);
 });
 it('restores new governance default if an old workspace has no governance',()=>{
  const s=demo(),{governance:ignored,...legacy}=s;expect(ignored).toBeDefined();
  expect(isGovernanceState(legacy)).toBe(false);
  expect(hydrateState(legacy).governance).toEqual(seedGovernance);
 });
 it('has no fabricated approved decisions or audit events on initial launch',()=>{
  const s=demo();
  expect(s.governance.cases).toHaveLength(0);
  expect(s.governance.events).toHaveLength(0);
  expect(s.governance.privacy.rememberAdvisorSessions).toBe(false);
 });
});
describe('Phase 5 — evidence-backed proposal lifecycle',()=>{
 it('derives proposals from live opportunities, risks and active goals',()=>{
  const s=demo(),p=proposals(s);
  expect(p.some(x=>x.origin==='OPPORTUNITY'&&x.sourceId==='opp-diversify')).toBe(true);
  expect(p.some(x=>x.origin==='RISK'&&x.sourceId==='concentration')).toBe(true);
  expect(p.some(x=>x.origin==='GOAL'&&x.sourceId==='g-networth')).toBe(true);
  const changed=updateOpportunityStatus(s,'opp-diversify','REJECTED');
  expect(proposals(changed).some(x=>x.sourceId==='opp-diversify')).toBe(false);
 });
 it('creates a local case with source provenance and no financial side effects',()=>{
  const s=demo(),m=summary(s),next=newOppCase(s).state;
  const c=next.governance.cases[0];
  expect(c.origin).toBe('OPPORTUNITY');
  expect(c.sourceId).toBe('opp-diversify');
  expect(c.requestedCapital).toBe(150000);
  expect(c.stage).toBe('DRAFT');
  expect(next.governance.events[0].caseId).toBe(c.id);
  expect(summary(next).netWorth).toBe(m.netWorth);
  expect(summary(next).committed).toBe(m.committed);
 });
 it('rejects duplicate active cases and invalid source recommendations',()=>{
  const x=newOppCase();expect(()=>createCase(x.state,'proposal-opportunity-opp-diversify',REASON)).toThrow();
  expect(()=>createCase(demo(),'does-not-exist',REASON)).toThrow();
  expect(()=>createCase(demo(),'proposal-opportunity-opp-diversify','')).toThrow();
 });
 it('requires local review before planning acknowledgement',()=>{
  const {state,caseId}=newOppCase();
  expect(()=>approveForPlanning(state,caseId,DATE)).toThrow('Submit');
 });
 it('checks emergency reserves, available cash, single commitment, rationale and current source',()=>{
  const {state,caseId}=newOppCase();
  const result=evaluateCase(state,state.governance.cases[0],DATE);
  expect(result.pass).toBe(true);
  expect(result.checks.length).toBeGreaterThanOrEqual(7);
  expect(result.blockers).toHaveLength(0);
  expect(result.version).toBe(1);
  expect(result.signature).toBe(policyFingerprint(state));
  expect(result.checks.some(x=>x.name==='Opportunity research eligibility')).toBe(true);
  expect(state.governance.cases[0].id).toBe(caseId);
 });
 it('performs a planning-only acknowledgement after passing a current review',()=>{
  const {state,caseId}=underReview();
  const result=approveForPlanning(state,caseId,DATE);
  expect(result.governance.cases[0].stage).toBe('PLANNING_APPROVED');
  expect(result.governance.events[0].action).toBe('PLANNING_ACKNOWLEDGED');
  expect(result.governance.events[0].detail).toContain('NO transaction authorization');
  expect(summary(result).netWorth).toBe(summary(state).netWorth);
  expect(summary(result).deployable).toBe(summary(state).deployable);
 });
 it('cannot acknowledge a case when free cash no longer covers it',()=>{
  const {state,caseId}=underReview();
  const changed=commitAllocation(state,'c-opportunity','other plan',250000,'a-changed');
  expect(evaluateCase(changed,changed.governance.cases[0],DATE).pass).toBe(false);
  expect(()=>approveForPlanning(changed,caseId,DATE)).toThrow();
 });
 it('never approves an option that fails Phase 4 funding and reserve controls',()=>{
  const {state,caseId}=newOppCase();
  const altered=structuredClone(state);altered.pools.find(p=>p.id==='c-emergency')!.reserved=200000;
  expect(evaluateCase(altered,altered.governance.cases[0],DATE).blockers.some(x=>x.includes('Emergency reserve'))).toBe(true);
  expect(evaluateCase(altered,altered.governance.cases[0],DATE).blockers.some(x=>x.includes('Opportunity research eligibility'))).toBe(true);
  const reviewed=submitReview(altered,caseId,DATE);
  expect(()=>approveForPlanning(reviewed,caseId,DATE)).toThrow('Cannot acknowledge');
 });
 it('blocks an option that is too large even if the idea has a high fit score',()=>{
  const s=demo(),id='proposal-opportunity-opp-property';
  const c=createCase(s,id,REASON).governance.cases[0];
  const evaluation=evaluateCase(s,c,DATE);
  expect(evaluation.pass).toBe(false);
  expect(evaluation.blockers.some(x=>x.includes('Deployable capital'))).toBe(true);
 });
 it('requires refresh after policy revision even when the case still passes the rules',()=>{
  const {state,caseId}=underReview();
  const changed=updatePolicy(state,{...state.governance.policy,maxCommitmentPct:70});
  expect(changed.governance.policyVersion).toBe(2);
  expect(evaluateCase(changed,changed.governance.cases[0],DATE).pass).toBe(true);
  expect(()=>approveForPlanning(changed,caseId,DATE)).toThrow('Re-submit');
  const refreshed=submitReview(changed,caseId,DATE);
  expect(approveForPlanning(refreshed,caseId,DATE).governance.cases[0].stage).toBe('PLANNING_APPROVED');
 });
 it('requires fresh review after portfolio changes, even if the policy checks still pass',()=>{
  const {state,caseId}=underReview();
  const edited=revalue(state,'p-property',4300000,'new sample price','new-valuation');
  expect(evaluateCase(edited,edited.governance.cases[0],DATE).pass).toBe(true);
  expect(()=>approveForPlanning(edited,caseId,DATE)).toThrow('Re-submit');
 });
 it('requires a current opportunity source; rejected or archived sources block acknowledgement',()=>{
  const {state,caseId}=newOppCase();
  const changed=updateOpportunityStatus(state,'opp-diversify','REJECTED');
  expect(evaluateCase(changed,changed.governance.cases[0],DATE).pass).toBe(false);
  const goal=createCase(demo(),'proposal-goal-g-networth',REASON);
  const archived=updateGoal(goal,'g-networth',{status:'ARCHIVED'});
  expect(evaluateCase(archived,archived.governance.cases[0],DATE).pass).toBe(false);
  expect(state.governance.cases[0].id).toBe(caseId);
 });
 it('requires a current risk; resolving an exposure can invalidate the source',()=>{
  const s=createCase(demo(),'proposal-risk-concentration',REASON);
  const edited=revalue(s,'p-business',2000000,'reduced sample exposure','v-risk');
  const result=evaluateCase(edited,edited.governance.cases[0],DATE);
  expect(result.checks.find(x=>x.name==='Source still current')?.pass).toBe(false);
 });
 it('rationale changes reset review state and preserve a local event',()=>{
  const {state,caseId}=underReview();
  const revised=reviseCaseRationale(state,caseId,'Revised after research and examining alternatives.');
  expect(revised.governance.cases[0].stage).toBe('DRAFT');
  expect(revised.governance.cases[0].reviewSignature).toBeUndefined();
  expect(revised.governance.events[0].action).toBe('RATIONALE_REVISED');
  expect(()=>approveForPlanning(revised,caseId,DATE)).toThrow();
 });
 it('decline and close actions require reasons and preserve the local event chain',()=>{
  const x=newOppCase();
  expect(()=>declineCase(x.state,x.caseId,'no')).toThrow();
  const declined=declineCase(x.state,x.caseId,'Insufficient evidence for planning.');
  expect(declined.governance.cases[0].stage).toBe('DECLINED');
  expect(declined.governance.events[0].action).toBe('CASE_DECLINED');
  expect(()=>submitReview(declined,x.caseId,DATE)).toThrow();
  const {state,caseId}=underReview();
  const approved=approveForPlanning(state,caseId,DATE);
  const closed=closeCase(approved,caseId,'Research completed; no transfer made.');
  expect(closed.governance.cases[0].stage).toBe('CLOSED');
  expect(()=>closeCase(closed,caseId,'Done again')).toThrow();
  expect(summary(closed).netWorth).toBe(summary(state).netWorth);
 });
});
describe('Phase 5 — local policies, preferences and reporting',()=>{
 it('validates local threshold ranges and enforces version increments',()=>{
  const s=demo(),original=structuredClone(s.governance.policy);
  expect(validatePolicy(original)).toEqual(original);
  expect(()=>validatePolicy({...original,minReserveMonths:-1})).toThrow();
  expect(()=>validatePolicy({...original,maxCommitmentPct:101})).toThrow();
  expect(()=>validatePolicy({...original,maxValuationAgeDays:0})).toThrow();
  expect(updatePolicy(s,original)).toBe(s);
  const changed=updatePolicy(s,{...original,maxValuationAgeDays:180});
  expect(changed.governance.policyVersion).toBe(2);
  expect(changed.governance.events[0].action).toBe('SAMPLE_POLICY_CHANGED');
 });
 it('blocks outdated sample valuations through the date policy check',()=>{
  const {state}=newOppCase();
  const changed=structuredClone(state);
  changed.positions[0].valuedAt='2020-01-01';
  const result=evaluateCase(changed,changed.governance.cases[0],DATE);
  expect(result.pass).toBe(false);
  expect(result.blockers.some(x=>x.includes('Valuation evidence freshness'))).toBe(true);
 });
 it('privacy preference edits are local and do not mutate wealth state',()=>{
  const s=demo(),m=summary(s);
  const prefs:PrivacyPrefs={...s.governance.privacy,includeAuditInExport:false,rememberAdvisorSessions:true};
  const changed=updatePrivacy(s,prefs);
  expect(changed.governance.privacy).toEqual(prefs);
  expect(changed.governance.events[0].action).toBe('DEMO_PREFERENCE_CHANGED');
  expect(summary(changed).netWorth).toBe(m.netWorth);
  expect(()=>updatePrivacy(s,{...prefs,includeAuditInExport:'yes' as unknown as boolean})).toThrow();
 });
 it('limits client-only workspace display to KES and supported routes',()=>{
  const s=demo();
  const settings:WorkspaceSettings={...s.governance.settings,compactDisplay:true,defaultScreen:'reports',reportPeriod:'ALL'};
  const changed=updateWorkspaceSettings(s,settings);
  expect(changed.governance.settings.defaultScreen).toBe('reports');
  expect(changed.governance.settings.compactDisplay).toBe(true);
  expect(summary(changed).netWorth).toBe(summary(s).netWorth);
  expect(()=>updateWorkspaceSettings(s,{...settings,currency:'USD' as 'KES'})).toThrow();
  expect(()=>updateWorkspaceSettings(s,{...settings,defaultScreen:'unknown' as 'dashboard'})).toThrow();
 });
 it('derives a reconciled sample report from current wealth without double-counted capital',()=>{
  const s=demo(),r=buildReport(s,'2026-10-31T11:00:00Z');
  expect(r.assets).toBe(16100000);
  expect(r.liabilities).toBe(3260000);
  expect(r.netWorth).toBe(12840000);
  expect(r.cash).toBe(2160000);
  expect(r.reserves).toBe(1405000);
  expect(r.committed).toBe(375000);
  expect(r.deployable).toBe(380000);
  expect(r.investmentAssets).toBe(2900000);
  expect(r.independenceTarget).toBe(37500000);
  expect(r.goals).toHaveLength(3);
  expect(r.risks).toHaveLength(6);
 });
 it('uses updated local holdings in report exports',()=>{
  const s=demo(),changed=revalue(s,'p-property',4400000,'new estimate','v-updated');
  expect(buildReport(changed,'2026-10-31T11:00:00Z').netWorth).toBe(13040000);
  expect(buildReport(changed,'2026-10-31T11:00:00Z').assets).toBe(16300000);
 });
 it('excludes local audit events from report JSON unless both privacy and period allow',()=>{
  const x=newOppCase();const s=x.state;
  expect(buildReport(s,'2026-10-31T11:00:00Z').events).toHaveLength(0);
  const all=updateWorkspaceSettings(s,{...s.governance.settings,reportPeriod:'ALL'});
  expect(buildReport(all,'2026-10-31T11:00:00Z').events.length).toBeGreaterThan(0);
  const privateExport=updatePrivacy(all,{...all.governance.privacy,includeAuditInExport:false});
  expect(buildReport(privateExport,'2026-10-31T11:00:00Z').events).toHaveLength(0);
 });
 it('produces readable CSV and formatted JSON without implying a verified report',()=>{
  const r=buildReport(demo(),'2026-10-31T11:00:00Z');
  const csv=reportCsv(r),json=reportJson(r);
  expect(csv).toContain('Metric,Value');
  expect(csv).toContain('12840000');
  expect(csv).toContain('Business concentration');
  expect(JSON.parse(json).notice).toContain('Fictional');
  expect(JSON.parse(json).netWorth).toBe(12840000);
 });
 it('escapes malicious CSV formula prefixes and quotes from string fields',()=>{
  const s=demo();const modified=buildReport(s,'2026-10-31T11:00:00Z');
  modified.label='=WEBSERVICE("https://example.test")';
  const csv=reportCsv(modified);
  expect(csv).toContain("'=WEBSERVICE");
  expect(csv).toContain('""https://example.test""');
 });
});
