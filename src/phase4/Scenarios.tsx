import {useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {BarChart,Bar,ResponsiveContainer,XAxis,YAxis,CartesianGrid,Tooltip} from 'recharts';
import {ArrowRight,Beaker,CheckCircle2,Copy,Info,Plus,ShieldAlert,Trash2,TrendingDown,WalletCards} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {addScenario,deleteScenario,simulateScenario} from './model';
import type {Scenario,ScenarioKind} from './model';
import {Header,Button,Card,Stat,Alert,Sample,Badge,Field,Modal,ErrorNote,cash,shortCash,newId,errorText} from '../phase3/ui';
const kinds:Record<ScenarioKind,{label:string,unit:string,amount:number,desc:string}>={
 INVEST_CASH:{label:'Invest free cash',unit:'KES',amount:100000,desc:'Reclassify deployable cash to investments, no instant net-worth gain.'},
 MARKET_DROP:{label:'Investment market decline',unit:'%',amount:20,desc:'Apply a percentage shock to investment holdings.'},
 DEBT_REPAY:{label:'Simulate a loan repayment',unit:'KES',amount:100000,desc:'Spend free cash to reduce debt by an equal amount.'},
 PROPERTY_PURCHASE:{label:'Property acquisition using cash',unit:'KES',amount:200000,desc:'Exchange available cash for equal-value property; excludes fees.'},
 INCOME_LOSS:{label:'Income interruption',unit:'%',amount:30,desc:'Reduce modeled monthly income without altering opening wealth.'},
 BUSINESS_DROP:{label:'Private business valuation fall',unit:'%',amount:25,desc:'Apply a valuation shock to sample private business equity.'}
};
const kindList=Object.keys(kinds) as ScenarioKind[];
function sourceKind(kind:ScenarioKind){return kinds[kind].label}
export function ScenarioScreen({navigate}:{navigate:(r:'forecasts'|'capital'|'risk')=>void}){
 const {state,update,notify}=useWealth();
 const saved=state.intelligence.scenarios;
 const [selected,setSelected]=useState(saved[0]?.id??'');
 const [kind,setKind]=useState<ScenarioKind>('MARKET_DROP');
 const [value,setValue]=useState('20'),[title,setTitle]=useState('Custom market decline');
 const [error,setError]=useState('');
 const [adding,setAdding]=useState(false);
 const scenario=saved.find(s=>s.id===selected)??saved[0];
 const output=useMemo(()=>{if(!scenario)return null;try{return simulateScenario(state,scenario)}catch{return null}},[state,scenario]);
 const all=saved.map(s=>({scenario:s,result:simulateScenario(state,s)}));
 function add(e:FormEvent){e.preventDefault();setError('');try{const s:Scenario={id:newId(),title,kind,amount:Number(value),createdAt:new Date().toISOString().slice(0,10)};simulateScenario(state,s);update(prev=>addScenario(prev,s));setSelected(s.id);setAdding(false);notify('Scenario saved as an isolated local thought experiment; no wealth figures were edited.')}catch(err){setError(errorText(err))}}
 function newScenario(){setKind('MARKET_DROP');setValue('20');setTitle('Custom market decline');setError('');setAdding(true)}
 function chooseKind(k:ScenarioKind){setKind(k);setValue(String(kinds[k].amount));setTitle(kinds[k].label)}
 function remove(id:string){update(s=>deleteScenario(s,id));if(selected===id)setSelected(saved.find(s=>s.id!==id)?.id??'');notify('Local scenario removed. Financial balances remain unchanged.')}
 const comparison=output?[{name:'Gross assets',before:output.before.assets,after:output.after.assets},{name:'Liabilities',before:output.before.debt,after:output.after.debt},{name:'Net worth',before:output.before.netWorth,after:output.after.netWorth},{name:'Cash',before:output.before.cash,after:output.after.cash},{name:'Investments',before:output.before.investments,after:output.after.investments}]:[];
 return <div className="wos-screen">
 <Header title="Scenario Lab" description="Explore immediate financial consequences of alternative actions and stress events without mutating your portfolio." actions={<><Button kind="secondary" onClick={()=>navigate('forecasts')}><TrendingDown size={14}/> Long-term forecast</Button><Button onClick={newScenario}><Plus size={15}/> Create scenario</Button></>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="Saved what-if cases" value={String(saved.length)} hint="Browser-local demonstrations" icon={<Beaker size={18}/>}/>
 <Stat title="Feasible cases" value={String(all.filter(s=>s.result.feasible).length)} hint="Pass illustrative free-cash limits" icon={<CheckCircle2 size={18}/>} tone="teal"/>
 <Stat title="Highest modeled loss" value={shortCash(Math.min(0,...all.map(s=>s.result.delta)))} hint="Across current stored stress tests" icon={<TrendingDown size={18}/>} tone="gold"/>
 <Stat title="Blocked cases" value={String(all.filter(s=>!s.result.feasible).length)} hint="Cannot use protected/committed cash" icon={<ShieldAlert size={18}/>} tone="blue"/>
 </div>
 <Alert>Scenarios are isolated arithmetic demonstrations. Market and business shocks affect modeled asset values; a loan repayment reduces cash and liabilities equally. Buying an asset with cash does not instantly create net worth. No real transfers, investments or asset records occur.</Alert>
 <div className="p4-scenario-layout">
 <Card title="Scenario collection" subtitle="Choose a saved experiment or create a new one">
 <div className="p4-scenario-list">{saved.map(s=>{const res=simulateScenario(state,s);return <div key={s.id} className={'p4-scenario-entry '+(scenario?.id===s.id?'selected':'')}><button type="button" className="p4-scenario-pick" onClick={()=>setSelected(s.id)}><div><b>{s.title}</b><small>{sourceKind(s.kind)} · {kinds[s.kind].unit==='%'?s.amount+'%':shortCash(s.amount)}</small></div><Badge tone={res.feasible?'teal':'gold'}>{res.feasible?'Feasible':'Blocked'}</Badge></button><button type="button" aria-label={'Delete scenario '+s.title} className="p4-scenario-delete" onClick={()=>remove(s.id)}><Trash2 size={14}/></button></div>})}{!saved.length&&<p className="p3-empty">No saved scenarios. Create one above.</p>}</div>
 </Card>
 <Card title={scenario?.title??'Select a scenario'} subtitle="Before → hypothetical after; underlying local state is never changed">
 {scenario&&output?<><div className={'p4-policy-banner '+(output.feasible?'pass':'block')}>{output.feasible?<CheckCircle2 size={17}/>:<ShieldAlert size={17}/>}<span>{output.feasible?'Scenario can be illustrated within sample cash limits':'Insufficient uncommitted capital or debt balance'}</span></div>
 <p className="p4-body">{output.narrative}</p>
 <div className="p4-scenario-big"><div><span>Current net worth</span><strong>{shortCash(output.before.netWorth)}</strong></div><ArrowRight size={19}/><div><span>Scenario net worth</span><strong>{shortCash(output.after.netWorth)}</strong></div></div>
 <div className="p4-scenario-delta"><span>Modeled change</span><b className={output.delta<0?'p3-neg':'p3-pos'}>{output.delta>0?'+':''}{cash(output.delta)}</b></div>
 <div className="p4-chart"><ResponsiveContainer width="100%" height={260}><BarChart data={comparison} margin={{top:12,right:12,bottom:4,left:0}}><CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="4 4"/><XAxis dataKey="name" tick={{fontSize:10,fill:'#8797ae'}} tickLine={false} axisLine={false}/><YAxis tickFormatter={v=>(Number(v)/1e6).toFixed(1)+'M'} tick={{fontSize:10,fill:'#8797ae'}} tickLine={false} axisLine={false} width={47}/><Tooltip formatter={v=>[cash(Number(v)),'KES']}/><Bar dataKey="before" name="Current" fill="#a39bef" barSize={13} radius={[3,3,0,0]}/><Bar dataKey="after" name="Scenario" fill="#49b8a0" barSize={13} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div>
 <div className="p4-chart-legend"><span><i style={{background:'#a39bef'}}/>Current</span><span><i style={{background:'#49b8a0'}}/>Hypothetical after</span></div>
 <div className="p4-policy-notes">{output.warnings.map(w=><p key={w}><Info size={14}/>{w}</p>)}</div>
 <Button kind="secondary" onClick={()=>navigate('capital')}><WalletCards size={14}/> Review capital restrictions</Button>
 </>:<p className="p3-empty">No scenario to evaluate.</p>}
 </Card></div>
 <Card title="Cross-scenario comparison" subtitle="No simulation result changes actual sample balances"><div className="wos-table-scroll"><table className="wos-table"><thead><tr><th>Scenario</th><th>Category</th><th>Available cash allowed</th><th>Net worth delta</th><th>Monthly income delta</th><th>Result</th></tr></thead><tbody>{all.map(({scenario:s,result:r})=><tr key={s.id}><td><b>{s.title}</b></td><td>{sourceKind(s.kind)}</td><td>{r.feasible?'Yes':'No'}</td><td className={r.delta<0?'p3-neg':'p3-pos'}>{cash(r.delta)}</td><td>{cash(r.after.income-r.before.income)}</td><td><Badge tone={r.feasible?'teal':'gold'}>{r.feasible?'Illustration':'Blocked'}</Badge></td></tr>)}</tbody></table>{!all.length&&<p className="p3-empty">No scenarios yet.</p>}</div>
 <div className="p4-button-row"><Button kind="secondary" onClick={()=>navigate('risk')}>Review current risks</Button><Button kind="secondary" onClick={()=>navigate('forecasts')}><Copy size={14}/> Compare with long-term forecasts</Button></div></Card>
 {adding&&<Modal title="New isolated scenario" subtitle="Enter a market shock or cash-funded action. Your real and sample holdings will not be mutated." onClose={()=>setAdding(false)}><form className="wos-form" onSubmit={add}>
 <Field title="Scenario name"><input required maxLength={110} value={title} onChange={e=>setTitle(e.target.value)}/></Field>
 <Field title="Event or choice"><select value={kind} onChange={e=>chooseKind(e.target.value as ScenarioKind)}>{kindList.map(k=><option value={k} key={k}>{kinds[k].label}</option>)}</select></Field>
 <p className="p4-form-help">{kinds[kind].desc}</p>
 <Field title={'Impact amount ('+kinds[kind].unit+')'}><input required type="number" min="1" max={kinds[kind].unit==='%'?'100':'1000000000000'} step={kinds[kind].unit==='%'?'1':'1000'} value={value} onChange={e=>setValue(e.target.value)}/></Field>
 <ErrorNote error={error}/><div className="wos-form-actions"><Button kind="secondary" onClick={()=>setAdding(false)}>Cancel</Button><Button type="submit"><Beaker size={14}/> Save and evaluate</Button></div>
 </form></Modal>}
 </div>
}
