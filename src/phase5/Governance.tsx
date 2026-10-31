import {useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowRight,BookLock,CheckCircle2,ClipboardList,FileCheck2,GitBranch,Info,LockKeyhole,ShieldCheck,ShieldAlert,SlidersHorizontal} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {evaluateCase,updatePolicy} from './model';
import type {PlanningPolicy} from './model';
import {Alert,Badge,Button,Card,ErrorNote,Field,Header,Modal,Sample,Stat,errorText} from '../phase3/ui';
export function GovernanceScreen({navigate}:{navigate:(r:'decisions'|'security'|'integrations')=>void}){
 const {state,update,notify}=useWealth();
 const governance=state.governance;
 const [editing,setEditing]=useState(false),[form,setForm]=useState<PlanningPolicy>(governance.policy),[error,setError]=useState('');
 const pending=useMemo(()=>governance.cases.filter(c=>c.stage==='UNDER_REVIEW').map(c=>({case:c,result:evaluateCase(state,c)})),[state,governance.cases]);
 const pass=pending.filter(x=>x.result.pass&&x.case.reviewSignature===x.result.signature&&x.case.reviewPolicyVersion===x.result.version).length;
 const outstanding=pending.length-pass;
 function beginEdit(){setForm({...governance.policy});setError('');setEditing(true)}
 function submit(e:FormEvent){e.preventDefault();setError('');try{update(s=>updatePolicy(s,form));notify('Illustrative local planning policy updated. Previous reviews require refresh.');setEditing(false)}catch(ex){setError(errorText(ex))}}
 return <div className="wos-screen">
 <Header title="Policies & Planning Approvals" description="Explore rule-based planning guardrails, review freshness and approval boundaries before any real financial workflow exists." actions={<><Button kind="secondary" onClick={()=>navigate('decisions')}><ClipboardList size={15}/> Decision queue</Button><Button onClick={beginEdit}><SlidersHorizontal size={15}/> Edit demo policy</Button></>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="Local policy version" value={'v'+governance.policyVersion} hint="Not connected to Personal Kernel" icon={<GitBranch size={18}/>}/>
 <Stat title="Awaiting review" value={String(pending.length)} hint="Cases under browser-local review" icon={<ClipboardList size={18}/>} tone="blue"/>
 <Stat title="Passing current gates" value={String(pass)} hint="Still requires manual planning acknowledgement" icon={<CheckCircle2 size={18}/>} tone="teal"/>
 <Stat title="Blocked or stale" value={String(outstanding)} hint="Data or policy review needed" icon={<ShieldAlert size={18}/>} tone="gold"/>
 </div>
 <Alert>These are prototype **local planning policies only**; they do not override the Phase 4 demonstration risk thresholds or provide real authorization. A real deployment requires Personal Kernel authenticated identity, authoritative consent, Finance OS permissions, secure audit, policy arbitration and human approval.</Alert>
 <div className="wos-grid halves">
 <Card title="Active local planning guardrails" subtitle="Applies to Phase 5 planning-case acknowledgement only" side={<Badge tone="violet">Policy v{governance.policyVersion}</Badge>}>
 <div className="p5-policy-grid">
 <div><span className="p5-policy-icon"><ShieldCheck size={17}/></span><div><b>Emergency reserve floor</b><small>Protected cash vs monthly planned lifestyle</small></div><strong>{governance.policy.minReserveMonths} months</strong></div>
 <div><span className="p5-policy-icon"><LockKeyhole size={17}/></span><div><b>Single capital commitment</b><small>Maximum portion of deployable capital</small></div><strong>{governance.policy.maxCommitmentPct}%</strong></div>
 <div><span className="p5-policy-icon"><SlidersHorizontal size={17}/></span><div><b>Private-business expansion exposure</b><small>Ceiling on business share of gross assets</small></div><strong>{governance.policy.maxBusinessConcentrationPct}%</strong></div>
 <div><span className="p5-policy-icon"><FileCheck2 size={17}/></span><div><b>Oldest acceptable valuation</b><small>Maximum age of oldest modeled position</small></div><strong>{governance.policy.maxValuationAgeDays} days</strong></div>
 <div><span className="p5-policy-icon"><BookLock size={17}/></span><div><b>Written decision rationale</b><small>Minimum 20 characters when required</small></div><strong>{governance.policy.requireRationale?'Required':'Optional'}</strong></div>
 </div>
 <div className="p5-help-row"><Button onClick={beginEdit}><SlidersHorizontal size={13}/> Edit local rules</Button></div>
 </Card>
 <Card title="Approval boundary" subtitle="Three separate authority layers must not be confused">
 <div className="p5-authority"><div><span className="p5-level pass">01</span><div><b>Wealth OS — analyze and propose</b><p>Produces local evidence, scenario outputs and planning cases. No financial permissions.</p></div><Badge tone="teal">Implemented demo</Badge></div>
 <div><span className="p5-level demo">02</span><div><b>Personal Kernel — authority and consent</b><p>Identity, cross-OS approval workflow, consent and policy arbitration.</p></div><Badge tone="gold">Not connected</Badge></div>
 <div><span className="p5-level demo">03</span><div><b>Finance OS — financial execution</b><p>Separate money movement, account ownership, banking and reconciled confirmations.</p></div><Badge tone="gold">Not connected</Badge></div></div>
 <div className="p5-boundary"><Info size={16}/><span>Even a local “planning acknowledged” case never becomes a transfer instruction.</span></div>
 </Card></div>
 <Card title="Approval queue & stale review checks" subtitle="A review becomes invalid if the source holdings, capital, goals or policy change">
 {pending.length?<div className="wos-table-scroll"><table className="wos-table"><thead><tr><th>Case</th><th>Policy version</th><th>Current blockers</th><th>Review freshness</th><th>Action</th></tr></thead><tbody>{pending.map(({case:c,result:r})=><tr key={c.id}><td><strong>{c.title}</strong></td><td>v{c.reviewPolicyVersion??'—'} → v{r.version}</td><td>{r.blockers.length===0?<Badge tone="teal">0 current blockers</Badge>:<Badge tone="gold">{r.blockers.length} blockers</Badge>}</td><td>{c.reviewSignature===r.signature&&c.reviewPolicyVersion===r.version?'Current':'Outdated — re-review'}</td><td><Button kind="secondary" onClick={()=>navigate('decisions')}>Review case <ArrowRight size={13}/></Button></td></tr>)}</tbody></table></div>:<div className="p3-empty">No cases are currently in local review. Propose one from the Decision Journal.</div>}
 </Card>
 <Card title="Local policy revisions" subtitle="A browser-local activity record, not a tamper-proof compliance log">
 {governance.events.filter(x=>x.action==='SAMPLE_POLICY_CHANGED').length?governance.events.filter(x=>x.action==='SAMPLE_POLICY_CHANGED').slice(0,10).map(x=><div key={x.id} className="p5-timeline"><GitBranch size={15}/><div><b>{x.detail}</b><small>{new Date(x.occurredAt).toLocaleString('en-KE')}</small></div></div>):<p className="p3-empty">Using the illustrative default policy. No revisions have been made in this browser.</p>}
 </Card>
 {editing&&<Modal title="Update local planning policy" subtitle="An editable demo rule set. It will not configure Personal Kernel or any server-side policy." onClose={()=>setEditing(false)}>
 <form className="wos-form" onSubmit={submit}>
 <div className="wos-form-two"><Field title="Minimum emergency months"><input required type="number" min="0" max="36" step=".5" value={form.minReserveMonths} onChange={e=>setForm(f=>({...f,minReserveMonths:Number(e.target.value)}))}/></Field>
 <Field title="Maximum single commitment (%)"><input required type="number" min="1" max="100" step="1" value={form.maxCommitmentPct} onChange={e=>setForm(f=>({...f,maxCommitmentPct:Number(e.target.value)}))}/></Field></div>
 <div className="wos-form-two"><Field title="Business concentration ceiling (%)"><input required type="number" min="0" max="100" step="1" value={form.maxBusinessConcentrationPct} onChange={e=>setForm(f=>({...f,maxBusinessConcentrationPct:Number(e.target.value)}))}/></Field>
 <Field title="Oldest acceptable valuation age (days)"><input required type="number" min="1" max="3650" step="1" value={form.maxValuationAgeDays} onChange={e=>setForm(f=>({...f,maxValuationAgeDays:Number(e.target.value)}))}/></Field></div>
 <label className="p5-toggle-row"><input type="checkbox" checked={form.requireRationale} onChange={e=>setForm(f=>({...f,requireRationale:e.target.checked}))}/><span><b>Require an evidence/rationale note</b><small>Blocking when fewer than 20 characters are provided.</small></span></label>
 <ErrorNote error={error}/><div className="wos-form-actions"><Button kind="secondary" onClick={()=>setEditing(false)}>Cancel</Button><Button type="submit">Save local policy <ArrowRight size={13}/></Button></div>
 </form></Modal>}
 </div>;
}
