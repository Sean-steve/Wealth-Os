import {useMemo,useState} from 'react';
import {BarChart,Bar,CartesianGrid,ResponsiveContainer,XAxis,YAxis,Tooltip,Cell} from 'recharts';
import {Activity,ArrowRight,CalendarRange,FileJson,FileSpreadsheet,FileText,Landmark,ShieldAlert,Target,TrendingUp,WalletCards} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {categories} from '../phase2/model';
import {buildReport,reportCsv,reportJson,updateWorkspaceSettings} from './model';
import {saveLocalFile,sampleDateStamp} from './download';
import {Alert,Badge,Button,Card,Header,Sample,Stat,cash,shortCash} from '../phase3/ui';
const palette=['#7764ec','#ac9ff2','#52a5c4','#44b49a','#e3b36b'];
export function ReportsScreen({navigate}:{navigate:(r:'security'|'decisions'|'settings')=>void}){
 const {state,metrics,update,notify}=useWealth();
 const report=useMemo(()=>buildReport(state),[state]);
 const settings=state.governance.settings;
 const [error,setError]=useState('');
 const format=(n:number)=>settings.compactDisplay?shortCash(n):cash(n);
 const source=categories.map((label,i)=>({label,value:metrics.groups[label],color:palette[i]}));
 function exportReport(kind:'json'|'csv'){try{
  const content=kind==='json'?reportJson(report):reportCsv(report);
  saveLocalFile('wealth-os-sample-report-'+sampleDateStamp()+'.'+kind,content,kind==='json'?'application/json':'text/csv');
  notify('Browser-local report downloaded as '+kind.toUpperCase()+'. Contains only illustrative local information.');
 }catch(e){setError(e instanceof Error?e.message:'Unable to export local report.')}}
 function changePeriod(v:'CURRENT'|'ALL'){update(s=>updateWorkspaceSettings(s,{...s.governance.settings,reportPeriod:v}))}
 return <div className="wos-screen">
 <Header title="Wealth Reports" description="A consolidated, exportable sample wealth report with transparent figures, source labels and data limitations." actions={<><Button kind="secondary" onClick={()=>navigate('settings')}><CalendarRange size={14}/> Report settings</Button><Button onClick={()=>exportReport('json')}><FileJson size={15}/> Export JSON</Button><Button kind="secondary" onClick={()=>exportReport('csv')}><FileSpreadsheet size={15}/> Export CSV</Button></>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="Net worth" value={format(report.netWorth)} hint="Assets less liabilities" icon={<TrendingUp size={18}/>}/>
 <Stat title="Available capital" value={format(report.deployable)} hint="Cash unreserved and uncommitted" icon={<WalletCards size={18}/>} tone="teal"/>
 <Stat title="Total liabilities" value={format(report.liabilities)} hint="Outstanding sample obligations" icon={<Landmark size={18}/>} tone="gold"/>
 <Stat title="Independence capital target" value={format(report.independenceTarget)} hint="Lifestyle / withdrawal assumption" icon={<Target size={18}/>} tone="blue"/>
 </div>
 <Alert>This is a snapshot of **fictional browser-local values**, not an audited financial statement, tax report, verified performance report, live account reconciliation or personalized investment recommendation. Exports are readable plain text and can be shared only at your own discretion.</Alert>
 <div className="p5-report-banner"><div><small>PERSONAL WEALTH / ILLUSTRATIVE STATEMENT</small><h2>Wealth Position & Strategic Review</h2><p>Generated {new Date(report.generatedAt).toLocaleString('en-KE')} · Currency: KES · Source: browser-local sample workspace</p></div><Badge tone="gold">Not externally verified</Badge></div>
 <div className="wos-grid wide">
 <Card title="Gross asset composition" subtitle="Attributable ownership-adjusted asset categories">
 <div className="p5-report-chart"><ResponsiveContainer width="100%" height={275}><BarChart data={source} layout="vertical" margin={{top:10,right:16,bottom:0,left:5}}><CartesianGrid horizontal={false} stroke="#e9edf5" strokeDasharray="3 5"/><XAxis type="number" tick={{fontSize:10,fill:'#8d98a9'}} tickFormatter={v=>(Number(v)/1e6).toFixed(1)+'M'} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="label" tick={{fontSize:10,fill:'#73849c'}} width={110} axisLine={false} tickLine={false}/><Tooltip formatter={v=>[cash(Number(v)),'Gross assets']}/><Bar dataKey="value" barSize={17} radius={[0,5,5,0]}>{source.map(x=><Cell key={x.label} fill={x.color}/>)}</Bar></BarChart></ResponsiveContainer></div>
 </Card>
 <Card title="Balance sheet summary" subtitle="Consolidated view; pools classify existing cash">
 <div className="p4-kv"><span>Owned assets</span><b>{format(report.assets)}</b></div><div className="p4-kv"><span>Liabilities</span><b>− {format(report.liabilities)}</b></div><div className="p4-kv p5-emphasis"><span>Net worth</span><b>{format(report.netWorth)}</b></div>
 <div className="p4-kv"><span>Cash</span><b>{format(report.cash)}</b></div><div className="p4-kv"><span>Protected reserves</span><b>{format(report.reserves)}</b></div><div className="p4-kv"><span>Committed capital</span><b>{format(report.committed)}</b></div><div className="p4-kv"><span>Deployable capital</span><b>{format(report.deployable)}</b></div>
 </Card></div>
 <div className="wos-grid halves">
 <Card title="Income, debt & independence" subtitle="Calculated using existing Phase 2–3 models">
 <div className="p4-kv"><span>Total monthly income</span><b>{format(report.monthlyIncome)}</b></div><div className="p4-kv"><span>Monthly passive income</span><b>{format(report.passiveMonthly)}</b></div><div className="p4-kv"><span>Monthly debt payments</span><b>{format(report.debtService)}</b></div><div className="p4-kv"><span>Investable capital for independence</span><b>{format(report.independenceEligible)}</b></div><div className="p4-kv"><span>Target independence capital</span><b>{format(report.independenceTarget)}</b></div>
 </Card>
 <Card title="Report scope & source lineage" subtitle="What the current prototype can and cannot verify">
 <div className="p5-source-row"><FileText size={16}/><span>Net worth</span><b>Phase 2 local position and liability values</b></div>
 <div className="p5-source-row"><Target size={16}/><span>Goal progress</span><b>Phase 3 goal measurement formulas</b></div>
 <div className="p5-source-row"><ShieldAlert size={16}/><span>Risk signals</span><b>Phase 4 heuristic thresholds</b></div>
 <div className="p5-source-row"><Activity size={16}/><span>Decision events</span><b>{report.events.length} included; local-only events</b></div>
 <div className="p5-boundary"><ShieldAlert size={16}/><span>No real Finance OS, Asset OS, Company OS, tax authority, bank, or investment provider is connected.</span></div>
 </Card></div>
 <Card title="Goal progress & risk overview" subtitle="Priorities are derived from currently entered local sample values">
 <div className="wos-table-scroll"><table className="wos-table"><thead><tr><th>Goal</th><th>Measured</th><th>Target</th><th>Progress</th><th>Deadline</th></tr></thead><tbody>{report.goals.map(g=><tr key={g.name}><td><strong>{g.name}</strong></td><td>{format(g.current)}</td><td>{format(g.target)}</td><td>{g.progress.toFixed(1)}%</td><td>{g.date}</td></tr>)}</tbody></table>{!report.goals.length&&<p className="p3-empty">No current goals.</p>}</div>
 <div className="p5-report-risks">{report.risks.filter(r=>r.severity!=='OK').map(r=><div key={r.title}><ShieldAlert size={14}/><b>{r.title}</b><span>{r.observed}</span><Badge tone="gold">{r.severity}</Badge></div>)}{!report.risks.some(r=>r.severity!=='OK')&&<p className="p3-empty">No sample threshold breaches in current data.</p>}</div>
 </Card>
 <Card title="Decision journal export scope" subtitle="A report captures the current cases and optionally the local events">
 <div className="p5-report-options"><label><span>Export time scope</span><select value={settings.reportPeriod} onChange={e=>changePeriod(e.target.value as 'CURRENT'|'ALL')}><option value="CURRENT">Current snapshot only</option><option value="ALL">Current snapshot + local events</option></select></label>
 <div><span>Include decision events</span><strong>{state.governance.privacy.includeAuditInExport&&settings.reportPeriod==='ALL'?'Yes · '+report.events.length+' entries':'No (privacy/export setting)'}</strong></div><div><span>Current decision cases</span><strong>{report.decisions.length}</strong></div><div><span>Financial execution records</span><strong>Not available</strong></div></div>
 <div className="p5-help-row"><Button kind="secondary" onClick={()=>navigate('security')}>Privacy controls <ArrowRight size={13}/></Button><Button kind="secondary" onClick={()=>navigate('decisions')}>Decision Journal <ArrowRight size={13}/></Button></div>
 </Card>
 {error&&<div className="wos-error">{error}</div>}
 </div>;
}
