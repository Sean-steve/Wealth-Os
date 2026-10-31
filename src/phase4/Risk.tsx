import {useMemo,useState} from 'react';
import {Activity,AlertTriangle,CheckCircle2,ChevronRight,Database,Eye,ShieldAlert,ShieldCheck,TrendingUp} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {evaluateRisks,riskPolicies} from './model';
import type {Severity} from './model';
import {Header,Button,Card,Stat,Alert,Sample,Badge} from '../phase3/ui';

const tone:Record<Severity,'gold'|'teal'|'violet'>={OK:'teal',WATCH:'gold',HIGH:'violet'};
const levels:{name:string,value:Severity| 'ALL'}[]=[{name:'All signals',value:'ALL'},{name:'High priority',value:'HIGH'},{name:'Needs review',value:'WATCH'},{name:'Within policy',value:'OK'}];
const jump:Record<string,'portfolio'|'income'|'liabilities'|'capital'>={concentration:'portfolio',income:'income','debt-service':'liabilities',leverage:'liabilities',reserve:'capital',valuation:'portfolio'};
export function RiskScreen({navigate}:{navigate:(r:'portfolio'|'income'|'liabilities'|'capital')=>void}){
 const {state,metrics}=useWealth();
 const report=useMemo(()=>evaluateRisks(state),[state]);
 const [filter,setFilter]=useState<Severity|'ALL'>('ALL');
 const [selected,setSelected]=useState<string>('concentration');
 const signals=report.signals.filter(s=>filter==='ALL'||s.severity===filter);
 const detail=report.signals.find(s=>s.id===selected)??report.signals[0];
 const businessShare=metrics.assets?metrics.groups['Business equity']/metrics.assets*100:0;
 return <div className="wos-screen">
 <Header title="Risk Center" description="See your financial vulnerabilities before they become decisions. Each signal is traceable to an illustrative metric and a transparent threshold." actions={<Button kind="secondary" onClick={()=>navigate('portfolio')}><Eye size={15}/> Portfolio evidence</Button>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="Sample exposure index" value={report.score+'/100'} hint="100 − 12 per watch − 25 per high; not a probability" icon={<Activity size={18}/>} tone="violet"/>
 <Stat title="High signals" value={String(report.high)} hint="Above critical demonstration threshold" icon={<ShieldAlert size={18}/>} tone="gold"/>
 <Stat title="Watch signals" value={String(report.watch)} hint="Require further investigation" icon={<AlertTriangle size={18}/>} tone="blue"/>
 <Stat title="Within thresholds" value={String(report.healthy)} hint={'Of '+report.signals.length+' monitored metrics'} icon={<ShieldCheck size={18}/>} tone="teal"/>
 </div>
 <Alert>Thresholds are editable-in-code demonstration policies, not Personal Kernel governance, a regulated risk rating, or a basis for automatic financial execution. Real-world source freshness and ownership checks are not connected.</Alert>
 <div className="p4-risk-layout">
 <Card title="Exposure signals" subtitle={report.headline} side={<select className="p4-select compact" aria-label="Risk severity filter" value={filter} onChange={e=>setFilter(e.target.value as Severity|'ALL')}>{levels.map(x=><option key={x.value} value={x.value}>{x.name}</option>)}</select>}>
  <div className="p4-risk-list">{signals.map(s=><button type="button" className={'p4-risk-item '+(selected===s.id?'selected':'')} key={s.id} onClick={()=>setSelected(s.id)}><div className="p4-risk-symbol">{s.severity==='OK'?<CheckCircle2 size={18}/>:<AlertTriangle size={18}/>}</div><div className="p4-risk-item-body"><b>{s.title}</b><small>{s.observed}</small><span>{s.category}</span></div><Badge tone={tone[s.severity]}>{s.severity==='OK'?'Healthy':s.severity==='WATCH'?'Watch':'High'}</Badge></button>)}
  {!signals.length&&<p className="p3-empty">No matching risks for this filter.</p>}</div>
 </Card>
 <Card title={detail.title} subtitle={'Current signal · '+detail.category} side={<Badge tone={tone[detail.severity]}>{detail.severity}</Badge>}>
  <div className="p4-risk-detail-hero"><span>Observed sample value</span><strong>{detail.observed}</strong><small>{detail.threshold}</small></div>
  <h3 className="p4-subhead">Why this matters</h3><p className="p4-body">{detail.explanation}</p>
  <h3 className="p4-subhead">Suggested review</h3><p className="p4-body">{detail.nextStep}</p>
  <div className="p4-evidence-box"><Database size={16}/><div><b>Deterministic evidence only</b><span>Data: local Wealth OS holdings, pools, income, debt and dated valuations. No provider verification.</span></div></div>
  <Button kind="secondary" onClick={()=>navigate(jump[detail.id])}>Open supporting workspace <ChevronRight size={14}/></Button>
 </Card></div>
 <div className="wos-grid halves">
 <Card title="Liquidity & obligations" subtitle="Protected cash and debt exposure from the existing workspace">
 <div className="p4-kv"><span>Deployable capital</span><b>{metrics.deployable.toLocaleString('en-KE')} KES</b></div><div className="p4-kv"><span>Protected reserves</span><b>{metrics.reserved.toLocaleString('en-KE')} KES</b></div><div className="p4-kv"><span>Monthly debt servicing</span><b>{metrics.monthlyDebt.toLocaleString('en-KE')} KES</b></div><div className="p4-kv"><span>Debt / income</span><b>{(metrics.debtToIncome*100).toFixed(1)}%</b></div>
 </Card>
 <Card title="Model thresholds" subtitle="Demonstration values — not verified personal policies">
 <div className="p4-kv"><span>Business concentration</span><b>Watch {riskPolicies.businessWatch}% / High {riskPolicies.businessHigh}%</b></div><div className="p4-kv"><span>Debt servicing</span><b>Watch {riskPolicies.debtServiceWatch}% / High {riskPolicies.debtServiceHigh}%</b></div><div className="p4-kv"><span>Emergency reserve</span><b>{riskPolicies.reserveMonths} months</b></div><div className="p4-kv"><span>Oldest valuation refresh</span><b>{riskPolicies.valuationStaleDays} days</b></div>
 </Card></div>
 <div className="p4-disclaimer"><TrendingUp size={15}/> Example business exposure currently {businessShare.toFixed(1)}% of gross assets. Scores are not calibrated financial-loss probabilities.</div>
 </div>
}
