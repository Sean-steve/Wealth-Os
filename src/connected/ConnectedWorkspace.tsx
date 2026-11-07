import {useEffect,useMemo,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowRight,CheckCircle2,CloudOff,Database,ExternalLink,FileLock2,KeyRound,Link2,LockKeyhole,Plus,RefreshCcw,ShieldAlert,ShieldCheck,WalletCards} from 'lucide-react';
import {apiRequest,completeLogin,isUuid,makeLoginUrl,readConnectionConfig,scrubAuthQuery} from './api';
import type {ConnectionConfig,Session} from './api';
import {Alert,Badge,Button,Card,ErrorNote,Field,Stat} from '../phase3/ui';
type Read<T>={data:T};
type SourceStatus={sourceSystem:string;consented:boolean;authorizedProducerBound:boolean;
 status:string;sourceAsOf:string|null;sourceRevision:string|null};
const mappedRoutes:Record<string,Tab>={
 connected:'overview',dashboard:'overview','net-worth':'overview',goals:'goals',
 strategies:'strategies',capital:'capital',portfolio:'portfolio',income:'income',
 liabilities:'liabilities'
};
type Goal={id:string;title:string;metric:string;targetAmount:string;targetDate:string;priority:string;status:string;version:string};
type Milestone={id:string;goalId:string;title:string;targetAmount:string;dueDate:string;status:string;version:string};
type Strategy={id:string;goalId:string;name:string;thesis:string;latestVersion:number;activeVersion:number|null;status:string;
 allocationTargets:{label:string;basisPoints:number}[];assumptions:{riskTolerance:string;horizonYears:number;assumedAnnualReturnPct:number}};
type Pool={id:string;name:string;purpose:string;classifiedCash:string;reservedCash:string;committedCash:string;uncommittedCash:string;freshSource:boolean;version:string;sourceAsOf:string|null};
type Proposal={id:string;poolId:string;target:string;amount:string;status:string;version:string;policyVersion:number};
type Holding={id:string;category:string;sourceSystem:string;sourceEntityId:string;ownerFraction:string;valuationAmount:string|null;valuationCurrency:string|null;qualityStatus:string;valuationAsOf:string|null};
type Income={id:string;sourceSystem:string;monthlyAmount:string;currency:string;passive:boolean;sourceAsOf:string};
type Debt={id:string;sourceSystem:string;outstandingAmount:string;currency:string;sourceAsOf:string};
type State={status:string;currency:string;netWorth:string|null;grossAssets:string|null;liabilities:string|null;blockers:string[];financialExecutionEnabled:false;sourceWatermarks:unknown[];holdingCount:number};
type Profile={baseCurrency:string;wealthStage:string;strategyNote:string;version:string};
type Snapshot={profile:Profile|null;goals:Goal[];strategies:Strategy[];pools:Pool[];proposals:Proposal[];holdings:Holding[];incomes:Income[];debts:Debt[];state:State;sources:SourceStatus[]};
type Tab='overview'|'goals'|'strategies'|'capital'|'portfolio'|'income'|'liabilities';
const tabs:{id:Tab;title:string}[]=[
 {id:'overview',title:'Overview'},{id:'goals',title:'Goals & milestones'},{id:'strategies',title:'Strategies'},
 {id:'capital',title:'Capital proposals'},{id:'portfolio',title:'Portfolio sources'},
 {id:'income',title:'Income'},{id:'liabilities',title:'Liabilities'}
];
const money=(n:string|null|undefined)=>n===null||n===undefined?'Not verified':'KES '+Number(n).toLocaleString('en-KE',{maximumFractionDigits:2});
const date=(s:string)=>s.slice(0,10);
const freshKey=()=>crypto.randomUUID();
const configFromBuild=():ConnectionConfig|null=>readConnectionConfig({
 VITE_WEALTH_API_URL:import.meta.env.VITE_WEALTH_API_URL,
 VITE_WEALTH_OIDC_AUTHORIZE_URL:import.meta.env.VITE_WEALTH_OIDC_AUTHORIZE_URL,
 VITE_WEALTH_OIDC_TOKEN_URL:import.meta.env.VITE_WEALTH_OIDC_TOKEN_URL,
 VITE_WEALTH_OIDC_CLIENT_ID:import.meta.env.VITE_WEALTH_OIDC_CLIENT_ID
});
export function ConnectedWorkspace({route='connected'}:{route?:string}){
 const [configResult]=useState<{config:ConnectionConfig|null;error:string}>(()=>{
  try{return {config:configFromBuild(),error:''}}catch(e){return {config:null,error:e instanceof Error?e.message:'Invalid OIDC connection setup.'}}
 });
 const config=configResult.config;
 const [session,setSession]=useState<Session|null>(null);
 const [tenantId,setTenantId]=useState('');
 const [tab,setTab]=useState<Tab>(mappedRoutes[route]??'overview');
 useEffect(()=>{if(mappedRoutes[route])setTab(mappedRoutes[route])},[route]);
 const [records,setRecords]=useState<Snapshot|null>(null);
 const [milestones,setMilestones]=useState<Milestone[]>([]);
 const [milestoneGoal,setMilestoneGoal]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [working,setWorking]=useState(false),[loading,setLoading]=useState(false);
 const processed=useRef(false);
 const [goalTitle,setGoalTitle]=useState(''),[goalTarget,setGoalTarget]=useState('1000000'),[goalDate,setGoalDate]=useState('2031-12-31'),[goalMetric,setGoalMetric]=useState('NET_WORTH');
 const [milestoneTitle,setMilestoneTitle]=useState(''),[milestoneAmount,setMilestoneAmount]=useState('500000'),[milestoneDate,setMilestoneDate]=useState('2030-12-31');
 const [strategyGoal,setStrategyGoal]=useState(''),[strategyName,setStrategyName]=useState(''),[strategyThesis,setStrategyThesis]=useState(''),[strategyAllocation,setStrategyAllocation]=useState('Diversified investments');
 const [poolId,setPoolId]=useState(''),[proposalTarget,setProposalTarget]=useState(''),[proposalAmount,setProposalAmount]=useState('10000'),[proposalRationale,setProposalRationale]=useState('');
 const [stage,setStage]=useState<Profile['wealthStage']>('BUILDING'),[strategyNote,setStrategyNote]=useState('');
 const authed=!!session&&Date.now()<session.expiresAt-5000;

 useEffect(()=>{
  if(processed.current||!config)return;
  const query=new URLSearchParams(window.location.search);
  if(!query.has('code')&&!query.has('error'))return;
  processed.current=true;
  const original=new URLSearchParams(query);
  scrubAuthQuery();
  void completeLogin(config,original).then(s=>{
   setSession(s);setNotice('OIDC access token received in memory. Enter a tenant UUID to read durable records.');
  }).catch(e=>setError(e instanceof Error?e.message:'OIDC authorization could not be completed.'));
 },[config]);

 async function login(){
  if(!config)return;
  setError('');
  try{window.location.assign(await makeLoginUrl(config))}catch(e){setError(e instanceof Error?e.message:'OIDC login cannot start.')}
 }
 async function load(currentSession:Session=session!,requestedTenant=tenantId){
  if(!config||!currentSession||!isUuid(requestedTenant)){setError('Sign in and enter an administratively provisioned tenant UUID.');return}
  setError('');setLoading(true);
  try{
   const fetcher=<T,>(path:string)=>apiRequest<T>(config,currentSession,requestedTenant,path);
   const [profile,goals,strategies,pools,proposals,holdings,incomes,debts,state,sources]=await Promise.all([
    fetcher<Read<Profile>>('/api/v1/wealth/profile').then(r=>r.data).catch(e=>{if(e.status===404)return null;throw e}),
    fetcher<Read<Goal[]>>('/api/v1/wealth/goals?limit=50').then(r=>r.data),
    fetcher<Read<Strategy[]>>('/api/v1/wealth/strategies').then(r=>r.data),
    fetcher<Read<Pool[]>>('/api/v1/wealth/capital/pools').then(r=>r.data),
    fetcher<Read<Proposal[]>>('/api/v1/wealth/capital/proposals').then(r=>r.data),
    fetcher<Read<Holding[]>>('/api/v1/wealth/portfolio/holdings').then(r=>r.data),
    fetcher<Read<Income[]>>('/api/v1/wealth/income').then(r=>r.data),
    fetcher<Read<Debt[]>>('/api/v1/wealth/liabilities').then(r=>r.data),
    fetcher<Read<State>>('/api/v1/wealth/state').then(r=>r.data),
    fetcher<Read<SourceStatus[]>>('/api/v1/wealth/sources/status').then(r=>r.data)
   ]);
   setRecords({profile,goals,strategies,pools,proposals,holdings,incomes,debts,state,sources});
   setStage(profile?.wealthStage??'BUILDING');
   setStrategyNote(profile?.strategyNote??'');
   setNotice('Fetched current tenant-scoped PostgreSQL records. No sample values were imported.');
  }catch(e){setRecords(null);setError(e instanceof Error?e.message:'Unable to load authenticated wealth records.')}
  finally{setLoading(false)}
 }
 async function send(method:'POST'|'PATCH',path:string,body:unknown,version?:string|number){
  if(!config||!session)return;
  setWorking(true);setError('');
  try{
   await apiRequest(config,session,tenantId,path,{method,body,version,idempotencyKey:freshKey()});
   await load(session,tenantId);
   setNotice('Durable planning record saved. No financial execution occurred.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to save the record.')}
  finally{setWorking(false)}
 }
 async function updateProfile(e:FormEvent){
  e.preventDefault();if(!config||!session||!records)return;
  setWorking(true);setError('');
  try{
   await apiRequest(config,session,tenantId,'/api/v1/wealth/profile',{
    method:'PUT',body:{baseCurrency:'KES',wealthStage:stage,strategyNote},version:records.profile?.version??0,idempotencyKey:freshKey()
   });
   await load(session,tenantId);setNotice('Wealth profile saved to PostgreSQL.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to update profile.')}
  finally{setWorking(false)}
 }
 async function loadMilestones(id:string){
  if(!config||!session)return;
  setMilestoneGoal(id);setError('');
  try{const result=await apiRequest<Read<Milestone[]>>(config,session,tenantId,'/api/v1/wealth/goals/'+id+'/milestones');setMilestones(result.data)}
  catch(e){setMilestones([]);setError(e instanceof Error?e.message:'Milestone retrieval failed.')}
 }
 function logout(){setSession(null);setRecords(null);setMilestones([]);setTenantId('');setError('');setNotice('In-memory access token cleared. No backend data was modified.')}
 const pool=useMemo(()=>records?.pools.find(p=>p.id===poolId)??records?.pools[0]??null,[records,poolId]);
 return <div className="wos-screen cw-page">
 <div className="wos-page-head"><div><span className="wos-eyebrow">WEALTH OS / AUTHENTICATED SERVER WORKSPACE</span>
 <h1>Connected Wealth Workspace</h1><p>Securely read and manage Wealth-owned planning records. Isolated from fictional sample figures and localStorage.</p></div></div>
 {config&&['127.0.0.1','localhost'].includes(new URL(config.apiOrigin).hostname)&&
 <Alert><strong>LOCAL DEVELOPMENT TEST IDENTITY:</strong> This account is an isolated Keycloak test subject, not verified HumanKernelOS identity. Local PostgreSQL writes are test-only. Never enter real assets, source credentials or personal financial information.</Alert>}
 <Alert><strong>Data authority:</strong> {mappedRoutes[route]?'Connected mode reads signed, consent-scoped projections and durable Wealth records only.':'This module is not yet supported by authoritative backend APIs.'} No demo figures or fabricated wealth scores are shown here. A real OIDC issuer, API host, verified Kernel binding and source credentials are prerequisites.</Alert>
 {!mappedRoutes[route]&&<Card title="This module is not yet server-backed" subtitle="No simulated returns, forecasts, reports or artificial recommendations in authenticated mode."><p className="cw-copy">This route is available in the fictional sample workspace only. The authenticated backend cannot currently provide evidence-complete {route} records. Select a supported module (Goals, Strategies, Capital, Portfolio, Income, Liabilities, Net Worth) or switch back to the clearly labeled sample workspace.</p></Card>}
 {!config&&<Card title="Server connection not configured" subtitle="This is expected on the public GitHub Pages demo.">
 <p className="cw-copy">Phase B1 REST services are committed and PostgreSQL-certified, but no real backend or trusted identity provider is deployed for this static site. Set the four build-time <code>VITE_WEALTH_*</code> variables for your own trusted environment, provision a tenant, configure CORS and redeploy the frontend to activate this screen. Do not paste tokens into the sample UI.</p>
 <div className="p5-boundary"><CloudOff size={17}/><span>{configResult.error||'No authenticated connection is available. Existing sample screens continue to work entirely offline.'}</span></div></Card>}
 {config&&<><div className="cw-auth"><div><KeyRound size={20}/><div><b>{authed?'OIDC session active':'Trusted identity required'}</b><small>Tokens exist in memory only and expire automatically. No fake login or sample identity.</small></div></div>
 {authed?<Button kind="secondary" onClick={logout}>Disconnect</Button>:<Button onClick={()=>{void login()}}>Sign in via OIDC <ExternalLink size={14}/></Button>}</div>
 {authed&&<Card title="Select provisioned tenant" subtitle="The server independently checks membership and scopes. A tenant UUID alone grants no access.">
 <div className="cw-tenant-row"><Field title="Wealth OS tenant UUID"><input value={tenantId} onChange={e=>{setTenantId(e.target.value);setRecords(null);setMilestones([])}} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off"/></Field>
 <Button disabled={loading||!isUuid(tenantId)} onClick={()=>{void load()}}><RefreshCcw size={14}/>{loading?'Loading…':'Load verified workspace'}</Button></div></Card>}
 {authed&&records&&!!mappedRoutes[route]&&<><div className="wos-kpis">
 <Stat title="Net worth" value={money(records.state.netWorth)} hint={records.state.status==='INCOMPLETE'?'Withheld: missing coverage':'KES · reconciled source projection'} icon={<WalletCards size={18}/>}/>
 <Stat title="Goals" value={String(records.goals.length)} hint="Durable PostgreSQL plans" icon={<CheckCircle2 size={18}/>} tone="teal"/>
 <Stat title="Source-backed holdings" value={String(records.holdings.length)} hint="Consent-gated, never editable here" icon={<Database size={18}/>} tone="blue"/>
 <Stat title="Financial execution" value="Disabled" hint="Wealth OS cannot transfer money" icon={<FileLock2 size={18}/>} tone="gold"/>
 </div>
 <div className="cw-tabs" role="tablist" aria-label="Authenticated wealth modules">{tabs.map(t=><button key={t.id} role="tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)}>{t.title}</button>)}</div>
 {tab==='overview'&&<div className="wos-grid halves"><Card title="Wealth-state authority" subtitle="Null until consent and source completeness are verified">
 <div className="p4-kv"><span>Status</span><b>{records.state.status}</b></div>
 <div className="p4-kv"><span>Gross assets</span><b>{money(records.state.grossAssets)}</b></div>
 <div className="p4-kv"><span>Liabilities</span><b>{money(records.state.liabilities)}</b></div>
 <div className="p4-kv"><span>Net worth</span><b>{money(records.state.netWorth)}</b></div>
 <h3 className="p4-subhead">Evidence blockers</h3>{records.state.blockers.length?records.state.blockers.map(x=><div key={x} className="cw-blocker"><ShieldAlert size={15}/>{x}</div>):<p className="cw-copy">Required evidence is complete in this tenant snapshot; figures are still financial projections, not audits.</p>}
 <h3 className="p4-subhead">Source authority and consent</h3>
 {records.sources.map(x=><div className="cw-record" key={x.sourceSystem}>
 <b>{x.sourceSystem} · {x.status}</b>
 <span>{x.consented?'Consent active':'No read consent'} · {x.authorizedProducerBound?'Service identity bound':'No approved producer'}
 {x.sourceAsOf?' · as of '+x.sourceAsOf.slice(0,10):''}</span></div>)}
 </Card><Card title="Wealth-owned profile" subtitle="Real durable profile; no fake personal information">
 <form className="wos-form" onSubmit={e=>{void updateProfile(e)}}>
 <Field title="Wealth stage"><select value={stage} onChange={e=>setStage(e.target.value)}>{['BUILDING','GROWING','PROTECTING','INDEPENDENT','LEGACY'].map(x=><option key={x}>{x}</option>)}</select></Field>
 <Field title="Strategic note"><textarea maxLength={2000} rows={4} value={strategyNote} onChange={e=>setStrategyNote(e.target.value)}/></Field>
 <div className="cw-actions"><Button type="submit" disabled={working}>Save profile</Button><span>Current version: {records.profile?.version??'not created'}</span></div></form>
 </Card></div>}
 {tab==='goals'&&<div className="wos-grid halves"><Card title="Durable wealth goals" subtitle="Tenant-scoped, versioned PostgreSQL records">
 {records.goals.map(g=><div className="cw-record" key={g.id}><b>{g.title}</b><span>{money(g.targetAmount)} · {g.targetDate} · {g.metric}</span>
 <div className="cw-actions"><Badge tone={g.status==='ACTIVE'?'teal':'gold'}>{g.status}</Badge><Button kind="secondary" onClick={()=>{void loadMilestones(g.id)}}>Milestones <ArrowRight size={13}/></Button></div></div>)}
 {!records.goals.length&&<p className="cw-copy">No durable goals yet. No sample goals are automatically migrated.</p>}
 {milestoneGoal&&<><h3 className="p4-subhead">Milestones · {records.goals.find(x=>x.id===milestoneGoal)?.title}</h3>
 {milestones.map(x=><div key={x.id} className="cw-record"><b>{x.title}</b><span>{money(x.targetAmount)} · {x.dueDate} · {x.status}</span></div>)}
 <form className="wos-form" onSubmit={e=>{e.preventDefault();void send('POST','/api/v1/wealth/goals/'+milestoneGoal+'/milestones',{title:milestoneTitle,targetAmount:milestoneAmount,dueDate:milestoneDate}).then(()=>loadMilestones(milestoneGoal))}}>
 <Field title="New milestone name"><input value={milestoneTitle} required onChange={e=>setMilestoneTitle(e.target.value)} maxLength={160}/></Field>
 <div className="wos-form-two"><Field title="Amount (KES)"><input type="number" min="1" required value={milestoneAmount} onChange={e=>setMilestoneAmount(e.target.value)}/></Field><Field title="Due date"><input type="date" required value={milestoneDate} onChange={e=>setMilestoneDate(e.target.value)}/></Field></div>
 <Button disabled={working} type="submit"><Plus size={14}/> Add milestone</Button></form></>}
 </Card><Card title="Create an authenticated goal" subtitle="Written to PostgreSQL; no bank transfer or valuation is created">
 <form className="wos-form" onSubmit={e=>{e.preventDefault();void send('POST','/api/v1/wealth/goals',{title:goalTitle,targetAmount:goalTarget,targetDate:goalDate,metric:goalMetric,priority:'MEDIUM'})}}>
 <Field title="Goal title"><input required maxLength={160} value={goalTitle} onChange={e=>setGoalTitle(e.target.value)}/></Field>
 <Field title="Measured metric"><select value={goalMetric} onChange={e=>setGoalMetric(e.target.value)}>{['NET_WORTH','LIQUID_WEALTH','PASSIVE_INCOME','DEPLOYABLE_CAPITAL','INVESTED_CAPITAL','CUSTOM'].map(x=><option key={x}>{x}</option>)}</select></Field>
 <Field title="Target value (KES)"><input type="number" min="1" required value={goalTarget} onChange={e=>setGoalTarget(e.target.value)}/></Field>
 <Field title="Target date"><input type="date" required value={goalDate} onChange={e=>setGoalDate(e.target.value)}/></Field>
 <Button disabled={working} type="submit"><Plus size={14}/> Create durable goal</Button></form>
 </Card></div>}
 {tab==='strategies'&&<div className="wos-grid halves"><Card title="Versioned strategies" subtitle="Draft/revision/activation never deploys capital">
 {records.strategies.map(s=><div className="cw-record" key={s.id}><b>{s.name}</b><span>{s.status} · version {s.latestVersion} · {s.assumptions.riskTolerance}</span>
 {s.status==='DRAFT'&&<div className="cw-actions"><Button kind="secondary" disabled={working} onClick={()=>{void send('POST','/api/v1/wealth/strategies/'+s.id+'/activate',{},s.latestVersion)}}>Activate planning strategy</Button></div>}</div>)}
 {!records.strategies.length&&<p className="cw-copy">No versions yet. Activation is strategic planning, not an investment order.</p>}
 </Card><Card title="Create a strategy draft" subtitle="Allocation percentages must sum to 100%; this example uses a single 100% target">
 <form className="wos-form" onSubmit={e=>{e.preventDefault();void send('POST','/api/v1/wealth/strategies',{
 goalId:strategyGoal,name:strategyName,thesis:strategyThesis,
 allocationTargets:[{label:strategyAllocation,basisPoints:10000}],
 assumptions:{riskTolerance:'BALANCED',horizonYears:5,assumedAnnualReturnPct:5}
 })}}>
 <Field title="Linked active goal"><select required value={strategyGoal} onChange={e=>setStrategyGoal(e.target.value)}><option value="">Choose an active goal</option>{records.goals.filter(g=>g.status==='ACTIVE').map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></Field>
 <Field title="Strategy name"><input value={strategyName} required onChange={e=>setStrategyName(e.target.value)} maxLength={200}/></Field>
 <Field title="Planning thesis"><textarea value={strategyThesis} onChange={e=>setStrategyThesis(e.target.value)} maxLength={3000}/></Field>
 <Field title="100% illustration allocation label"><input required value={strategyAllocation} onChange={e=>setStrategyAllocation(e.target.value)}/></Field>
 <Button disabled={working||!strategyGoal} type="submit"><Plus size={14}/> Create draft</Button></form></Card></div>}
 {tab==='capital'&&<div className="wos-grid halves"><Card title="Source-classified cash pools" subtitle="Read-only classification derived from Finance OS; may be empty">
 {records.pools.map(p=><div className="cw-record" key={p.id}><b>{p.name}</b><span>Classified {money(p.classifiedCash)} · Uncommitted {money(p.uncommittedCash)}</span><Badge tone={p.freshSource?'teal':'gold'}>{p.freshSource?'Fresh source':'Stale or no source'}</Badge></div>)}
 {!records.pools.length&&<p className="cw-copy">No authenticated Finance OS cash classifications are present. This is not a zero account balance.</p>}
 <h3 className="p4-subhead">Planning proposals</h3>{records.proposals.map(x=><div key={x.id} className="cw-record"><b>{x.target}</b><span>{money(x.amount)} · {x.status} · policy v{x.policyVersion}</span>
 {x.status==='DRAFT'&&<Button kind="secondary" disabled={working} onClick={()=>{void send('POST','/api/v1/wealth/capital/proposals/'+x.id+'/cancel',{},x.version)}}>Cancel local proposal</Button>}</div>)}
 </Card><Card title="Propose capital allocation" subtitle="Server checks fresh Finance OS provenance, policy and available uncommitted cash">
 <form className="wos-form" onSubmit={e=>{e.preventDefault();if(!pool)return;void send('POST','/api/v1/wealth/capital/proposals',{poolId:pool.id,target:proposalTarget,amount:proposalAmount,rationale:proposalRationale},pool.version)}}>
 <Field title="Finance-sourced capital classification"><select value={pool?.id??''} onChange={e=>setPoolId(e.target.value)}><option value="">Choose a source pool</option>{records.pools.map(p=><option value={p.id} key={p.id}>{p.name} · {money(p.uncommittedCash)}</option>)}</select></Field>
 <Field title="Planning target"><input value={proposalTarget} required maxLength={200} onChange={e=>setProposalTarget(e.target.value)}/></Field>
 <Field title="Amount (KES)"><input type="number" min="0.01" step=".01" value={proposalAmount} onChange={e=>setProposalAmount(e.target.value)}/></Field>
 <Field title="Evidence / rationale (20+ characters)"><textarea required minLength={20} rows={4} value={proposalRationale} onChange={e=>setProposalRationale(e.target.value)}/></Field>
 <Button disabled={!pool?.freshSource||working} type="submit">Save planning proposal</Button></form>
 <div className="p5-boundary"><LockKeyhole size={16}/><span>No funds are held or moved. A source-backed capital policy must exist on the server.</span></div></Card></div>}
 {tab==='portfolio'&&<Card title="Read-only provider-backed holdings" subtitle="Ownership-weighted valuations, evidence and source quality">
 {records.holdings.map(x=><div key={x.id} className="cw-record"><b>{x.sourceSystem} · {x.category}</b><span>{money(x.valuationAmount)} {x.valuationCurrency??''} · Ownership {x.ownerFraction} · {x.qualityStatus}</span><small>As-of: {x.valuationAsOf?.slice(0,10)??'unknown'}</small></div>)}
 {!records.holdings.length&&<p className="cw-copy">No authorized holding projections are available. Provider integration and explicit subject consent are required.</p>}</Card>}
 {tab==='income'&&<Card title="Income projections" subtitle="Read-only projections sourced from external OSs">
 {records.incomes.map(x=><div className="cw-record" key={x.id}><b>{x.sourceSystem}</b><span>{money(x.monthlyAmount)} per month · {x.passive?'Passive':'Active'} · {date(x.sourceAsOf)}</span></div>)}
 {!records.incomes.length&&<p className="cw-copy">No consented authoritative income projections are available.</p>}</Card>}
 {tab==='liabilities'&&<Card title="Liability projections" subtitle="Finance OS remains owner of actual balances and repayments">
 {records.debts.map(x=><div className="cw-record" key={x.id}><b>{x.sourceSystem}</b><span>{money(x.outstandingAmount)} · {date(x.sourceAsOf)}</span></div>)}
 {!records.debts.length&&<p className="cw-copy">No consented liability projections are available. This does not imply there are no debts.</p>}</Card>}
 </>}
 </>}
 {error&&<ErrorNote error={error}/>}
 {notice&&<div className="cw-notice" role="status"><ShieldCheck size={15}/>{notice}</div>}
 <div className="cw-foot"><Link2 size={14}/><span>Only the <strong>Connected Workspace</strong> uses authenticated PostgreSQL records. All other screens remain explicitly fictional demos until a later integration release.</span></div>
 </div>;
}
