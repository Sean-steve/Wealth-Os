import {useState} from 'react';
import type {FormEvent} from 'react';
import {Plus,BriefcaseBusiness,Target,GitBranch,CheckCircle2,Pencil,Layers3,RefreshCw,ArrowRight,Clock3} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {activateStrategy,createStrategy,editDraftStrategy,reviseStrategy,goalProgress} from './model';
import type {WealthStrategy,TargetAllocation,StrategyRisk} from './model';
import {Header,Button,Card,Stat,Alert,Progress,Field,ErrorNote,Modal,Badge,Sample,newId,errorText} from './ui';

const riskLabel:Record<StrategyRisk,string>={CONSERVATIVE:'Conservative',BALANCED:'Balanced',GROWTH:'Growth'};
const labels=['Business growth','Diversified investments','Property capital','Cash and reserves'];
export function StrategiesScreen({navigate}:{navigate:(route:'goals'|'capital')=>void}){
 const {state,metrics,update,notify,reset}=useWealth();
 const [selected,setSelected]=useState<string>('s-wealth');
 const [dialog,setDialog]=useState(false);const [editing,setEditing]=useState<string|null>(null);const [error,setError]=useState('');
 const [goalId,setGoalId]=useState('g-networth'),[name,setName]=useState(''),[description,setDescription]=useState('');
 const [risk,setRisk]=useState<StrategyRisk>('BALANCED'),[annualReturnPct,setReturn]=useState('8'),[horizonYears,setHorizon]=useState('5');
 const [weights,setWeights]=useState<TargetAllocation[]>([{id:'a1',label:labels[0],percentage:30},{id:'a2',label:labels[1],percentage:40},{id:'a3',label:labels[2],percentage:20},{id:'a4',label:labels[3],percentage:10}]);
 const item=state.planning.strategies.find(s=>s.id===selected)??state.planning.strategies[0];
 const active=state.planning.strategies.filter(s=>s.status==='ACTIVE').length;
 const draft=state.planning.strategies.filter(s=>s.status==='DRAFT').length;
 const assigned=state.planning.goals.filter(g=>g.status==='ACTIVE'&&state.planning.strategies.some(s=>s.status==='ACTIVE'&&s.goalId===g.id)).length;
 const total=weights.reduce((a,b)=>a+b.percentage,0);
 function resetForm(s?:WealthStrategy){setEditing(s?.id??null);setGoalId(s?.goalId??state.planning.goals.find(g=>g.status==='ACTIVE')?.id??'');setName(s?.name??'New growth strategy');setDescription(s?.description??'Balance near-term liquidity and long-term wealth growth.');setRisk(s?.risk??'BALANCED');setReturn(String(s?.annualReturnPct??8));setHorizon(String(s?.horizonYears??5));setWeights(s?s.allocations.map(a=>({...a})):[{id:newId(),label:'Diversified investments',percentage:45},{id:newId(),label:'Property capital',percentage:30},{id:newId(),label:'Cash reserves',percentage:25}]);setError('');setDialog(true)}
 function submit(e:FormEvent){e.preventDefault();setError('');try{
  const payload={name,description,risk,annualReturnPct:Number(annualReturnPct),horizonYears:Number(horizonYears),allocations:weights};
  if(editing){update(s=>editDraftStrategy(s,editing,payload));notify('Sample draft strategy updated. No capital was deployed.')}
  else {const id=newId();update(s=>createStrategy(s,{id,goalId,...payload,version:1,status:'DRAFT',createdAt:new Date().toISOString().slice(0,10)}));setSelected(id);notify('Draft strategy created. Activation is a planning state only.')}
  setDialog(false)
 }catch(err){setError(errorText(err))}}
 function activate(id:string){try{update(s=>activateStrategy(s,id));notify('Strategy activated for the linked goal. No funds were allocated or moved.')}catch(err){notify(errorText(err))}}
 function duplicate(id:string){try{const next=newId();update(s=>reviseStrategy(s,id,next));setSelected(next);notify('New draft revision created; original strategy preserved.')}catch(err){notify(errorText(err))}}
 const linkedGoal=item&&state.planning.goals.find(g=>g.id===item.goalId);
 return <div className="wos-screen">
 <Header title="Wealth Strategies" description="Make your goals actionable through versioned strategic plans and explicit allocation targets." actions={<><Button kind="secondary" onClick={()=>reset()}><RefreshCw size={14}/> Reset sample</Button><Button onClick={()=>resetForm()}><Plus size={15}/> Create strategy</Button></>}/>
 <Sample/>
 <div className="wos-kpis"><Stat title="Strategy versions" value={String(state.planning.strategies.length)} hint="Immutable version history" icon={<GitBranch size={18}/>}/><Stat title="Active plans" value={String(active)} hint="One active strategy per goal" icon={<CheckCircle2 size={18}/>} tone="teal"/><Stat title="Draft plans" value={String(draft)} hint="Editable before activation" icon={<Pencil size={18}/>} tone="blue"/><Stat title="Goals with active plans" value={String(assigned)} hint="Of "+state.planning.goals.filter(g=>g.status==='ACTIVE').length+" active goals" icon={<Target size={18}/>} tone="gold"/></div>
 <Alert>A strategy is a planning object, not an investment instruction. Activating it changes only the sample strategic plan and never transfers or allocates funds.</Alert>
 <div className="p3-strategy-layout">
 <Card title="Strategy library" subtitle="Select a version to view details and its linked goal">
 <div className="p3-strategy-list">{state.planning.strategies.map(s=>{const g=state.planning.goals.find(x=>x.id===s.goalId);return <button key={s.id} type="button" onClick={()=>setSelected(s.id)} className={'p3-strategy-item '+(s.id===item?.id?'selected':'')}><div className="p3-strategy-title"><span className="p3-strategy-icon"><BriefcaseBusiness size={17}/></span><b>{s.name}</b></div><small>{g?.title??'Goal not available'}</small><div className="p3-strategy-meta"><Badge tone={s.status==='ACTIVE'?'teal':s.status==='DRAFT'?'gold':'violet'}>{s.status.toLowerCase()}</Badge><span>Version {s.version}</span><span>{riskLabel[s.risk]}</span></div></button>})}</div>
 </Card>
 <Card title={item?.name??'Select a strategy'} subtitle={item?'Version '+item.version+' · created '+item.createdAt:'No strategy selected'} side={item?<Badge tone={item.status==='ACTIVE'?'teal':'gold'}>{item.status}</Badge>:undefined}>
 {item?<div className="p3-strategy-detail"><p className="p3-strategy-description">{item.description}</p>
 <div className="p3-detail-grid"><div><small>Linked wealth goal</small><b>{linkedGoal?.title??'Unknown goal'}</b></div><div><small>Risk approach</small><b>{riskLabel[item.risk]}</b></div><div><small>Assumed return</small><b>{item.annualReturnPct}% annually</b></div><div><small>Planning horizon</small><b>{item.horizonYears} years</b></div></div>
 {linkedGoal&&<div className="p3-goal-connection"><div><small>Current goal measurement</small><strong>{goalProgress(linkedGoal,state,metrics).percent.toFixed(1)}% of target</strong></div><Progress value={goalProgress(linkedGoal,state,metrics).percent}/><button type="button" onClick={()=>navigate('goals')}>Inspect linked goal <ArrowRight size={14}/></button></div>}
 <div className="p3-headline"><h3>Target allocation framework</h3><span className="p3-small-note">Strategies, not executed holdings</span></div>
 <div className="p3-weights-bar">{item.allocations.map((w,i)=><span key={w.id||i} style={{width:w.percentage+'%',background:['#6959e9','#56a6cb','#42b49d','#edbb74','#b3a3f2'][i%5]}} title={w.label+': '+w.percentage+'%'}/>)}</div>
 <div className="p3-allocation-rows">{item.allocations.map((a,i)=><div key={a.id}><i style={{background:['#6959e9','#56a6cb','#42b49d','#edbb74','#b3a3f2'][i%5]}}/><span>{a.label}</span><strong>{a.percentage.toFixed(0)}%</strong></div>)}</div>
 <div className="p3-cta-row">
 {item.status==='DRAFT'?<><Button onClick={()=>activate(item.id)}><CheckCircle2 size={14}/> Activate draft</Button><Button kind="secondary" onClick={()=>resetForm(item)}><Pencil size={14}/> Edit draft</Button></>:<Button kind="secondary" onClick={()=>duplicate(item.id)}><GitBranch size={14}/> Create revision</Button>}
 <Button kind="secondary" onClick={()=>navigate('capital')}><Layers3 size={14}/> Capital pools</Button>
 </div>
 {item.supersedesId&&<div className="p3-timeline-note"><Clock3 size={14}/> Supersedes prior version. Prior strategy retained for comparison.</div>}
 </div>:<div className="p3-empty">Create your first strategy to begin planning.</div>}
 </Card>
 </div>
 {dialog&&<Modal title={editing?'Edit strategy draft':'Create a strategy draft'} subtitle="Choose target allocations that sum to exactly 100%; the form changes planning only." onClose={()=>setDialog(false)}><form className="wos-form" onSubmit={submit}>
 { !editing&&<Field title="Goal to support"><select required value={goalId} onChange={e=>setGoalId(e.target.value)}>{state.planning.goals.filter(g=>g.status!=='ARCHIVED').map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></Field> }
 <Field title="Strategy name"><input value={name} required maxLength={110} onChange={e=>setName(e.target.value)}/></Field>
 <Field title="Planning rationale"><textarea rows={3} required maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></Field>
 <div className="wos-form-two"><Field title="Risk approach"><select value={risk} onChange={e=>setRisk(e.target.value as StrategyRisk)}>{(Object.keys(riskLabel) as StrategyRisk[]).map(k=><option value={k} key={k}>{riskLabel[k]}</option>)}</select></Field><Field title="Horizon (years)"><input type="number" min="1" max="60" step="1" required value={horizonYears} onChange={e=>setHorizon(e.target.value)}/></Field></div>
 <Field title="Illustrative annual return assumption (%)"><input type="number" min="0" max="50" step=".1" required value={annualReturnPct} onChange={e=>setReturn(e.target.value)}/></Field>
 <div className="p3-headline"><h3>Allocation targets</h3><b className={Math.abs(total-100)<.00001?'p3-ok':'p3-bad'}>{total.toFixed(1)}% / 100%</b></div>
 {weights.map((w,i)=><div key={w.id} className="p3-weight-form"><Field title={'Purpose '+(i+1)}><input required maxLength={65} value={w.label} onChange={e=>setWeights(ws=>ws.map(x=>x.id===w.id?{...x,label:e.target.value}:x))}/></Field><Field title="Weight (%)"><input required type="number" min="0" max="100" step=".1" value={w.percentage} onChange={e=>setWeights(ws=>ws.map(x=>x.id===w.id?{...x,percentage:Number(e.target.value)}:x))}/></Field><button type="button" title="Remove allocation" aria-label={'Remove allocation '+w.label} disabled={weights.length<=1} onClick={()=>setWeights(ws=>ws.filter(x=>x.id!==w.id))}><Pencil size={14}/></button></div>)}
 <Button kind="secondary" onClick={()=>setWeights(w=>[...w,{id:newId(),label:'New allocation',percentage:0}])}><Plus size={13}/> Add weight</Button>
 <ErrorNote error={error}/><div className="wos-form-actions"><Button kind="secondary" onClick={()=>setDialog(false)}>Cancel</Button><Button type="submit">Save draft <CheckCircle2 size={14}/></Button></div>
 </form></Modal>}
 </div>
}
