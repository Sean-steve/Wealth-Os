import {useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {Activity,ArrowRight,BookOpen,CheckCircle2,ClipboardCheck,Clock3,LockKeyhole,Plus,RefreshCw,ShieldAlert,Target} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {approveForPlanning,closeCase,createCase,declineCase,evaluateCase,proposals,reviseCaseRationale,submitReview} from './model';
import type {DecisionCase,DecisionStage,Proposal} from './model';
import {Alert,Badge,Button,Card,ErrorNote,Field,Header,Modal,Sample,Stat,cash,errorText} from '../phase3/ui';
const stageTone=(x:DecisionStage):'teal'|'gold'|'violet'=>x==='PLANNING_APPROVED'||x==='CLOSED'?'teal':x==='DECLINED'?'gold':'violet';
const stageName=(x:DecisionStage)=>({'DRAFT':'Draft','UNDER_REVIEW':'Under local review','PLANNING_APPROVED':'Planning acknowledged','DECLINED':'Declined','CLOSED':'Closed'}[x]);
export function DecisionsScreen({navigate}:{navigate:(r:'governance'|'opportunities'|'risk'|'reports')=>void}){
 const {state,update,notify}=useWealth();
 const [filter,setFilter]=useState<DecisionStage|'ALL'>('ALL');
 const [selected,setSelected]=useState('');
 const [modal,setModal]=useState<'create'|'rationale'|'decline'|'close'|null>(null);
 const [source,setSource]=useState(''),[reason,setReason]=useState(''),[error,setError]=useState('');
 const suggestions=useMemo(()=>proposals(state),[state]);
 const cases=state.governance.cases.filter(c=>filter==='ALL'||c.stage===filter);
 const current=cases.find(c=>c.id===selected)??cases[0];
 const assessment=current?evaluateCase(state,current):null;
 const openCount=state.governance.cases.filter(c=>c.stage==='DRAFT'||c.stage==='UNDER_REVIEW').length;
 const acknowledged=state.governance.cases.filter(c=>c.stage==='PLANNING_APPROVED').length;
 const sourceProposal=suggestions.find(p=>p.id===source)??suggestions[0];
 const history=current?state.governance.events.filter(e=>e.caseId===current.id):[];
 function beginCreate(p:Proposal){setSource(p.id);setReason('Review the source evidence, policy limits and available alternatives before choosing an allocation.');setError('');setModal('create')}
 function beginRationale(c:DecisionCase){setReason(c.rationale);setError('');setModal('rationale')}
 function beginDecline(){setReason('');setError('');setModal('decline')}
 function beginClose(){setReason('');setError('');setModal('close')}
 function save(e:FormEvent){e.preventDefault();setError('');try{
  if(modal==='create'){update(s=>createCase(s,source,reason));notify('Local decision case created. No execution permission granted.')}
  else if(current&&modal==='rationale'){update(s=>reviseCaseRationale(s,current.id,reason));notify('Rationale updated. Submit again to refresh the policy assessment.')}
  else if(current&&modal==='decline'){update(s=>declineCase(s,current.id,reason));notify('Planning case declined and recorded in the local journal.')}
  else if(current&&modal==='close'){update(s=>closeCase(s,current.id,reason));notify('Planning case closed. No financial execution occurred.')}
  setModal(null)
 }catch(err){setError(errorText(err))}}
 function action(fn:(s:typeof state,id:string)=>typeof state,c:DecisionCase,success:string){try{update(s=>fn(s,c.id));notify(success)}catch(err){notify(errorText(err))}}
 return <div className="wos-screen">
 <Header title="Recommendations & Decision Journal" description="Capture a recommendation, trace its origin, review policy evidence and record local planning decisions without authorizing money movement." actions={<Button kind="secondary" onClick={()=>navigate('governance')}><ShieldAlert size={15}/> Policy controls</Button>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="Source recommendations" value={String(suggestions.length)} hint="Derived from current sample goals, risks and opportunities" icon={<Target size={18}/>}/>
 <Stat title="Open planning cases" value={String(openCount)} hint="Drafts and locally reviewed cases" icon={<ClipboardCheck size={18}/>} tone="blue"/>
 <Stat title="Planning acknowledgements" value={String(acknowledged)} hint="Does not approve payments or trades" icon={<CheckCircle2 size={18}/>} tone="teal"/>
 <Stat title="Journal events" value={String(state.governance.events.length)} hint="Editable browser-local demonstration history" icon={<Activity size={18}/>} tone="gold"/>
 </div>
 <Alert>These are **planning-only acknowledgements**. No authenticated reviewer, segregation of duties, Personal Kernel authorization, tamper-proof ledger or Finance OS transaction exists. Policy reviews become stale when the source data or local policy changes.</Alert>
 <Card title="Current evidence-backed recommendations" subtitle="Derived from Risk Center, Opportunity Lab and active goals; not invented returns" side={<span className="wos-count">{suggestions.length} candidates</span>}>
 <div className="p5-recommendations">{suggestions.map(p=>{const existing=state.governance.cases.some(c=>c.origin===p.origin&&c.sourceId===p.sourceId&&!['DECLINED','CLOSED'].includes(c.stage));return <div key={p.id} className="p5-recommendation"><div className="p5-rec-icon">{p.origin==='RISK'?<ShieldAlert size={17}/>:p.origin==='GOAL'?<Target size={17}/>:<BookOpen size={17}/>}</div><div className="p5-rec-main"><b>{p.title}</b><p>{p.summary}</p><small>{p.sourceLabel} · {p.capital>0?cash(p.capital)+' requested':'No cash commitment'} · {p.priority.toLowerCase()} priority</small></div><Button kind="secondary" disabled={existing} onClick={()=>beginCreate(p)}>{existing?'Case open':<><Plus size={13}/> Create case</>}</Button></div>})}{!suggestions.length&&<div className="p3-empty">No open source proposals. Add an opportunity or wealth goal first.</div>}</div>
 </Card>
 <div className="p5-split">
 <Card title="Decision cases" subtitle="Select a case to inspect checks and review history" side={<select className="p5-select" aria-label="Filter decision stage" value={filter} onChange={e=>setFilter(e.target.value as DecisionStage|'ALL')}><option value="ALL">All stages</option><option value="DRAFT">Draft</option><option value="UNDER_REVIEW">Under review</option><option value="PLANNING_APPROVED">Acknowledged</option><option value="DECLINED">Declined</option><option value="CLOSED">Closed</option></select>}>
 <div className="p5-case-list">{cases.map(c=><button key={c.id} type="button" onClick={()=>setSelected(c.id)} className={'p5-case '+(current?.id===c.id?'selected':'')}><div><b>{c.title}</b><Badge tone={stageTone(c.stage)}>{stageName(c.stage)}</Badge></div><small>{c.origin} · {c.createdAt.slice(0,10)} · {c.requestedCapital?cash(c.requestedCapital):'No cash commitment'}</small></button>)}{!cases.length&&<div className="p3-empty">No cases match this filter.</div>}</div>
 </Card>
 <Card title={current?.title??'Case details'} subtitle={current?'Created '+new Date(current.createdAt).toLocaleString('en-KE'):'Select or create a planning case'} side={current?<Badge tone={stageTone(current.stage)}>{stageName(current.stage)}</Badge>:null}>
 {current&&assessment?<div className="p5-case-detail">
 <div className="p5-note-box"><small>Planning rationale</small><p>{current.rationale}</p>{['DRAFT','UNDER_REVIEW'].includes(current.stage)&&<button type="button" onClick={()=>beginRationale(current)}>Revise rationale</button>}</div>
 <div className={'p4-policy-banner '+(assessment.pass?'pass':'block')}><span>{assessment.pass?'All currently evaluated local planning rules pass':'Planning-only acknowledgement is blocked by local checks'}</span></div>
 {assessment.checks.map(check=><div key={check.name} className="p5-check"><span className={'p5-status-dot '+(check.pass?'ok':'bad')}/><div><b>{check.name}</b><small>{check.observed} · {check.condition}</small></div><Badge tone={check.pass?'teal':'gold'}>{check.pass?'Pass':'Blocked'}</Badge></div>)}
 <div className="p5-review-signature"><LockKeyhole size={15}/><span>{current.stage==='UNDER_REVIEW'?(current.reviewSignature===assessment.signature&&current.reviewPolicyVersion===assessment.version?'Reviewed against current sample snapshot':'Review stale — submit again'):'No current reviewer attestation'} · policy v{assessment.version}</span></div>
 <div className="p5-actions">
 {['DRAFT','UNDER_REVIEW'].includes(current.stage)&&<Button kind="secondary" onClick={()=>action(submitReview,current,'Sample planning review refreshed.') }><RefreshCw size={14}/> {current.stage==='DRAFT'?'Submit for local review':'Refresh local review'}</Button>}
 {current.stage==='UNDER_REVIEW'&&<Button disabled={!assessment.pass||current.reviewSignature!==assessment.signature||current.reviewPolicyVersion!==assessment.version} onClick={()=>action(approveForPlanning,current,'Planning-only acknowledgement saved. No transaction authorized.')}><CheckCircle2 size={14}/> Acknowledge planning only</Button>}
 {['DRAFT','UNDER_REVIEW','PLANNING_APPROVED'].includes(current.stage)&&<Button kind="secondary" onClick={beginDecline}>Decline</Button>}
 {current.stage==='PLANNING_APPROVED'&&<Button kind="secondary" onClick={beginClose}>Close local case</Button>}
 </div>
 <div className="p5-headline"><h3>Case event history</h3><span>{history.length} local events</span></div>
 {history.map(e=><div className="p5-timeline" key={e.id}><Clock3 size={14}/><div><b>{e.action.replaceAll('_',' ')}</b><small>{new Date(e.occurredAt).toLocaleString('en-KE')} · {e.detail}</small></div></div>)}
 </div>:<div className="p3-empty">Select an existing case, or create one from a source recommendation above.</div>}
 </Card></div>
 <div className="p5-help-row"><Button kind="secondary" onClick={()=>navigate('opportunities')}>Opportunity Lab <ArrowRight size={13}/></Button><Button kind="secondary" onClick={()=>navigate('risk')}>Risk Center <ArrowRight size={13}/></Button><Button kind="secondary" onClick={()=>navigate('reports')}>Export report <ArrowRight size={13}/></Button></div>
 {modal&&<Modal title={modal==='create'?'Create planning case':modal==='rationale'?'Revise planning rationale':modal==='decline'?'Decline case':'Close case'} subtitle="This action changes only local planning records. It does not authorize an actual investment or payment." onClose={()=>setModal(null)}>
 <form className="wos-form" onSubmit={save}>
 {modal==='create'&&<div className="p5-note-box"><small>Source recommendation</small><b>{sourceProposal?.title}</b><p>{sourceProposal?.summary}</p><Field title="Recommendation source"><select value={source} onChange={e=>setSource(e.target.value)}>{suggestions.map(p=><option value={p.id} key={p.id}>{p.title}</option>)}</select></Field></div>}
 <Field title={modal==='decline'?'Reason for declining':modal==='close'?'Closure note':'Rationale & evidence to verify'}><textarea required maxLength={600} minLength={modal==='decline'||modal==='close'?8:1} rows={5} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe assumptions, risks, and which evidence is still missing."/></Field>
 <ErrorNote error={error}/><div className="wos-form-actions"><Button kind="secondary" onClick={()=>setModal(null)}>Cancel</Button><Button type="submit">Save local decision <ArrowRight size={14}/></Button></div>
 </form></Modal>}
 </div>;
}
