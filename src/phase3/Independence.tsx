import {useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {LineChart,Line,CartesianGrid,ResponsiveContainer,XAxis,YAxis,Tooltip,Legend,ReferenceLine} from 'recharts';
import {Target,TrendingUp,WalletCards,ShieldCheck,SlidersHorizontal,CheckCircle2,ArrowRight,RefreshCw} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {independenceMetrics,independenceProjection,updateIndependence,futureValue} from './model';
import type {IndependencePlan} from './model';
import {Header,Button,Card,Stat,Alert,Field,ErrorNote,Modal,Sample,cash,shortCash,errorText} from './ui';
const referenceYear=2026;
export function IndependenceScreen({navigate}:{navigate:(route:'goals'|'strategies'|'capital')=>void}){
 const {state,metrics,update,notify,reset}=useWealth();
 const plan=state.planning.independence;
 const ind=independenceMetrics(state,metrics);
 const projection=independenceProjection(state,metrics);
 const [dialog,setDialog]=useState(false),[error,setError]=useState('');
 const [form,setForm]=useState<IndependencePlan>(plan);
 const [extra,setExtra]=useState(20000);
 function edit(){setForm({...plan});setError('');setDialog(true)}
 function save(e:FormEvent){e.preventDefault();setError('');try{const next={...form,updatedAt:new Date().toISOString().slice(0,10)};update(s=>updateIndependence(s,next));notify('Financial independence assumptions updated in local sample plan.');setDialog(false)}catch(e){setError(errorText(e))}}
 const series=useMemo(()=>{
  const horizon=projection.years;
  return Array.from({length:horizon+1},(_,i)=>({
   year:referenceYear+i,
   baseline:Math.round(futureValue(ind.eligible,plan.monthlyContribution,plan.assumedReturnPct,i*12)),
   alternative:Math.round(futureValue(ind.eligible,plan.monthlyContribution+extra,plan.assumedReturnPct,i*12)),
   required:Math.round(ind.capitalRequired*Math.pow(1+plan.annualInflationPct/100,i))
  }));
 },[ind.eligible,ind.capitalRequired,plan,extra,projection.years]);
 const extraEnd=series.at(-1)?.alternative??ind.eligible;
 return <div className="wos-screen">
 <Header title="Financial Independence" description="Design a life-cost target and understand the capital gap under adjustable, clearly hypothetical assumptions." actions={<><Button kind="secondary" onClick={reset}><RefreshCw size={14}/> Reset sample</Button><Button onClick={edit}><SlidersHorizontal size={15}/> Edit independence plan</Button></>}/>
 <Sample/><div className="wos-kpis">
 <Stat title="Independence target" value={shortCash(ind.capitalRequired)} hint="Based on current lifestyle and withdrawal assumption" icon={<Target size={18}/>}/>
 <Stat title="Eligible capital" value={shortCash(ind.eligible)} hint="Investments + deployable cash only" icon={<WalletCards size={18}/>} tone="blue"/>
 <Stat title="Capital progress" value={ind.progress.toFixed(1)+'%'} hint="Capital eligible / capital needed" icon={<TrendingUp size={18}/>} tone="teal"/>
 <Stat title="Passive-income coverage" value={ind.incomeCoverage.toFixed(1)+'%'} hint={cash(metrics.passiveIncome)+'/month vs lifestyle target'} icon={<ShieldCheck size={18}/>} tone="gold"/>
 </div>
 <Alert>Independence is a hypothetical planning model, not a retirement guarantee. Eligible capital includes investment positions and uncommitted cash. It excludes property, private business valuations and protected reserves. Withdrawal rates, inflation and returns are assumptions, not verified outcomes.</Alert>
 <div className="wos-grid wide"><Card title="Independence journey" subtitle={'Projected capital against inflation-adjusted requirement, through '+plan.targetYear} side={<span className="wos-count">Illustrative annual projections</span>}>
 <div className="p3-projection-keys"><span><i className="p3-dot" style={{background:'#7564f1'}}/>Current contribution</span><span><i className="p3-dot" style={{background:'#44b89c'}}/>Extra monthly savings</span><span><i className="p3-dot" style={{background:'#dfa65b'}}/>Inflation-adjusted target</span></div>
 <div className="p3-independence-chart"><ResponsiveContainer width="100%" height={300}><LineChart data={series} margin={{top:10,right:16,bottom:7,left:5}}><CartesianGrid vertical={false} stroke="#e9edf5" strokeDasharray="4 5"/><XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#8896ab'}}/><YAxis tickFormatter={v=>(Number(v)/1e6).toFixed(0)+'M'} axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#8896ab'}} width={43}/><Tooltip formatter={v=>[cash(Number(v)),'Capital']} labelFormatter={v=>'Year '+v}/><Legend wrapperStyle={{display:'none'}}/><ReferenceLine y={ind.capitalRequired} stroke="#ccc1e9" strokeDasharray="2 4"/><Line dataKey="baseline" type="monotone" name="Current contribution" stroke="#7564f1" strokeWidth={2.5} dot={false}/><Line dataKey="alternative" type="monotone" name="With additional savings" stroke="#44b89c" strokeWidth={2.5} dot={false}/><Line dataKey="required" type="monotone" name="Inflation-adjusted target" stroke="#dfa65b" strokeWidth={2} strokeDasharray="6 4" dot={false}/></LineChart></ResponsiveContainer></div>
 <div className="p3-headline"><h3>What if you contributed more?</h3><b className="p3-strong-violet">+{cash(extra)}/month</b></div>
 <input className="p3-range" type="range" aria-label="Extra monthly contribution amount" min="0" max="150000" step="5000" value={extra} onChange={e=>setExtra(Number(e.target.value))}/>
 <div className="p3-comparison"><div><small>Current monthly contribution</small><b>{cash(plan.monthlyContribution)}</b></div><div><small>Scenario contribution</small><b>{cash(plan.monthlyContribution+extra)}</b></div><div><small>Projected capital, {plan.targetYear}</small><b>{shortCash(extraEnd)}</b></div></div>
 </Card>
 <Card title="Independence scorecard" subtitle="All values come from editable local assumptions">
 <div className="p3-independence-progress"><div className="p3-independence-ring" style={{background:'conic-gradient(#7665ec '+ind.progress+'%,#ebedf8 '+ind.progress+'% 100%)'}}><span><b>{ind.progress.toFixed(1)}%</b><small>of required capital</small></span></div><div><small>Today's target</small><b>{cash(ind.capitalRequired)}</b><small>Eligible today</small><b>{cash(ind.eligible)}</b></div></div>
 <div className="p3-score-rows"><div><span>Capital still needed</span><b>{cash(ind.capitalGap)}</b></div><div><span>Lifestyle budget per month</span><b>{cash(plan.monthlyLifestyleCost)}</b></div><div><span>Passive income per month</span><b>{cash(metrics.passiveIncome)}</b></div><div><span>Monthly income coverage gap</span><b>{cash(ind.monthlyShortfall)}</b></div><div><span>Target year</span><b>{plan.targetYear}</b></div></div>
 <div className="p3-cta-row"><Button kind="secondary" onClick={()=>navigate('capital')}>Explore capital <ArrowRight size={13}/></Button><Button kind="secondary" onClick={()=>navigate('strategies')}>Strategies <ArrowRight size={13}/></Button></div>
 </Card></div>
 <div className="wos-grid halves"><Card title="Planning assumptions" subtitle="Values are hypothetical and editable"><div className="p3-assumptions"><div><span>Annual withdrawal assumption</span><strong>{plan.withdrawalRatePct}%</strong></div><div><span>Annual return assumption</span><strong>{plan.assumedReturnPct}%</strong></div><div><span>Annual lifestyle inflation</span><strong>{plan.annualInflationPct}%</strong></div><div><span>Monthly investment contribution</span><strong>{cash(plan.monthlyContribution)}</strong></div></div></Card><Card title="Capital eligibility & limitations" subtitle="Deliberately conservative modeling boundaries"><div className="p3-eligibility"><div><CheckCircle2 size={17}/><span>Investment positions <b>{cash(metrics.groups.Investments)}</b></span></div><div><CheckCircle2 size={17}/><span>Uncommitted cash <b>{cash(metrics.deployable)}</b></span></div><div className="muted"><Target size={17}/><span>Private business, property and protected cash are excluded.</span></div></div><Button kind="secondary" onClick={()=>navigate('goals')}>Review wealth goals <ArrowRight size={13}/></Button></Card></div>
 {dialog&&<Modal title="Edit independence assumptions" subtitle="This updates only the local strategic model, never real financial holdings." onClose={()=>setDialog(false)}><form className="wos-form" onSubmit={save}>
 <div className="wos-form-two"><Field title="Monthly desired lifestyle (KES)"><input required type="number" min="1" step="1000" value={form.monthlyLifestyleCost} onChange={e=>setForm(f=>({...f,monthlyLifestyleCost:Number(e.target.value)}))}/></Field><Field title="Target year"><input required type="number" min="2026" max="2100" step="1" value={form.targetYear} onChange={e=>setForm(f=>({...f,targetYear:Number(e.target.value)}))}/></Field></div>
 <div className="wos-form-two"><Field title="Annual withdrawal assumption (%)"><input required type="number" min=".1" max="12" step=".1" value={form.withdrawalRatePct} onChange={e=>setForm(f=>({...f,withdrawalRatePct:Number(e.target.value)}))}/></Field><Field title="Annual return assumption (%)"><input required type="number" min="0" max="50" step=".1" value={form.assumedReturnPct} onChange={e=>setForm(f=>({...f,assumedReturnPct:Number(e.target.value)}))}/></Field></div>
 <div className="wos-form-two"><Field title="Lifestyle inflation (%)"><input required type="number" min="0" max="40" step=".1" value={form.annualInflationPct} onChange={e=>setForm(f=>({...f,annualInflationPct:Number(e.target.value)}))}/></Field><Field title="Monthly new contributions (KES)"><input required type="number" min="0" step="1000" value={form.monthlyContribution} onChange={e=>setForm(f=>({...f,monthlyContribution:Number(e.target.value)}))}/></Field></div>
 <ErrorNote error={error}/><div className="wos-form-actions"><Button kind="secondary" onClick={()=>setDialog(false)}>Cancel</Button><Button type="submit">Save local plan <CheckCircle2 size={14}/></Button></div>
 </form></Modal>}
 </div>
}
