import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
 LayoutDashboard, TrendingUp, WalletCards, BriefcaseBusiness, Target, TriangleAlert,
 Sparkles, ChartNoAxesCombined, Landmark, BrainCircuit, NotebookText, ShieldCheck,
 Search, Bell, ChevronDown, Menu as MenuIcon, X, ArrowUpRight, ArrowRight, Check,
 LockKeyhole, ArrowLeft, Info, CircleCheck, Clock3, ShieldAlert
} from 'lucide-react';
import { menu, money, portfolio, goals, periodChanges, phaseDeliverables, series } from './data';
import type { Period, Route } from './data';
import type { Category } from './phase2/model';
import { WealthProvider, useWealth } from './phase2/context';
import { Phase2Screen } from './phase2/Screens';
import './phase2/styles.css';

const iconSet={
 dashboard:LayoutDashboard,networth:TrendingUp,capital:WalletCards,portfolio:BriefcaseBusiness,
 goals:Target,risk:TriangleAlert,opportunity:Sparkles,forecasts:ChartNoAxesCombined,
 independence:Landmark,advisor:BrainCircuit,decisions:NotebookText,governance:ShieldCheck,income:Landmark,liabilities:WalletCards
};
const dateLabel='31 Oct 2026';
const routes=menu.map(x=>x.slug);
function initialRoute():Route{
 const hash=window.location.hash.replace(/^#\/?/,'');
 return routes.includes(hash as Route)?hash as Route:'dashboard';
}
type DialogName='simulation'|'decision'|'opportunity'|'risk'|null;
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
 <div className="trend-summary"><strong>KES 12.84M</strong><span className="positive"><ArrowUpRight size={13}/>{periodChanges[period]}</span></div>
 <div className="minor">Assets less liabilities · illustrative valuations</div>
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
 <div className="chart-footer"><span><i className="dot purple"/> Net worth</span><span><i className="dot lavender"/> Historical trend</span><span className="end">+KES 1.94M <b>annual increase</b></span></div>
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
 return <Panel><PanelHead title="Goals in motion" aside="3 active goals"/>{goals.map((g,i)=><button type="button" className="goal-row" key={g.name} onClick={()=>navigate('goals')}>
 <span className={'goal-icon g'+i}>{i===0?'◎':i===1?'▤':'⌂'}</span><span className="goal-main"><b>{g.name}</b><small>{g.detail}</small><span className="track"><span style={{width:g.progress+'%',background:g.color}}/></span></span><strong>{g.progress}%</strong></button>)}</Panel>
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
return <Panel className="decision-desk"><PanelHead title="Wealth AI · Decision desk" aside={<Badge>✦ 1 INSIGHT</Badge>}/><h3>Your next KES 100K deserves a strategy, not a guess.</h3><p>Your liquidity reserve is on target, while investments remain below your planned allocation.</p><blockquote>Explore directing new capital into diversified investments — without adding to business concentration.</blockquote><div className="decision-footer"><span>Advisory demo · no execution</span><button type="button" className="secondary" onClick={open}>Review decision <ArrowUpRight size={12}/></button></div></Panel>
}
function OpportunityRadar({open}:{open:()=>void}){
return <Panel><PanelHead title="Opportunity radar" aside="2 ideas being evaluated"/><div className="opportunities">{[['Diversified investment rebalance','Improves portfolio diversification','86'],['High-interest debt reduction','Potentially reduces debt servicing pressure','81']].map(a=><button type="button" className="opportunity" key={a[0]} onClick={open}><strong>{a[0]}</strong><small>{a[1]}</small><span>Strategic fit · {a[2]}/100 <ArrowUpRight size={12}/></span></button>)}</div></Panel>
}
function RiskWatch({open}:{open:()=>void}){
 const {metrics}=useWealth();
 const businessShare=metrics.assets?metrics.groups['Business equity']/metrics.assets*100:0;
return <Panel><PanelHead title="Risk watch" aside="Monitoring · 2 signals"/><button className="risk-row" type="button" onClick={open}><span className="risk-dot amber"/><span><b>Business concentration</b><small>{businessShare.toFixed(1)}% of gross assets</small></span><Badge tone="amber">Monitor</Badge></button><button className="risk-row" type="button" onClick={open}><span className="risk-dot green"/><span><b>Liquidity reserve</b><small>Above minimum policy threshold</small></span><Badge tone="green">Healthy</Badge></button></Panel>
}
function Dashboard({navigate,onOpen}:{navigate:(r:Route)=>void,onOpen:(d:DialogName)=>void}){
 const [period,setPeriod]=useState<Period>('1Y');
 const {metrics}=useWealth();
 return <><div className="eyebrow"><span className="tiny-diamond"/> YOUR PERSONAL WEALTH INTELLIGENCE</div><div className="heading-row"><div><h1>Command Center <span>↗</span></h1><p>A clearer picture of where you stand — and your best next decision.</p></div><div className="heading-actions"><span className="sample-label">✦ Concept preview · Sample KES data</span><button type="button" className="primary" onClick={()=>onOpen('simulation')}><Sparkles size={14}/> Run a simulation</button></div></div>
 <div className="metrics-grid">
  <div className="hero surface"><div className="hero-top"><span>Total net worth</span><small>As of {dateLabel}</small></div><div className="hero-main"><strong>{money(metrics.netWorth)}</strong><Badge tone="green">Local sample</Badge></div><p>Consolidated from editable illustrative holdings</p><div className="hero-values"><span>Assets <strong>{money(metrics.assets)}</strong></span><span>Liabilities <strong>{money(metrics.liabilities)}</strong></span></div><svg className="hero-spark" viewBox="0 0 250 70" aria-hidden="true"><defs><linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#8375ff" stopOpacity=".3"/><stop offset="1" stopColor="#8375ff" stopOpacity="0"/></linearGradient></defs><path d="M0 64 L24 53 L48 55 L70 44 L94 48 L119 29 L145 32 L167 13 L192 22 L218 3 L249 0 L249 70 L0 70Z" fill="url(#sparkfill)"/><polyline points="0,64 24,53 48,55 70,44 94,48 119,29 145,32 167,13 192,22 218,3 249,0" stroke="#8b7ffd" strokeWidth="3" fill="none"/></svg></div>
  <Metric label="Deployable capital" value={money(metrics.deployable)} icon={<WalletCards size={18}/>} action={()=>navigate('capital')} foot={<><span className="green-text">● Available now</span> · after reserves and commitments<div className="metric-divider"/><div className="foot-between">Protected liquidity <b>{money(metrics.reserved+metrics.committed)}</b></div></>}/>
  <Metric label="Financial independence" value={metrics.independence.toFixed(1)+'%'} icon={<Target size={18}/>} action={()=>navigate('independence')} foot={<><div className="positive tight"><ArrowUpRight size={12}/> Illustrative target</div><div className="muted-gap">Toward your KES 37.5M independence target</div><div className="track"><span style={{width:metrics.independence+'%'}}/></div><div className="faint">{money(metrics.passiveIncome)} estimated monthly passive income</div></>}/>
 </div>
 <div className="row-two"><Trend period={period} setPeriod={setPeriod}/><Composition onRisk={()=>onOpen('risk')}/></div>
 <div className="row-three"><Goals navigate={navigate}/><Capital navigate={navigate}/><DecisionDesk open={()=>onOpen('decision')}/></div>
 <div className="row-bottom"><OpportunityRadar open={()=>onOpen('opportunity')}/><RiskWatch open={()=>onOpen('risk')}/></div>
 <footer className="dashboard-foot">Wealth OS Phase 2 · Browser-local interactive prototype · All figures and insights are illustrative. No bank, Personal Kernel or AI service is connected.</footer>
 </>
}
function FutureScreen({route,navigate}:{route:Route,navigate:(r:Route)=>void}){
 const item=menu.find(i=>i.slug===route)!;const list=phaseDeliverables[item.phase]||[];
 return <><div className="eyebrow"><span className="tiny-diamond"/> WEALTH OS / MODULE ROADMAP</div><div className="heading-row"><div><h1>{item.label}</h1><p>Designed to extend the approved Wealth OS visual language.</p></div><span className="sample-label">Phase {item.phase} · Planned module</span></div>
 <div className="future-hero surface"><div className="future-mark"><Sparkles size={25}/></div><Badge>PREVIEW ONLY</Badge><h2>{item.label} is scheduled for Phase {item.phase}</h2><p>The current release delivers the complete Command Center. This module has a real navigation destination, but its production screen and workflows are intentionally reserved for the next implementation phase.</p><div className="planned-grid">{list.map(x=><div key={x}><CircleCheck size={16}/><span>{x}</span></div>)}</div><button type="button" className="primary" onClick={()=>navigate('dashboard')}><ArrowLeft size={15}/> Return to Command Center</button></div>
 <div className="future-note"><Info size={15}/> Not a backend or live-data screen. Future module visuals will reuse the Phase 1 design tokens and components.</div>
 </>
}
function Modal({dialog,close}:{dialog:DialogName,close:()=>void}){
 const [monthly,setMonthly]=useState(50000);
 const [years,setYears]=useState(10);
 useEffect(()=>{if(!dialog)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[dialog,close]);
 const future=useMemo(()=>{const rate=.08/12;return monthly*(Math.pow(1+rate,years*12)-1)/rate},[monthly,years]);
 if(!dialog)return null;
 return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div role="dialog" aria-modal="true" aria-label={dialog==='simulation'?'Scenario simulator':'Wealth decision details'} className="modal">
 <div className="modal-top"><div><span className="eyebrow">WEALTH OS · PREVIEW</span><h2>{dialog==='simulation'?'Scenario lab · Quick simulation':dialog==='decision'?'Wealth AI · Decision explanation':dialog==='opportunity'?'Opportunity evaluation':'Risk exposure review'}</h2></div><button type="button" className="icon-btn" onClick={close} aria-label="Close"><X size={20}/></button></div>
 {dialog==='simulation'?<><p>Explore what new monthly contributions could grow to under a fixed illustrative return assumption.</p><div className="slider-label"><label htmlFor="monthly">Monthly contribution</label><b>{money(monthly,false)}</b></div><input id="monthly" type="range" min="0" max="150000" step="5000" value={monthly} onChange={e=>setMonthly(Number(e.target.value))}/><div className="slider-label"><label htmlFor="horizon">Investment horizon</label><b>{years} years</b></div><input id="horizon" type="range" min="3" max="20" step="1" value={years} onChange={e=>setYears(Number(e.target.value))}/><div className="result"><small>Illustrative future value of new contributions</small><strong>{money(future)}</strong><span>Assumes 8% nominal annual return, compounded monthly</span></div><div className="caution"><Info size={16}/> Hypothetical only. Excludes fees, taxes, inflation and losses. No financial data is connected.</div></>:
 dialog==='decision'?<><p><b>Illustrative recommendation:</b> Review a diversified allocation for the next KES 100,000 of surplus capital.</p><div className="detail-list">{['Emergency liquidity meets the sample policy minimum.','Business equity is the largest gross asset exposure (36%).','Investment diversification may reduce concentration.','Check cost, risk, liquidity and timeline before acting.'].map(x=><div key={x}><Check size={16}/>{x}</div>)}</div><div className="caution"><LockKeyhole size={16}/> Advisory demonstration only. No AI model is connected. No transfer or approval is created.</div></>:
 dialog==='opportunity'?<><p>Two opportunities are being evaluated against a sample strategy. Scores are mock decision aids, not verified investment advice.</p><div className="detail-list"><div><Sparkles size={16}/> Diversified investment rebalance · fit 86/100</div><div><Sparkles size={16}/> High-interest debt reduction · fit 81/100</div></div><div className="caution"><ShieldAlert size={16}/> No opportunity execution or external market feed is connected in Phase 1.</div></>:
 <><p>This preview uses mock exposure and liquidity figures to illustrate how the Risk Center will work.</p><div className="detail-list"><div><TriangleAlert size={16}/> Business equity · 36% of gross assets · Monitor</div><div><CircleCheck size={16}/> Sample liquidity reserve · above minimum · Healthy</div></div><div className="caution"><ShieldCheck size={16}/> Risk findings are illustrative and not linked to real accounts or active policies.</div></>}
 <div className="modal-actions"><button type="button" className="primary" onClick={close}>Close preview <ArrowRight size={15}/></button></div>
 </div></div>
}
function AppShell(){
 const {notice,notify}=useWealth();
 const [route,setRoute]=useState<Route>(initialRoute);
 const [dialog,setDialog]=useState<DialogName>(null);
 const [mobileOpen,setMobileOpen]=useState(false);
 const [search,setSearch]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [noticesOpen,setNoticesOpen]=useState(false);
 const [profileOpen,setProfileOpen]=useState(false);
 const searchRef=useRef<HTMLInputElement>(null);
 function navigate(r:Route){window.location.hash=r;setRoute(r);setMobileOpen(false);setSearchOpen(false);setSearch('');setNoticesOpen(false);setProfileOpen(false);window.scrollTo({top:0,behavior:'auto'})}
 useEffect(()=>{const change=()=>setRoute(initialRoute());window.addEventListener('hashchange',change);const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchRef.current?.focus();setSearchOpen(true)} if(e.key==='Escape'){setSearchOpen(false);setNoticesOpen(false);setProfileOpen(false);setMobileOpen(false)}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('hashchange',change);window.removeEventListener('keydown',key)}},[]);
 const results=menu.filter(x=>x.label.toLowerCase().includes(search.toLowerCase())).slice(0,8);
 const current=menu.find(x=>x.slug===route)!;
 return <div className="app">
 {mobileOpen&&<button type="button" className="mobile-backdrop" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>}
 <aside className={'sidebar '+(mobileOpen?'open':'')} aria-label="Wealth OS navigation">
 <div className="brand"><span className="brandmark">◇</span><span className="brand-text">wealth<span>os</span><small>PERSONAL KERNEL</small></span></div>
 {(['WORKSPACE','INTELLIGENCE'] as const).map(group=><div key={group}><div className="nav-title">{group}</div><nav aria-label={group.toLowerCase()}>{menu.filter(x=>x.group===group).map(item=>{const Icon=iconSet[item.icon];return <button type="button" key={item.slug} className={'nav-item '+(route===item.slug?'active':'')} onClick={()=>navigate(item.slug)} aria-current={route===item.slug?'page':undefined}><Icon size={17} strokeWidth={1.85}/><span>{item.label}</span>{item.phase>2&&<span className="nav-phase">·</span>}</button>})}</nav></div>)}
 <div className="sidebar-grow"/>
 <div className="kernel-status"><div><span className="kernel-dot"/>Kernel bridge · Planned</div><p>Frontend preview only. No cross-OS data connection is active.</p></div>
 <div className="side-account"><span className="avatar">WO</span><div><b>Personal Wealth</b><small>Sample workspace</small></div><ChevronDown size={14}/></div>
 </aside>
 <div className="page">
 <header className="topbar"><button type="button" className="mobile-trigger" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><MenuIcon size={20}/></button>
 <div className="search-shell"><Search size={16}/><input ref={searchRef} type="search" aria-label="Search Wealth OS modules" value={search} onFocus={()=>setSearchOpen(true)} onChange={e=>{setSearch(e.target.value);setSearchOpen(true)}} placeholder="Search wealth, goals, decisions..."/><span className="shortcut">⌘ K</span>{searchOpen&&<div className="search-results">{results.length?results.map(item=><button key={item.slug} type="button" onClick={()=>navigate(item.slug)}>{item.label}<span>{item.phase<=2?'Open screen':'Phase '+item.phase}</span></button>):<p>No matching Wealth OS modules</p>}</div>}</div>
 <div className="top-actions"><div className="popover-anchor"><button type="button" className="icon-btn notification" aria-label="Show notifications" aria-expanded={noticesOpen} onClick={()=>{setNoticesOpen(v=>!v);setProfileOpen(false)}}><Bell size={18}/><i/></button>{noticesOpen&&<div className="popover"><b>Preview notifications</b><p><Clock3 size={15}/> Wealth OS Phase 2 is ready to explore.</p><p><Info size={15}/> No live financial alerts are connected.</p></div>}</div><div className="top-divider"/><button type="button" className="connection" onClick={()=>navigate('governance')}><i/> Preview mode <ChevronDown size={13}/></button><div className="popover-anchor"><button type="button" className="avatar top-avatar" aria-label="Open workspace menu" onClick={()=>{setProfileOpen(v=>!v);setNoticesOpen(false)}}>WO</button>{profileOpen&&<div className="popover account-popover"><b>Personal Wealth</b><p>Sample workspace · no sign-in</p><button type="button" onClick={()=>navigate('governance')}>View governance roadmap <ArrowRight size={13}/></button></div>}</div></div>
 </header>
 <main className="content" onClick={()=>{if(searchOpen)setSearchOpen(false)}}>{route==='dashboard'?<Dashboard navigate={navigate} onOpen={setDialog}/>:['net-worth','capital','portfolio','income','liabilities'].includes(route)?<Phase2Screen route={route as 'net-worth'|'capital'|'portfolio'|'income'|'liabilities'}/>:<FutureScreen route={current.slug} navigate={navigate}/>}</main>
 </div><Modal dialog={dialog} close={()=>setDialog(null)}/>
 {notice&&<div className="wos-toast" role="status"><Check size={16}/>{notice}<button className="wos-toast-close" aria-label="Dismiss notice" type="button" onClick={()=>notify('')}><X size={15}/></button></div>}
 </div>
}
export default function App(){return <WealthProvider><AppShell/></WealthProvider>}
