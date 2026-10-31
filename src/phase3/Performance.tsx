import {useMemo,useState} from 'react';
import {Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {TrendingUp,ArrowUpRight,ArrowDownRight,Layers3,History,RefreshCw,Info,BriefcaseBusiness} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {categories,positionValue} from '../phase2/model';
import type {Category} from '../phase2/model';
import {Header,Button,Card,Stat,Alert,Sample,cash,shortCash,Progress} from './ui';

type WindowKey='ALL'|'7D'|'30D';
const tint:Record<Category,string>={'Business equity':'#6e5fea','Property':'#ac9ff2','Investments':'#58a7cd','Cash & reserves':'#46b799','Other':'#dda75c'};
const delta=(v:number)=>(v>0?'+':'')+cash(v);
export function PerformanceScreen({navigate}:{navigate:(route:'portfolio'|'net-worth'|'capital')=>void}){
 const {state,reset}=useWealth();
 const [period,setPeriod]=useState<WindowKey>('ALL');
 const report=useMemo(()=>{
  const all=state.performance.entries;
  const cutoff=period==='ALL'?0:Date.now()-(period==='7D'?7:30)*86400000;
  const visible=all.filter(e=>new Date(e.at).getTime()>=cutoff);
  const prior=all.filter(e=>new Date(e.at).getTime()<cutoff).at(-1)?.after??state.performance.opening;
  const current=visible.at(-1)?.after??prior;
  const byCategory=Object.fromEntries(categories.map(c=>[c,current.groups[c]-prior.groups[c]])) as Record<Category,number>;
  const points=[{label:'Opening',value:prior.netWorth},...visible.map((e,i)=>({label:'#'+(i+1),value:e.after.netWorth}))];
  return {visible,prior,current,byCategory,delta:current.netWorth-prior.netWorth,assets:current.assets-prior.assets,debt:current.liabilities-prior.liabilities,points};
 },[state.performance,period]);
 const count=state.performance.entries.length;
 const positions=state.positions.map(p=>({name:p.name,category:p.category,investment:positionValue(p),basis:p.cost*p.ownership/100,gain:positionValue(p)-p.cost*p.ownership/100}));
 const unrealized=positions.reduce((a,p)=>a+p.gain,0);
 return <div className="wos-screen">
 <Header title="Wealth Performance" description="Trace what changed in your local demonstration and distinguish portfolio valuation estimates from realized returns." actions={<Button kind="secondary" onClick={reset}><RefreshCw size={14}/> Reset sample</Button>}/>
 <Sample/>
 <Alert>The performance journal records edits made in this browser—NOT bank transfers, trading performance or verified historic returns. Asset additions, valuation changes and corrected liability balances can all affect net worth without representing investment profit.</Alert>
 <div className="wos-kpis">
 <Stat title="Local net-worth change" value={shortCash(report.delta)} hint="From selected period's opening state" icon={<TrendingUp size={18}/>} tone={report.delta>=0?'teal':'gold'}/>
 <Stat title="Gross asset movement" value={shortCash(report.assets)} hint="Sample holdings, valuations and cash" icon={<Layers3 size={18}/>} tone="blue"/>
 <Stat title="Liability balance movement" value={shortCash(report.debt)} hint="Positive means additional debt" icon={<BriefcaseBusiness size={18}/>} tone="gold"/>
 <Stat title="Recorded local changes" value={String(report.visible.length)} hint={count+' total entries in journal'} icon={<History size={18}/>}/>
 </div>
 <div className="wos-grid wide">
 <Card title="Net-worth change journal" subtitle="Actual browser-local edits since this sample was opened" side={<div className="wos-segments">{(['ALL','7D','30D'] as WindowKey[]).map(k=><button type="button" className={period===k?'active':''} key={k} onClick={()=>setPeriod(k)}>{k==='ALL'?'All local changes':k}</button>)}</div>}>
 {report.visible.length?<div className="p3-performance-chart"><ResponsiveContainer width="100%" height={266}><AreaChart data={report.points} margin={{top:10,right:15,left:4,bottom:0}}><defs><linearGradient id="p3-performance" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#7665eb" stopOpacity=".22"/><stop offset="1" stopColor="#7665eb" stopOpacity="0"/></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f6" strokeDasharray="3 4"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#8c99ae'}}/><YAxis tickFormatter={v=>(Number(v)/1e6).toFixed(1)+'M'} axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#8c99ae'}} width={48}/><Tooltip formatter={v=>[cash(Number(v)),'Net worth']}/><Area dataKey="value" type="monotone" stroke="#7665eb" strokeWidth={3} fill="url(#p3-performance)"/></AreaChart></ResponsiveContainer></div>:<div className="p3-no-events"><History size={28}/><h3>No wealth-state edits in this period</h3><p>Revalue a sample holding or record a sample debt change to see a real, local before-and-after chart.</p><Button kind="secondary" onClick={()=>navigate('portfolio')}>Open portfolio <ArrowUpRight size={13}/></Button></div>}
 <div className="p3-local-reconcile"><span>Opening net worth <b>{cash(report.prior.netWorth)}</b></span><span>Latest net worth <b>{cash(report.current.netWorth)}</b></span></div>
 </Card>
 <Card title="Change by wealth class" subtitle="Measured from browser edits, not investment attribution">
 <div className="p3-class-changes">{categories.map(c=>{const v=report.byCategory[c];const max=Math.max(1,...Object.values(report.byCategory).map(x=>Math.abs(x)));return <div key={c}><div className="p3-class-row"><span><i className="p3-dot" style={{background:tint[c]}}/>{c}</span><b className={v>=0?'p3-pos':'p3-neg'}>{delta(v)}</b></div><Progress value={Math.abs(v)/max*100} color={tint[c]}/></div>})}</div>
 <div className="p3-class-reconcile"><span>Asset delta</span><strong>{delta(report.assets)}</strong><span>Less debt delta</span><strong>{delta(-report.debt)}</strong><span>Net-worth delta</span><strong>{delta(report.delta)}</strong></div>
 </Card>
 </div>
 <div className="wos-grid halves">
 <Card title="Unrealized valuation estimate" subtitle="Portfolio reference value minus entered cost basis"><div className="p3-estimate"><strong className={unrealized>=0?'p3-pos':'p3-neg'}>{delta(unrealized)}</strong><span>Across {positions.length} tracked sample positions</span></div><p className="p3-disclaimer"><Info size={14}/> This is not total return: it excludes fees, distributions, FX, contributions, taxes and the timing of asset purchases.</p></Card>
 <Card title="What your journal can prove" subtitle="Source-of-truth boundaries remain intact"><div className="p3-proof"><div><ArrowUpRight size={17}/><span>Local changes are dated and measured before/after each edit.</span></div><div><Layers3 size={17}/><span>Capital reclassification alone cannot create net worth.</span></div><div><ArrowDownRight size={17}/><span>Debt repayments lower cash and debt equally.</span></div></div><Button kind="secondary" onClick={()=>navigate('net-worth')}>Open net-worth balance sheet <ArrowUpRight size={13}/></Button></Card>
 </div>
 <Card title="Sample activity journal" subtitle="Only actions in the local workspace appear here" side={<span className="wos-count">{report.visible.length} entries</span>}>
 {report.visible.length?<div className="wos-table-scroll"><table className="wos-table"><thead><tr><th>When</th><th>Local action</th><th>Type</th><th>Assets changed</th><th>Debt changed</th><th>Net-worth effect</th></tr></thead><tbody>{[...report.visible].reverse().map(e=><tr key={e.id}><td>{new Date(e.at).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short'})}</td><td><strong>{e.label}</strong></td><td><span className="wos-chip">{e.kind.toLowerCase()}</span></td><td>{delta(e.after.assets-e.before.assets)}</td><td>{delta(e.after.liabilities-e.before.liabilities)}</td><td><strong>{delta(e.after.netWorth-e.before.netWorth)}</strong></td></tr>)}</tbody></table></div>:<p className="p3-empty">No recorded changes in this period. Your original sample balances remain available in Net Worth.</p>}
 </Card>
 <Card title="Portfolio cost-basis comparison" subtitle="Not a verified return calculation"><div className="wos-table-scroll"><table className="wos-table"><thead><tr><th>Position</th><th>Asset class</th><th>Ownership-adjusted cost</th><th>Current estimate</th><th>Difference</th></tr></thead><tbody>{positions.map(p=><tr key={p.name}><td><strong>{p.name}</strong></td><td>{p.category}</td><td>{cash(p.basis)}</td><td>{cash(p.investment)}</td><td className={p.gain>=0?'p3-pos':'p3-neg'}>{delta(p.gain)}</td></tr>)}</tbody></table></div></Card>
 </div>
}
