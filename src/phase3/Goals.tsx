import {useState} from 'react';
import type {FormEvent} from 'react';
import {Target,Flag,Plus,CalendarDays,CheckCircle2,PauseCircle,Archive,ArrowRight,Edit3,Trash2,Milestone as MilestoneIcon,RefreshCw} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {createGoal,updateGoal,addMilestone,removeMilestone,goalProgress,targetMetric} from './model';
import type {WealthGoal,GoalMetric,GoalPriority,GoalStatus,Milestone} from './model';
import {Header,Button,Card,Stat,Alert,Progress,Field,ErrorNote,Modal,Badge,Sample,shortCash,newId,errorText} from './ui';

const metricLabels:Record<GoalMetric,string>={NET_WORTH:'Total net worth',PASSIVE_INCOME:'Monthly passive income',POOL_BALANCE:'Capital pool balance',INVESTMENTS:'Investment value',LIQUID_WEALTH:'Liquid wealth'};
const format=(n:number,metric:GoalMetric)=>shortCash(n)+(metric==='PASSIVE_INCOME'?'/mo':'');
const today=()=>new Date().toISOString().slice(0,10);
export function GoalsScreen({navigate}:{navigate:(route:'strategies'|'capital'|'portfolio')=>void}){
 const {state,metrics,update,notify,reset}=useWealth();
 const [selected,setSelected]=useState('g-networth');
 const [showArchived,setShowArchived]=useState(false);
 const [dialog,setDialog]=useState<'new'|'edit'|'milestone'|null>(null);
 const [error,setError]=useState('');
 const [title,setTitle]=useState('');
 const [goalType,setGoalType]=useState<GoalMetric>('NET_WORTH');
 const [poolId,setPoolId]=useState('c-goals');
 const [target,setTarget]=useState('20000000');
 const [deadline,setDeadline]=useState('2029-12-31');
 const [priority,setPriority]=useState<GoalPriority>('MEDIUM');
 const [msTitle,setMsTitle]=useState('');
 const [msValue,setMsValue]=useState('1000000');
 const [msDate,setMsDate]=useState('2028-12-31');
 const list=state.planning.goals.filter(g=>showArchived||g.status!=='ARCHIVED');
 const current=list.find(g=>g.id===selected)??list[0];
 const active=state.planning.goals.filter(g=>g.status==='ACTIVE');
 const complete=active.filter(g=>goalProgress(g,state,metrics).completed).length;
 const milestones=active.flatMap(g=>g.milestones.map(m=>({m,g})));
 const done=milestones.filter(x=>targetMetric(x.g,state,metrics)>=x.m.target).length;
 function beginNew(){setTitle('');setGoalType('NET_WORTH');setPoolId('c-goals');setTarget('20000000');setDeadline('2029-12-31');setPriority('MEDIUM');setError('');setDialog('new')}
 function beginEdit(g:WealthGoal){setTitle(g.title);setTarget(String(g.target));setDeadline(g.deadline);setPriority(g.priority);setError('');setDialog('edit')}
 function beginMilestone(){if(!current)return;setMsTitle('');setMsValue(String(Math.round(current.target*.5)));setMsDate(current.deadline);setError('');setDialog('milestone')}
 function saveGoal(e:FormEvent){e.preventDefault();setError('');try{
  if(dialog==='new'){const id=newId();const goal:WealthGoal={id,title,metric:goalType,poolId:goalType==='POOL_BALANCE'?poolId:undefined,target:Number(target),deadline,priority,status:'ACTIVE',milestones:[],createdAt:today()};update(s=>createGoal(s,goal));setSelected(id);notify('Sample wealth goal created. No Life OS mission was created.')}
  else if(current){update(s=>updateGoal(s,current.id,{title,target:Number(target),deadline,priority}));notify('Goal target and plan updated locally.')}
  setDialog(null)
 }catch(err){setError(errorText(err))}}
 function saveMilestone(e:FormEvent){e.preventDefault();if(!current)return;setError('');try{const milestone:Milestone={id:newId(),title:msTitle,target:Number(msValue),date:msDate};update(s=>addMilestone(s,current.id,milestone));setDialog(null);notify('Milestone added to this goal.')}catch(err){setError(errorText(err))}}
 function changeStatus(g:WealthGoal,status:GoalStatus){update(s=>updateGoal(s,g.id,{status}));notify('Goal marked '+status.toLowerCase()+'.')}
 return <div className="wos-screen">
 <Header title="Goals & Milestones" description="Set measurable wealth outcomes, follow your progress and connect each goal to a long-term strategy." actions={<><Button kind="secondary" onClick={()=>reset()}><RefreshCw size={14}/> Reset sample</Button><Button onClick={beginNew}><Plus size={15}/> New wealth goal</Button></>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="Active goals" value={String(active.length)} hint="Strategic priorities in view" icon={<Target size={18}/>}/>
 <Stat title="Targets achieved" value={String(complete)} hint="Currently at or above goal value" icon={<CheckCircle2 size={18}/>} tone="teal"/>
 <Stat title="Milestones reached" value={done+' / '+milestones.length} hint="Measured from local financial state" icon={<Flag size={18}/>} tone="blue"/>
 <Stat title="Linked strategies" value={String(state.planning.strategies.filter(s=>s.status==='ACTIVE').length)} hint="Currently activated planning rules" icon={<MilestoneIcon size={18}/>} tone="gold"/>
 </div>
 <Alert>Goal progress is calculated from the shared sample wealth state. Estimated monthly progress requirements exclude returns and are not promises or forecasts.</Alert>
 <div className="p3-goals-layout">
 <Card title="Your wealth goals" subtitle="Select a goal to inspect milestones and its strategy" side={<button type="button" className="p3-text-toggle" onClick={()=>setShowArchived(v=>!v)}>{showArchived?'Hide archived':'Show archived'}</button>}>
 {list.length? <div className="p3-goal-list">{list.map(g=>{const prog=goalProgress(g,state,metrics);return <button type="button" key={g.id} className={'p3-goal-item '+(current?.id===g.id?'selected':'')} onClick={()=>setSelected(g.id)}>
 <div className="p3-goal-item-top"><span className="p3-goal-icon"><Target size={16}/></span><span className="p3-goal-item-content"><b>{g.title}</b><small>{metricLabels[g.metric]} · {g.deadline}</small></span><Badge tone={g.status==='ACTIVE'?'teal':g.status==='PAUSED'?'gold':'violet'}>{g.status.toLowerCase()}</Badge></div>
 <div className="p3-value-row"><strong>{format(prog.current,g.metric)}</strong><span>of {format(g.target,g.metric)}</span></div><Progress value={prog.percent}/><div className="p3-goal-foot"><span>{prog.percent.toFixed(1)}% reached</span><span>{prog.isLate?'Overdue':prog.daysLeft+' days left'}</span></div>
 </button>})}</div>:<p className="p3-empty">No visible goals. Create one or show archived goals.</p>}
 </Card>
 <Card title={current?.title??'Goal detail'} subtitle="Measured from illustrative asset, income or capital values" side={current?<Button kind="secondary" onClick={()=>beginEdit(current)}><Edit3 size={14}/> Edit</Button>:null}>
 {current?(()=>{const p=goalProgress(current,state,metrics);const linked=state.planning.strategies.filter(s=>s.goalId===current.id&&s.status==='ACTIVE');return <div className="p3-detail">
 <div className="p3-detail-hero"><div><small>Current measured value</small><strong>{format(p.current,current.metric)}</strong></div><div><small>Remaining gap</small><strong>{format(p.remaining,current.metric)}</strong></div></div>
 <div className="p3-detail-grid"><div><small>Goal priority</small><b>{current.priority.toLowerCase()}</b></div><div><small>Target date</small><b>{current.deadline}</b></div><div><small>Monthly uplift needed</small><b>{p.requiredPerMonth===null?'Overdue':format(p.requiredPerMonth,current.metric)}</b></div><div><small>Active strategies</small><b>{linked.length}</b></div></div>
 <div className="p3-headline"><h3>Goal milestones</h3><Button kind="secondary" onClick={beginMilestone}><Plus size={14}/> Add milestone</Button></div>
 {current.milestones.length?current.milestones.map(m=>{const reached=p.current>=m.target;return <div className="p3-milestone" key={m.id}><span className={'p3-milestone-mark '+(reached?'complete':'')}>{reached?<CheckCircle2 size={16}/>:<Flag size={16}/>}</span><div><b>{m.title}</b><small>{format(m.target,current.metric)} · {m.date} · {reached?'Reached':'Pending'}</small></div><button type="button" title="Remove milestone" aria-label={'Remove '+m.title} className="p3-remove" onClick={()=>{update(s=>removeMilestone(s,current.id,m.id));notify('Milestone removed locally.')}}><Trash2 size={15}/></button></div>}):<p className="p3-empty">No milestones yet. Add a checkpoint.</p>}
 <div className="p3-cta-row"><Button kind="secondary" onClick={()=>changeStatus(current,current.status==='PAUSED'?'ACTIVE':'PAUSED')}><PauseCircle size={14}/>{current.status==='PAUSED'?'Resume goal':'Pause goal'}</Button><Button kind="secondary" onClick={()=>changeStatus(current,'ARCHIVED')} disabled={current.status==='ARCHIVED'}><Archive size={14}/> Archive</Button><Button onClick={()=>navigate('strategies')}>View strategies <ArrowRight size={14}/></Button></div>
 </div>})():<p className="p3-empty">Choose or create a goal.</p>}
 </Card>
 </div>
 {dialog==='new'||dialog==='edit'?<Modal title={dialog==='new'?'Create wealth goal':'Edit wealth goal'} subtitle="Targets are strategic, not bank account movements." onClose={()=>setDialog(null)}><form className="wos-form" onSubmit={saveGoal}>
 <Field title="Goal name"><input required maxLength={110} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. First KES 30M"/></Field>
 {dialog==='new'&&<><Field title="Metric measured"><select value={goalType} onChange={e=>setGoalType(e.target.value as GoalMetric)}>{(Object.keys(metricLabels) as GoalMetric[]).map(k=><option value={k} key={k}>{metricLabels[k]}</option>)}</select></Field>{goalType==='POOL_BALANCE'&&<Field title="Connected sample capital pool"><select value={poolId} onChange={e=>setPoolId(e.target.value)}>{state.pools.map(pool=><option key={pool.id} value={pool.id}>{pool.name}</option>)}</select></Field>}</>}
 <div className="wos-form-two"><Field title="Target (KES)"><input required type="number" min="1" step="1" value={target} onChange={e=>setTarget(e.target.value)}/></Field><Field title="Target date"><input required type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></Field></div>
 <Field title="Priority"><select value={priority} onChange={e=>setPriority(e.target.value as GoalPriority)}><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></Field>
 <ErrorNote error={error}/><div className="wos-form-actions"><Button kind="secondary" onClick={()=>setDialog(null)}>Cancel</Button><Button type="submit">Save goal <CheckCircle2 size={14}/></Button></div>
 </form></Modal>:null}
 {dialog==='milestone'&&current&&<Modal title="Add a goal milestone" subtitle={'A measurable checkpoint for '+current.title} onClose={()=>setDialog(null)}><form className="wos-form" onSubmit={saveMilestone}>
 <Field title="Checkpoint title"><input required maxLength={100} value={msTitle} onChange={e=>setMsTitle(e.target.value)} placeholder="e.g. First KES 5M"/></Field>
 <div className="wos-form-two"><Field title="Milestone value (KES)"><input required min="1" type="number" step="1" max={current.target} value={msValue} onChange={e=>setMsValue(e.target.value)}/></Field><Field title="Milestone date"><input required type="date" max={current.deadline} value={msDate} onChange={e=>setMsDate(e.target.value)}/></Field></div>
 <ErrorNote error={error}/><div className="wos-form-actions"><Button kind="secondary" onClick={()=>setDialog(null)}>Cancel</Button><Button type="submit"><CalendarDays size={14}/> Add checkpoint</Button></div>
 </form></Modal>}
 </div>
}
