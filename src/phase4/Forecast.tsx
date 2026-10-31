import {useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {LineChart,Line,CartesianGrid,ResponsiveContainer,XAxis,YAxis,Tooltip,Legend} from 'recharts';
import {CalendarRange,ChartNoAxesCombined,Coins,Info,Settings2,Target,TrendingDown,TrendingUp} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {independenceMetrics} from '../phase3/model';
import {forecastSeries,updateForecast,seedIntelligence} from './model';
import type {ForecastInputs} from './model';
import {Header,Button,Card,Stat,Alert,Sample,Field,ErrorNote,Modal,cash,shortCash,errorText} from '../phase3/ui';

export function ForecastScreen({navigate}:{navigate:(r:'scenarios'|'independence')=>void}){
 const {state,metrics,update,notify}=useWealth();
 const config=state.intelligence.forecast;
 const points=useMemo(()=>forecastSeries(state),[state]);
 const latest=points[points.length-1];
 const independence=independenceMetrics(state,metrics);
 const [editing,setEditing]=useState(false),[form,setForm]=useState<ForecastInputs>(config),[error,setError]=useState('');
 function start(){setForm({...config});setError('');setEditing(true)}
 function save(e:FormEvent){e.preventDefault();setError('');try{update(s=>updateForecast(s,form));setEditing(false);notify('Illustrative forecast assumptions saved to your local browser workspace.')}catch(err){setError(errorText(err))}}
 function reset(){update(s=>updateForecast(s,structuredClone(seedIntelligence.forecast)));notify('Sample forecast assumptions restored.')}
 const base=metrics.groups.Investments+metrics.deployable;
 return <div className="wos-screen">
 <Header title="Wealth Forecasting" description="Stress-test possible investable-capital paths with explicit return, contribution and inflation assumptions." actions={<><Button kind="secondary" onClick={reset}>Reset assumptions</Button><Button onClick={start}><Settings2 size={15}/> Edit forecast</Button></>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="Investable opening capital" value={shortCash(base)} hint="Investments + uncommitted cash" icon={<Coins size={18}/>}/>
 <Stat title="Baseline at horizon" value={shortCash(latest.baseline)} hint={'Year '+latest.year+' · '+config.baselinePct+'% assumed nominal'} icon={<TrendingUp size={18}/>} tone="teal"/>
 <Stat title="Downside at horizon" value={shortCash(latest.downside)} hint={config.downsidePct+'% assumed annual return'} icon={<TrendingDown size={18}/>} tone="gold"/>
 <Stat title="Upside at horizon" value={shortCash(latest.upside)} hint={config.upsidePct+'% assumed annual return'} icon={<ChartNoAxesCombined size={18}/>} tone="blue"/>
 </div>
 <Alert>These are deterministic compound-growth illustrations, not actual net-worth forecasts or calibrated probabilities. Business equity, property values, debt balances, tax, fees, currency movements, volatility and changing contributions are excluded. Results are conditional on all displayed assumptions.</Alert>
 <div className="wos-grid wide">
 <Card title="Projected capital pathways" subtitle="Investments + deployable cash. Monthly contributions are hypothetical new funding." side={<span className="wos-count">{config.years}-year horizon</span>}>
 <div className="p4-chart-legend"><span><i style={{background:'#7564ee'}}/>Baseline</span><span><i style={{background:'#dfa761'}}/>Downside</span><span><i style={{background:'#47b89a'}}/>Upside</span></div>
 <div className="p4-chart"><ResponsiveContainer width="100%" height={300}><LineChart data={points} margin={{top:12,right:14,left:5,bottom:8}}><CartesianGrid stroke="#edf0f6" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#8997ad'}}/><YAxis tickFormatter={v=>(Number(v)/1e6).toFixed(1)+'M'} axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#8997ad'}} width={49}/><Tooltip formatter={v=>[cash(Number(v)),'Modeled capital']} labelFormatter={v=>'Year '+v}/><Legend wrapperStyle={{display:'none'}}/><Line type="monotone" dataKey="baseline" name="Baseline" stroke="#7564ee" strokeWidth={2.7} dot={false}/><Line type="monotone" dataKey="downside" name="Downside" stroke="#dfa761" strokeWidth={2} strokeDasharray="6 3" dot={false}/><Line type="monotone" dataKey="upside" name="Upside" stroke="#47b89a" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div>
 <div className="p4-range-strip"><div><span>Downside</span><b>{shortCash(latest.downside)}</b></div><div><span>Baseline</span><b>{shortCash(latest.baseline)}</b></div><div><span>Upside</span><b>{shortCash(latest.upside)}</b></div></div>
 </Card>
 <Card title="What is assumed" subtitle="Reproducible inputs rather than model-generated claims">
 <div className="p4-kv"><span>Starting eligible capital</span><b>{cash(base)}</b></div>
 <div className="p4-kv"><span>Monthly contribution</span><b>{cash(config.monthlyContribution)}</b></div>
 <div className="p4-kv"><span>Baseline / downside / upside</span><b>{config.baselinePct}% / {config.downsidePct}% / {config.upsidePct}%</b></div>
 <div className="p4-kv"><span>Inflation assumption</span><b>{config.inflationPct}% per year</b></div>
 <div className="p4-kv"><span>Baseline in present-value KES</span><b>{shortCash(latest.baselineReal)}</b></div>
 <div className="p4-kv"><span>Total hypothetical contributions</span><b>{shortCash(latest.contributed)}</b></div>
 <div className="p4-callout"><Target size={16}/><p>Today’s illustrative independence capital target is <b>{cash(independence.capitalRequired)}</b>. Forecasted capital is not a guarantee of reaching it.</p></div>
 <div className="p4-button-row"><Button kind="secondary" onClick={()=>navigate('scenarios')}>Scenario Lab <ChartNoAxesCombined size={14}/></Button><Button kind="secondary" onClick={()=>navigate('independence')}>Independence plan <CalendarRange size={14}/></Button></div>
 </Card></div>
 <Card title="Annual capital projection table" subtitle="Exact deterministic values at the end of each modeled year">
 <div className="wos-table-scroll"><table className="wos-table"><thead><tr><th>Year</th><th>Downside</th><th>Baseline</th><th>Upside</th><th>Baseline, inflation-adjusted</th><th>Cumulative new contributions</th></tr></thead><tbody>{points.map(x=><tr key={x.year}><td><b>{x.year}</b></td><td>{cash(x.downside)}</td><td>{cash(x.baseline)}</td><td>{cash(x.upside)}</td><td>{cash(x.baselineReal)}</td><td>{cash(x.contributed)}</td></tr>)}</tbody></table></div>
 <p className="p4-disclaimer"><Info size={14}/> Returns are constant annual assumptions compounded monthly. No probability or future market forecast is claimed.</p>
 </Card>
 {editing&&<Modal title="Set forecast assumptions" subtitle="Configure three explicit hypothetical return cases. This modifies no wealth holdings." onClose={()=>setEditing(false)}><form className="wos-form" onSubmit={save}>
 <div className="wos-form-two"><Field title="Projection years (1–30)"><input required type="number" min="1" max="30" step="1" value={form.years} onChange={e=>setForm(f=>({...f,years:Number(e.target.value)}))}/></Field><Field title="New contributions per month (KES)"><input required type="number" min="0" max="10000000" step="1000" value={form.monthlyContribution} onChange={e=>setForm(f=>({...f,monthlyContribution:Number(e.target.value)}))}/></Field></div>
 <div className="wos-form-two"><Field title="Downside annual return (%)"><input required type="number" min="-50" max="50" step=".5" value={form.downsidePct} onChange={e=>setForm(f=>({...f,downsidePct:Number(e.target.value)}))}/></Field><Field title="Baseline annual return (%)"><input required type="number" min="-50" max="50" step=".5" value={form.baselinePct} onChange={e=>setForm(f=>({...f,baselinePct:Number(e.target.value)}))}/></Field></div>
 <div className="wos-form-two"><Field title="Upside annual return (%)"><input required type="number" min="-50" max="50" step=".5" value={form.upsidePct} onChange={e=>setForm(f=>({...f,upsidePct:Number(e.target.value)}))}/></Field><Field title="Annual inflation (%)"><input required type="number" min="0" max="40" step=".5" value={form.inflationPct} onChange={e=>setForm(f=>({...f,inflationPct:Number(e.target.value)}))}/></Field></div>
 <ErrorNote error={error}/><div className="wos-form-actions"><Button kind="secondary" onClick={()=>setEditing(false)}>Cancel</Button><Button type="submit">Update illustration <Settings2 size={14}/></Button></div>
 </form></Modal>}
 </div>
}
