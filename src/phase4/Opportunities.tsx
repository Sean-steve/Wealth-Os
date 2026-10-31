import {useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowRight,BriefcaseBusiness,Check,CheckCircle2,Filter,GitCompareArrows,Info,Plus,ShieldAlert,Target,WalletCards} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {addOpportunity,assessOpportunity,updateOpportunityStatus} from './model';
import type {WealthOpportunity,OpportunityKind,OpportunityRisk,OpportunityStatus} from './model';
import {Header,Button,Card,Stat,Alert,Sample,Badge,Field,Modal,ErrorNote,cash,shortCash,newId,errorText,Progress} from '../phase3/ui';
const kinds:Record<OpportunityKind,string>={DIVERSIFICATION:'Investment diversification',DEBT_REDUCTION:'Debt optimization',INCOME:'Recurring income',BUSINESS:'Business growth',PROPERTY:'Property',OTHER:'Other'};
const types=Object.keys(kinds) as OpportunityKind[];
const riskTone:Record<OpportunityRisk,'teal'|'gold'|'violet'>={LOW:'teal',MEDIUM:'gold',HIGH:'violet'};
export function OpportunitiesScreen({navigate}:{navigate:(r:'capital'|'scenarios'|'goals')=>void}){
 const {state,metrics,update,notify}=useWealth();
 const [status,setStatus]=useState<OpportunityStatus|'ALL'>('ALL');
 const [selected,setSelected]=useState('opp-diversify');
 const [compare,setCompare]=useState<string[]>(['opp-diversify','opp-debt']);
 const [adding,setAdding]=useState(false),[error,setError]=useState('');
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[kind,setKind]=useState<OpportunityKind>('DIVERSIFICATION'),[risk,setRisk]=useState<OpportunityRisk>('MEDIUM');
 const [capital,setCapital]=useState('100000'),[low,setLow]=useState('-5'),[high,setHigh]=useState('10'),[horizon,setHorizon]=useState('5'),[goalId,setGoalId]=useState('');
 const options=state.intelligence.opportunities;
 const listing=options.filter(o=>status==='ALL'||o.status===status);
 const current=options.find(o=>o.id===selected)??options[0];
 const evaluation=current?assessOpportunity(state,current):null;
 const eligible=useMemo(()=>options.filter(o=>assessOpportunity(state,o).eligible).length,[state,options]);
 const candidates=options.filter(o=>compare.includes(o.id)).slice(0,3);
 function toggle(id:string){setCompare(x=>x.includes(id)?x.filter(a=>a!==id):x.length>=3?[...x.slice(1),id]:[...x,id])}
 function save(e:FormEvent){e.preventDefault();setError('');try{const id=newId();const o:WealthOpportunity={id,title,description,kind,risk,capitalRequired:Number(capital),returnLowPct:Number(low),returnHighPct:Number(high),horizonYears:Number(horizon),goalId,status:'NEW',createdAt:new Date().toISOString().slice(0,10)};update(s=>addOpportunity(s,o));setSelected(id);setAdding(false);notify('Illustrative research opportunity saved locally. No funds were moved.')}catch(err){setError(errorText(err))}}
 function change(id:string,value:OpportunityStatus){update(s=>updateOpportunityStatus(s,id,value));notify('Sample opportunity marked '+value.toLowerCase()+'. No execution was requested.')}
 return <div className="wos-screen">
 <Header title="Opportunity Lab" description="Explore possible uses of capital. Apply liquidity guardrails first, then compare transparent strategic-fit scores." actions={<><Button kind="secondary" onClick={()=>navigate('capital')}><WalletCards size={15}/> Review capital</Button><Button onClick={()=>{setError('');setAdding(true)}}><Plus size={15}/> New opportunity</Button></>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="Ideas tracked" value={String(options.length)} hint="Unverified local opportunity records" icon={<BriefcaseBusiness size={18}/>}/>
 <Stat title="Cash-eligible" value={String(eligible)} hint="Passes demo affordability and reserve gates" icon={<CheckCircle2 size={18}/>} tone="teal"/>
 <Stat title="Shortlisted" value={String(options.filter(o=>o.status==='SHORTLISTED').length)} hint="Research status, not approved" icon={<Target size={18}/>} tone="blue"/>
 <Stat title="Uncommitted capital" value={shortCash(metrics.deployable)} hint="Source: strategic cash pools" icon={<WalletCards size={18}/>} tone="gold"/>
 </div>
 <Alert>Opportunity scores are *heuristic planning aids*, not probabilities, projected profits, broker quotes, due diligence or investment advice. An ineligible option cannot be treated as funded even when its fit score is high. No financial execution is available.</Alert>
 <div className="p4-opp-layout">
 <Card title="Opportunity pipeline" subtitle="Select an idea for its evidence and feasibility" side={<select className="p4-select compact" aria-label="Opportunity status filter" value={status} onChange={e=>setStatus(e.target.value as OpportunityStatus|'ALL')}><option value="ALL">All ideas</option><option value="NEW">New</option><option value="SHORTLISTED">Shortlisted</option><option value="REJECTED">Rejected</option></select>}>
 <div className="p4-opp-list">{listing.map(o=>{const e=assessOpportunity(state,o);return <div key={o.id} className={'p4-opp-card '+(o.id===current?.id?'selected':'')}><button type="button" className="p4-opp-select" onClick={()=>setSelected(o.id)}><div className="p4-opp-title"><b>{o.title}</b><Badge tone={e.eligible?'teal':'gold'}>{e.eligible?'Cash eligible':'Guardrail'}</Badge></div><small>{kinds[o.kind]} · {o.risk.toLowerCase()} risk</small><div className="p4-opp-score"><strong>{e.score}<span>/100</span></strong><span>Explained fit</span><span>{shortCash(o.capitalRequired)} required</span></div><Progress value={e.score}/></button><div className="p4-opp-foot"><label><input type="checkbox" checked={compare.includes(o.id)} onChange={()=>toggle(o.id)}/> Compare</label><span>{o.status.toLowerCase()}</span></div></div>})}{!listing.length&&<p className="p3-empty">No opportunities with this status.</p>}</div>
 </Card>
 <Card title={current?.title??'Opportunity evaluation'} subtitle="Hard policy gates before explanation" side={evaluation?<Badge tone={evaluation.eligible?'teal':'gold'}>{evaluation.eligible?'Review eligible':'Not funded'}</Badge>:null}>
 {current&&evaluation?<div className="p4-opp-detail"><p className="p4-body">{current.description||'No due diligence evidence entered.'}</p><div className="p4-detail-grid"><div><span>Capital required</span><strong>{cash(current.capitalRequired)}</strong></div><div><span>Time horizon</span><strong>{current.horizonYears} years</strong></div><div><span>Assumed return range</span><strong>{current.returnLowPct}% to {current.returnHighPct}%</strong></div><div><span>Risk complexity</span><Badge tone={riskTone[current.risk]}>{current.risk}</Badge></div></div>
 <div className={'p4-policy-banner '+(evaluation.eligible?'pass':'block')}>{evaluation.eligible?<Check size={17}/>:<ShieldAlert size={17}/>}<span>{evaluation.eligible?'Passes illustrative reserve and funding checks':evaluation.block==='RESERVE_BELOW_FLOOR'?'Emergency reserve floor not met':'Capital requirement exceeds uncommitted cash'}</span></div>
 <h3 className="p4-subhead">Explained fit components</h3>{evaluation.components.map(x=><div className="p4-opp-factor" key={x.name}><div><span>{x.name}</span><b>{x.points} / {x.max}</b></div><Progress value={x.points/x.max*100}/></div>)}
 <div className="p4-policy-notes">{evaluation.reasons.map(x=><p key={x}><Info size={14}/>{x}</p>)}</div>
 <div className="p4-button-row"><Button kind="secondary" onClick={()=>change(current.id,'SHORTLISTED')} disabled={current.status==='SHORTLISTED'}><Check size={14}/> Shortlist for research</Button><Button kind="secondary" onClick={()=>change(current.id,'REJECTED')} disabled={current.status==='REJECTED'}>Dismiss</Button></div>
 </div>:<p className="p3-empty">No opportunity selected.</p>}
 </Card></div>
 <Card title="Compare research alternatives" subtitle="Select up to three ideas above. Comparisons are explanatory, not executable." side={<Badge tone="violet"><GitCompareArrows size={12}/> {candidates.length} selected</Badge>}>
 {candidates.length?<div className="wos-table-scroll"><table className="wos-table p4-compare"><thead><tr><th>Attribute</th>{candidates.map(x=><th key={x.id}>{x.title}</th>)}</tr></thead><tbody>
 <tr><td>Fit score</td>{candidates.map(o=><td key={o.id}><b>{assessOpportunity(state,o).score}/100</b></td>)}</tr>
 <tr><td>Cash eligibility</td>{candidates.map(o=><td key={o.id}><Badge tone={assessOpportunity(state,o).eligible?'teal':'gold'}>{assessOpportunity(state,o).eligible?'Pass':'Blocked'}</Badge></td>)}</tr>
 <tr><td>Capital required</td>{candidates.map(o=><td key={o.id}>{cash(o.capitalRequired)}</td>)}</tr>
 <tr><td>Assumed annual return</td>{candidates.map(o=><td key={o.id}>{o.returnLowPct}% to {o.returnHighPct}%</td>)}</tr>
 <tr><td>Risk complexity</td>{candidates.map(o=><td key={o.id}>{o.risk}</td>)}</tr>
 <tr><td>Horizon</td>{candidates.map(o=><td key={o.id}>{o.horizonYears} years</td>)}</tr>
 <tr><td>Research status</td>{candidates.map(o=><td key={o.id}>{o.status}</td>)}</tr></tbody></table></div>:<p className="p3-empty">Select two alternatives for comparison.</p>}
 <div className="p4-button-row"><Button kind="secondary" onClick={()=>navigate('scenarios')}><GitCompareArrows size={14}/> Open Scenario Lab <ArrowRight size={14}/></Button><Button kind="secondary" onClick={()=>navigate('goals')}><Filter size={14}/> Review goals</Button></div>
 </Card>
 {adding&&<Modal title="Create a research opportunity" subtitle="Record assumptions for comparison. This cannot create trades or fund movements." onClose={()=>setAdding(false)}><form className="wos-form" onSubmit={save}>
 <Field title="Opportunity name"><input required maxLength={110} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Diversified government securities"/></Field>
 <Field title="Description / thesis"><textarea required rows={3} value={description} onChange={e=>setDescription(e.target.value)} maxLength={500}/></Field>
 <div className="wos-form-two"><Field title="Category"><select value={kind} onChange={e=>setKind(e.target.value as OpportunityKind)}>{types.map(x=><option value={x} key={x}>{kinds[x]}</option>)}</select></Field><Field title="Risk complexity"><select value={risk} onChange={e=>setRisk(e.target.value as OpportunityRisk)}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></Field></div>
 <div className="wos-form-two"><Field title="Capital required · KES"><input required type="number" min="1" max="1000000000000" step="1000" value={capital} onChange={e=>setCapital(e.target.value)}/></Field><Field title="Horizon (years)"><input required type="number" min="1" max="40" step="1" value={horizon} onChange={e=>setHorizon(e.target.value)}/></Field></div>
 <div className="wos-form-two"><Field title="Lower return scenario (%)"><input required type="number" min="-100" max="100" step=".5" value={low} onChange={e=>setLow(e.target.value)}/></Field><Field title="Upper return scenario (%)"><input required type="number" min="-100" max="100" step=".5" value={high} onChange={e=>setHigh(e.target.value)}/></Field></div>
 <Field title="Related active wealth goal"><select value={goalId} onChange={e=>setGoalId(e.target.value)}><option value="">No specific goal</option>{state.planning.goals.filter(g=>g.status==='ACTIVE').map(g=><option value={g.id} key={g.id}>{g.title}</option>)}</select></Field>
 <ErrorNote error={error}/><div className="wos-form-actions"><Button kind="secondary" onClick={()=>setAdding(false)}>Cancel</Button><Button type="submit">Add local idea <Plus size={14}/></Button></div>
 </form></Modal>}
 </div>
}
