import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
 LayoutDashboard, TrendingUp, WalletCards, BriefcaseBusiness, Target, TriangleAlert,
 Sparkles, ChartNoAxesCombined, Landmark, BrainCircuit, NotebookText, ShieldCheck,
 Search, Bell, ChevronDown, Menu as MenuIcon, X, ArrowUpRight, ArrowRight, Check,
 LockKeyhole, ArrowLeft, Info, CircleCheck, Clock3
} from 'lucide-react';
import { menu, money, portfolio, phaseDeliverables, series } from './data';
import type { Period, Route } from './data';
import type { Category } from './phase2/model';
import { WealthProvider, useWealth } from './phase2/context';
import { Phase2Screen } from './phase2/Screens';
import './phase2/styles.css';
import { GoalsScreen } from './phase3/Goals';
import { StrategiesScreen } from './phase3/Strategies';
import { IndependenceScreen } from './phase3/Independence';
import { PerformanceScreen } from './phase3/Performance';
import { goalProgress, independenceMetrics } from './phase3/model';
import './phase3/styles.css';
import {RiskScreen} from './phase4/Risk';
import {OpportunitiesScreen} from './phase4/Opportunities';
import {ForecastScreen} from './phase4/Forecast';
import {ScenarioScreen} from './phase4/Scenarios';
import {AdvisorScreen} from './phase4/Advisor';
import {evaluateRisks,assessOpportunity} from './phase4/model';
import './phase4/styles.css';
import {DecisionsScreen} from './phase5/Decisions';
import {GovernanceScreen} from './phase5/Governance';
import {SecurityScreen} from './phase5/Security';
import {ReportsScreen} from './phase5/Reports';
import {IntegrationsScreen} from './phase5/Integrations';
import {SettingsScreen} from './phase5/Settings';
import './phase5/styles.css';
import './phase6/styles.css';
import {ConnectedWorkspace} from './connected/ConnectedWorkspace';
import './connected/styles.css';

const iconSet={
 dashboard:LayoutDashboard,networth:TrendingUp,capital:WalletCards,portfolio:BriefcaseBusiness,
 goals:Target,risk:TriangleAlert,opportunity:Sparkles,forecasts:ChartNoAxesCombined,
 independence:Landmark,advisor:BrainCircuit,decisions:NotebookText,governance:ShieldCheck,income:Landmark,liabilities:WalletCards,strategies:BriefcaseBusiness,performance:ChartNoAxesCombined,scenarios:Sparkles,security:LockKeyhole,reports:NotebookText,integrations:BriefcaseBusiness,settings:ChartNoAxesCombined,connected:ShieldCheck
};
const dateLabel='31 Oct 2026 · fictional sample';
const routes=menu.map(x=>x.slug);
function initialRoute():Route{
 const hash=window.location.hash.replace(/^#\/?/,'');
 return routes.includes(hash as Route)?hash as Route:'dashboard';
}
function Badge({children,tone='purple'}:{children:ReactNode,tone?:'purple'|'green'|'amber'}){return <span className={'badge '+tone}>{children}</span>}
function Metric({label,value,foot,icon,variant,action}:{label:string,value:string,foot:ReactNode,icon:ReactNode,variant?:string,action?:()=>void}){
return <button type="button" onClick={action} disabled={!action} className={'metric surface '+(variant||'')}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong className="metric-value">{value}</strong><div className="metric-foot">{foot}</div></button>
}
function Panel({children,className=''}:{children:ReactNode,className?:string}){return <section className={'surface panel '+className}>{children}</section>}
function PanelHead({title,aside}:{title:string,aside?:ReactNode}){return <div className="panel-heading"><h2>{title}</h2><div className="panel-meta">{aside}</div></div>}

function Trend({period,setPeriod}:{period:Period,setPeriod:(p:Period)=>void}){
 const {metrics}=useWealth();
 const chart=useMemo(()=>series[period].map((value,i)=>({index:i,value:i===series[period].length-1?metrics.netWorth/1e6:value})),[period,metrics.netWorth]);
 const labels=period==='ALL'?['2021','2022','2023','2024','2025','2026']:period==='1Y'?['Nov','Jan','Mar','May','Jul','Sep','Oct']:period==='6M'?['May','Jun','Jul','Aug','Sep','Oct']:['01 Oct','06 Oct','11 Oct','16 Oct','21 Oct','26 Oct','31 Oct'];
 return <Panel className="trend-panel">
 <PanelHead title="Wealth trajectory" aside={<div className="tabs" role="group" aria-label="Wealth trajectory period">{(['1M','6M','1Y','ALL'] as Period[]).map(p=><button type="button" key={p} aria-pressed={period===p} className={period===p?'selected':''} onClick={()=>setPeriod(p)}>{p==='ALL'?'All':p}</button>)}</div>}/>
 <div className="trend-summary"><strong>{money(metrics.netWorth)}</strong><span className="positive">Sample trajectory · not real history</span></div>
 <div className="minor">Assets less liabilities · curve is hypothetical, latest point reflects current local state</div>
 <div className="chart-wrap" aria-label={'Sample wealth trend in millions of Kenyan shillings, '+period}>
 <ResponsiveContainer width="100%" height={214}>
  <AreaChart data={chart} margin={{top:15,right:7,left:-15,bottom:0}}>
   <defs><linearGradient id="wealthGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7766ec" stopOpacity={0.23}/><stop offset="95%" stopColor="#7766ec" stopOpacity={0.015}/></linearGradient></defs>
   <CartesianGrid vertical={false} stroke="#e9edf5" strokeDasharray="3 5"/>
   <XAxis dataKey="index" axisLine={false} tickLine={false} tick={{fill:'#9ca8bb',fontSize:10}} ticks={[0,2,4,6,8,10,11]} tickFormatter={(v:number)=>labels[Math.min(Math.floor(v/2),labels.length-1)]??''}/>
   <YAxis domain={[period==='ALL'?0:8,Math.max(14,Math.ceil(metrics.netWorth/1e6*1.1))]} axisLine={false} tickLine={false} tick={{fill:'#9ca8bb',fontSize:10}} tickFormatter={(n:number)=>n+'M'} width={43}/>
   <Tooltip contentStyle={{border:'1px solid #e6e9f2',borderRadius:10,fontSize:12}} formatter={(v)=>[money(Number(v)*1000000),'Net worth']} labelFormatter={(i)=>'Period '+(Number(i)+1)} />
   <Area type="monotone" dataKey="value" stroke="#7061ef" strokeWidth={2.8} fill="url(#wealthGradient)" activeDot={{r:5,fill:'#6655ea'}} dot={false}/>
  </AreaChart>
 </ResponsiveContainer>
 </div>
 <div className="chart-footer"><span><i className="dot purple"/> Net worth</span><span><i className="dot lavender"/> Historical trend</span><span className="end">Illustrative trend <b>not verified performance</b></span></div>
 </Panel>
}
function Composition({onRisk}:{onRisk:()=>void}){
 const {metrics}=useWealth();
 const [selected,setSelected]=useState('Business equity');
 const portions=portfolio.map(p=>({...p,share:metrics.assets>0?metrics.groups[p.name as Category]/metrics.assets*100:0}));
 const current=portions.find(i=>i.name===selected)!;
 const stops=portions.reduce<{parts:string[],sum:number}>((acc,item)=>{const start=acc.sum;acc.sum+=item.share;acc.parts.push(item.color+' '+start.toFixed(4)+'% '+acc.sum.toFixed(4)+'%');return acc},{parts:[],sum:0});
 return <Panel className="composition-panel"><PanelHead title="Wealth composition" aside="From local sample state"/>
 <div className="composition-layout"><div className="donut" style={{background:'conic-gradient('+stops.parts.join(',')+')'}} role="img" aria-label="Illustrative assets composition by category"><div className="donut-inner"><strong>{money(metrics.assets)}</strong><span>Gross assets</span></div></div><div className="composition-legend">{portions.map(p=><button type="button" key={p.name} className={'legend-entry '+(selected===p.name?'on':'')} onClick={()=>setSelected(p.name)} aria-pressed={selected===p.name}><i style={{background:p.color}}/><span>{p.name}</span><strong>{p.share.toFixed(1)}%</strong></button>)}</div></div>
 <div className="panel-bottom"><span>Selected exposure: <b>{current.name} · {current.share.toFixed(1)}%</b></span><button className="text-button" type="button" onClick={onRisk}>Review exposure <ArrowUpRight size={12}/></button></div></Panel>
}
function Goals({navigate}:{navigate:(r:Route)=>void}){
 const {state,metrics}=useWealth();
 const visible=state.planning.goals.filter(g=>g.status==='ACTIVE').slice(0,3);
 return <Panel><PanelHead title="Goals in motion" aside={visible.length+' active goals'}/>
 {visible.map((g,i)=>{const progress=goalProgress(g,state,metrics);return <button type="button" className="goal-row" key={g.id} onClick={()=>navigate('goals')}>
 <span className={'goal-icon g'+(i%3)}>{i===0?'◎':i===1?'▤':'⌂'}</span><span className="goal-main"><b>{g.title}</b><small>{g.deadline} · measured from sample wealth</small><span className="track"><span style={{width:progress.percent+'%',background:['#7b6ef4','#47b79a','#dea958'][i%3]}}/></span></span><strong>{progress.percent.toFixed(1)}%</strong></button>})}
 {!visible.length&&<p className="minor">No active goals. Open Goals & Milestones to create one.</p>}
 </Panel>
}

function Capital({navigate}:{navigate:(r:Route)=>void}){
 const {metrics,state}=useWealth();
 const featured=[
  {label:'Emergency reserve',id:'c-emergency',value:state.pools.find(p=>p.id==='c-emergency')?.balance??0,dot:'purple'},
  {label:'Goal capital',id:'c-goals',value:state.pools.find(p=>p.id==='c-goals')?.balance??0,dot:'mint'},
  {label:'Committed',id:'committed',value:metrics.committed,dot:'gold'},
  {label:'Deployable',id:'deployable',value:metrics.deployable,dot:'gray'}
 ];
 return <Panel><PanelHead title="Capital intelligence" aside="Deployment readiness"/><div className="capital-total"><span>Total strategic liquidity</span><b>{money(metrics.pooled)}</b></div><div className="segment-bar"><i/><i/><i/><i/></div><div className="capital-grid">{featured.map(x=><div key={x.id}><i className={'dot '+x.dot}/>{x.label}<strong>{money(x.value)}</strong></div>)}</div><div className="panel-bottom"><span>Existing cash classified, not added twice</span><button className="healthy" type="button" onClick={()=>navigate('capital')}><Check size={12}/> Open capital</button></div></Panel>
}

function DecisionDesk({open}:{open:()=>void}){
 const {state,metrics}=useWealth();
 const report=evaluateRisks(state);
 return <Panel className="decision-desk"><PanelHead title="Decision desk · sample rules" aside={<Badge>✦ INSIGHT</Badge>}/>
 <h3>Assess risk and liquidity before committing your next allocation.</h3>
 <p>Your sample has {report.watch+report.high} active exposure signals and {money(metrics.deployable)} uncommitted capital.</p>
 <blockquote>Explore a diversified plan only after you review liquidity, valuation freshness and goal priorities.</blockquote>
 <div className="decision-footer"><span>Offline explanation · no live AI</span><button type="button" className="secondary" onClick={open}>Review evidence <ArrowUpRight size={12}/></button></div></Panel>
}
function OpportunityRadar({open}:{open:()=>void}){
 const {state}=useWealth();
 const featured=state.intelligence.opportunities.filter(o=>o.status!=='REJECTED').slice(0,2);
 return <Panel><PanelHead title="Opportunity radar" aside={featured.length+' research ideas'}/><div className="opportunities">{featured.map(o=>{const e=assessOpportunity(state,o);return <button type="button" className="opportunity" key={o.id} onClick={open}><strong>{o.title}</strong><small>{e.eligible?'Eligible for sample comparison':'Requires more uncommitted capital or reserve coverage'}</small><span>Fit · {e.score}/100 · {e.eligible?'eligible':'blocked'} <ArrowUpRight size={12}/></span></button>})}</div>{!featured.length&&<p className="minor">No current ideas. Open the Opportunity Lab to add one.</p>}</Panel>
}
function RiskWatch({open}:{open:()=>void}){
 const {state}=useWealth();
 const report=evaluateRisks(state);
 const featured=[...report.signals].sort((a,b)=>({HIGH:2,WATCH:1,OK:0}[b.severity]-{HIGH:2,WATCH:1,OK:0}[a.severity])).slice(0,2);
 return <Panel><PanelHead title="Risk watch" aside={report.high+' high · '+report.watch+' watch'}/>{featured.map(s=><button className="risk-row" type="button" key={s.id} onClick={open}><span className={'risk-dot '+(s.severity==='OK'?'green':'amber')}/><span><b>{s.title}</b><small>{s.observed}</small></span><Badge tone={s.severity==='OK'?'green':'amber'}>{s.severity==='OK'?'Healthy':s.severity==='HIGH'?'High':'Monitor'}</Badge></button>)}</Panel>
}

function Dashboard({navigate}:{navigate:(r:Route)=>void}){
 const [period,setPeriod]=useState<Period>('1Y');
 const {metrics,state}=useWealth();
 const independence=independenceMetrics(state,metrics);
 return <><div className="eyebrow"><span className="tiny-diamond"/> YOUR PERSONAL WEALTH INTELLIGENCE</div><div className="heading-row"><div><h1>Command Center <span>↗</span></h1><p>A clearer picture of where you stand — and your best next decision.</p></div><div className="heading-actions"><span className="sample-label">✦ Concept preview · Sample KES data</span><button type="button" className="primary" onClick={()=>navigate('scenarios')}><Sparkles size={14}/> Run a simulation</button></div></div>
 <div className="metrics-grid">
  <div className="hero surface"><div className="hero-top"><span>Total net worth</span><small>As of {dateLabel}</small></div><div className="hero-main"><strong>{money(metrics.netWorth)}</strong><Badge tone="green">Local sample</Badge></div><p>Consolidated from editable illustrative holdings</p><div className="hero-values"><span>Assets <strong>{money(metrics.assets)}</strong></span><span>Liabilities <strong>{money(metrics.liabilities)}</strong></span></div><svg className="hero-spark" viewBox="0 0 250 70" aria-hidden="true"><defs><linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#8375ff" stopOpacity=".3"/><stop offset="1" stopColor="#8375ff" stopOpacity="0"/></linearGradient></defs><path d="M0 64 L24 53 L48 55 L70 44 L94 48 L119 29 L145 32 L167 13 L192 22 L218 3 L249 0 L249 70 L0 70Z" fill="url(#sparkfill)"/><polyline points="0,64 24,53 48,55 70,44 94,48 119,29 145,32 167,13 192,22 218,3 249,0" stroke="#8b7ffd" strokeWidth="3" fill="none"/></svg></div>
  <Metric label="Deployable capital" value={money(metrics.deployable)} icon={<WalletCards size={18}/>} action={()=>navigate('capital')} foot={<><span className="green-text">● Available now</span> · after reserves and commitments<div className="metric-divider"/><div className="foot-between">Protected liquidity <b>{money(metrics.reserved+metrics.committed)}</b></div></>}/>
  <Metric label="Financial independence" value={metrics.independence.toFixed(1)+'%'} icon={<Target size={18}/>} action={()=>navigate('independence')} foot={<><div className="positive tight"><ArrowUpRight size={12}/> Illustrative target</div><div className="muted-gap">Toward your {money(independence.capitalRequired)} independence target</div><div className="track"><span style={{width:metrics.independence+'%'}}/></div><div className="faint">{money(metrics.passiveIncome)} estimated monthly passive income</div></>}/>
 </div>
 <div className="row-two"><Trend period={period} setPeriod={setPeriod}/><Composition onRisk={()=>navigate('risk')}/></div>
 <div className="row-three"><Goals navigate={navigate}/><Capital navigate={navigate}/><DecisionDesk open={()=>navigate('decisions')}/></div>
 <div className="row-bottom"><OpportunityRadar open={()=>navigate('opportunities')}/><RiskWatch open={()=>navigate('risk')}/></div>
 <footer className="dashboard-foot">Wealth OS v0.6 · Frontend release candidate · Sample financial data only · All figures and insights are illustrative. No bank, Personal Kernel or AI service is connected.</footer>
 </>
}
function FutureScreen({route,navigate}:{route:Route,navigate:(r:Route)=>void}){
 const item=menu.find(i=>i.slug===route)!;const list=phaseDeliverables[item.phase]||[];
 return <><div className="eyebrow"><span className="tiny-diamond"/> WEALTH OS / MODULE ROADMAP</div><div className="heading-row"><div><h1>{item.label}</h1><p>Designed to extend the approved Wealth OS visual language.</p></div><span className="sample-label">Phase {item.phase} · Planned module</span></div>
 <div className="future-hero surface"><div className="future-mark"><Sparkles size={25}/></div><Badge>PREVIEW ONLY</Badge><h2>{item.label} is scheduled for Phase {item.phase}</h2><p>The current release delivers the complete Command Center. This module has a real navigation destination, but its production screen and workflows are intentionally reserved for the next implementation phase.</p><div className="planned-grid">{list.map(x=><div key={x}><CircleCheck size={16}/><span>{x}</span></div>)}</div><button type="button" className="primary" onClick={()=>navigate('dashboard')}><ArrowLeft size={15}/> Return to Command Center</button></div>
 <div className="future-note"><Info size={15}/> Not a backend or live-data screen. Future module visuals will reuse the Phase 1 design tokens and components.</div>
 </>
}
function AppShell(){
 const {notice,notify,state}=useWealth();
 const [route,setRoute]=useState<Route>(()=>{
  const params=new URLSearchParams(window.location.search);
  if(params.has('code')||params.has('error'))return 'connected';
  return window.location.hash?initialRoute():state.governance.settings.defaultScreen;
 });
 const [mobileOpen,setMobileOpen]=useState(false);
 const [search,setSearch]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [noticesOpen,setNoticesOpen]=useState(false);
 const [profileOpen,setProfileOpen]=useState(false);
 const searchRef=useRef<HTMLInputElement>(null);
 function navigate(r:Route){window.location.hash=r;setRoute(r);setMobileOpen(false);setSearchOpen(false);setSearch('');setNoticesOpen(false);setProfileOpen(false);window.scrollTo({top:0,behavior:'auto'});window.requestAnimationFrame(()=>document.getElementById('main-content')?.focus())}
 useEffect(()=>{const change=()=>setRoute(window.location.hash?initialRoute():state.governance.settings.defaultScreen);window.addEventListener('hashchange',change);const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchRef.current?.focus();setSearchOpen(true)} if(e.key==='Escape'){setSearchOpen(false);setNoticesOpen(false);setProfileOpen(false);setMobileOpen(false)}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('hashchange',change);window.removeEventListener('keydown',key)}},[state.governance.settings.defaultScreen]);
 const results=menu.filter(x=>x.label.toLowerCase().includes(search.toLowerCase())).slice(0,8);
 const current=menu.find(x=>x.slug===route)!;
 useEffect(()=>{document.title=current.label+' · Wealth OS (sample)'},[current.label]);
 return <div className="app"><a className="p6-skip" href="#main-content">Skip to main content</a>
 {mobileOpen&&<button type="button" className="mobile-backdrop" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>}
 <aside id="wealth-navigation" className={'sidebar '+(mobileOpen?'open':'')} aria-label="Wealth OS navigation">
 <div className="brand"><span className="brandmark">◇</span><span className="brand-text">wealth<span>os</span><small>PERSONAL KERNEL</small></span></div>
 {(['WORKSPACE','INTELLIGENCE'] as const).map(group=><div key={group}><div className="nav-title">{group}</div><nav aria-label={group.toLowerCase()}>{menu.filter(x=>x.group===group).map(item=>{const Icon=iconSet[item.icon];return <button type="button" key={item.slug} className={'nav-item '+(route===item.slug?'active':'')} onClick={()=>navigate(item.slug)} aria-current={route===item.slug?'page':undefined}><Icon size={17} strokeWidth={1.85}/><span>{item.label}</span>{item.phase>5&&<span className="nav-phase">·</span>}</button>})}</nav></div>)}
 <div className="sidebar-grow"/>
 <div className="kernel-status"><div><span className="kernel-dot"/>Kernel bridge · Planned</div><p>Demo workspaces remain local. Authenticated backend workspace requires real OIDC setup.</p></div>
 <div className="side-account"><span className="avatar">WO</span><div><b>Personal Wealth</b><small>Sample workspace</small></div><ChevronDown size={14}/></div>
 </aside>
 <div className="page">
 <header className="topbar"><button type="button" className="mobile-trigger" onClick={()=>setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="wealth-navigation"><MenuIcon size={20}/></button>
 <div className="search-shell"><Search size={16}/><input ref={searchRef} type="search" aria-label="Search Wealth OS modules" value={search} onFocus={()=>setSearchOpen(true)} onChange={e=>{setSearch(e.target.value);setSearchOpen(true)}} placeholder="Search wealth, goals, decisions..."/><span className="shortcut">⌘ K</span>{searchOpen&&<div className="search-results">{results.length?results.map(item=><button key={item.slug} type="button" onClick={()=>navigate(item.slug)}>{item.label}<span>{item.phase<=5?'Open screen':'Phase '+item.phase}</span></button>):<p>No matching Wealth OS modules</p>}</div>}</div>
 <div className="top-actions"><div className="popover-anchor"><button type="button" className="icon-btn notification" aria-label="Show notifications" aria-expanded={noticesOpen} onClick={()=>{setNoticesOpen(v=>!v);setProfileOpen(false)}}><Bell size={18}/><i/></button>{noticesOpen&&<div className="popover"><b>Preview notifications</b><p><Clock3 size={15}/> Wealth OS v0.6 frontend release candidate is ready to explore.</p><p><Info size={15}/> No live financial alerts are connected.</p></div>}</div><div className="top-divider"/><button type="button" className="connection" onClick={()=>navigate('governance')}><i/> Preview mode <ChevronDown size={13}/></button><div className="popover-anchor"><button type="button" className="avatar top-avatar" aria-label="Open local demo workspace menu" onClick={()=>{setProfileOpen(v=>!v);setNoticesOpen(false)}}>WO</button>{profileOpen&&<div className="popover account-popover"><b>Personal Wealth</b><p>Sample workspace · no sign-in</p><button type="button" onClick={()=>navigate('governance')}>View governance roadmap <ArrowRight size={13}/></button></div>}</div></div>
 </header>
 <main id="main-content" tabIndex={-1} aria-label={current.label} className="content" onClick={()=>{if(searchOpen)setSearchOpen(false)}}>{route==='dashboard'?<Dashboard navigate={navigate}/>:['net-worth','capital','portfolio','income','liabilities'].includes(route)?<Phase2Screen route={route as 'net-worth'|'capital'|'portfolio'|'income'|'liabilities'}/>:route==='goals'?<GoalsScreen navigate={navigate}/>:route==='strategies'?<StrategiesScreen navigate={navigate}/>:route==='independence'?<IndependenceScreen navigate={navigate}/>:route==='performance'?<PerformanceScreen navigate={navigate}/>:route==='risk'?<RiskScreen navigate={navigate}/>:route==='opportunities'?<OpportunitiesScreen navigate={navigate}/>:route==='forecasts'?<ForecastScreen navigate={navigate}/>:route==='scenarios'?<ScenarioScreen navigate={navigate}/>:route==='advisor'?<AdvisorScreen navigate={navigate}/>:route==='decisions'?<DecisionsScreen navigate={navigate}/>:route==='governance'?<GovernanceScreen navigate={navigate}/>:route==='security'?<SecurityScreen navigate={navigate}/>:route==='reports'?<ReportsScreen navigate={navigate}/>:route==='integrations'?<IntegrationsScreen navigate={navigate}/>:route==='settings'?<SettingsScreen navigate={navigate}/>:route==='connected'?<ConnectedWorkspace/>:<FutureScreen route={current.slug} navigate={navigate}/>}</main>
 </div>
 {notice&&<div className="wos-toast" role="status"><Check size={16}/>{notice}<button className="wos-toast-close" aria-label="Dismiss notice" type="button" onClick={()=>notify('')}><X size={15}/></button></div>}
 </div>
}
export default function App(){return <WealthProvider><AppShell/></WealthProvider>}
