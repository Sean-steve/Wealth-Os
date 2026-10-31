import {useState} from 'react';
import {ArrowRight,ArrowRightLeft,BookOpen,Building2,CheckCircle2,CircleOff,Database,GitBranch,LockKeyhole,Network,ShieldCheck,Users,WalletCards} from 'lucide-react';
import {Alert,Badge,Button,Card,Header,Sample,Stat} from '../phase3/ui';
const systems=[
 {id:'kernel',name:'Personal Kernel / HumanKernelOS',role:'Global identity, policy arbitration, consent',direction:'Governed identity & permissions → Wealth OS',requires:'Subject binding, scoped consent, signed policy outcomes',records:'None connected',icon:'kernel'},
 {id:'finance',name:'Finance OS',role:'Transactions, balances, debt and money movement authority',direction:'Authoritative financial facts → Wealth OS; approved intent → Finance OS',requires:'Scoped account read, event identity, Finance OS execution authorization',records:'None connected',icon:'finance'},
 {id:'asset',name:'Asset OS',role:'Asset registry, ownership and valuation evidence',direction:'Asset positions and valued-at evidence → Wealth OS',requires:'Ownership share, valuation methodology, provenance and staleness',records:'None connected',icon:'asset'},
 {id:'company',name:'Company OS',role:'Business equity, enterprise valuation and distributions',direction:'Business ownership, dividends and valuation evidence → Wealth OS',requires:'Owner stake, cash distributions, enterprise valuation lineage',records:'None connected',icon:'company'},
 {id:'family',name:'Family OS',role:'Household goals and obligations',direction:'Consent-limited obligations and family goals ↔ Wealth OS',requires:'Separate family access and purpose-limited data consent',records:'None connected',icon:'family'},
 {id:'legacy',name:'Legacy OS',role:'Beneficiaries, estate planning and succession',direction:'Legacy planning references ↔ Wealth OS',requires:'Granular consent, legal validation, limited disclosure',records:'None connected',icon:'legacy'}
] as const;
function icon(kind:string){if(kind==='kernel')return <ShieldCheck size={18}/>;if(kind==='finance')return <WalletCards size={18}/>;if(kind==='asset')return <Database size={18}/>;if(kind==='company')return <Building2 size={18}/>;if(kind==='family')return <Users size={18}/>;return <BookOpen size={18}/>}
export function IntegrationsScreen({navigate}:{navigate:(r:'security'|'governance'|'settings')=>void}){
 const [selected,setSelected]=useState<string>('kernel');
 const system=systems.find(s=>s.id===selected)??systems[0];
 return <div className="wos-screen">
 <Header title="Integrations & Data Contracts" description="Map the authoritative OS boundaries and integration prerequisites without creating fake service connections." actions={<Button kind="secondary" onClick={()=>navigate('settings')}><GitBranch size={15}/> Workspace settings</Button>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="Planned system boundaries" value={String(systems.length)} hint="Contract specifications only" icon={<Network size={18}/>}/>
 <Stat title="Active service connections" value="0" hint="No authentication or data sync" icon={<CircleOff size={18}/>} tone="gold"/>
 <Stat title="Verified financial records" value="0" hint="All visible wealth records are simulated" icon={<LockKeyhole size={18}/>} tone="blue"/>
 <Stat title="Real financial execution" value="Disabled" hint="Finance OS not connected" icon={<ShieldCheck size={18}/>} tone="teal"/>
 </div>
 <Alert>These are **integration architecture placeholders**, not installed connectors. There are no OAuth tokens, API keys, sync jobs, webhook endpoints, background tasks, domain permissions, or ability to connect accounts from this static website.</Alert>
 <div className="p5-split">
 <Card title="Connected-system architecture" subtitle="All connections are currently planned and inactive">
 <div className="p5-integrations">{systems.map(s=><button key={s.id} type="button" onClick={()=>setSelected(s.id)} className={'p5-integration '+(system.id===s.id?'selected':'')}><span className="p5-integration-icon">{icon(s.icon)}</span><span><b>{s.name}</b><small>{s.role}</small></span><Badge tone="gold">Not connected</Badge></button>)}</div>
 </Card>
 <Card title={system.name} subtitle="Contract design and domain ownership; no live integration" side={<Badge tone="gold">Offline</Badge>}>
 <div className="p5-connection-preview"><span><CircleOff size={22}/></span><div><small>Connection status</small><strong>Not connected</strong><p>No data access token, health endpoint, sync history or integration credentials exist.</p></div></div>
 <h3 className="p4-subhead">Source-of-truth responsibility</h3><p className="p4-body">{system.role}</p>
 <h3 className="p4-subhead">Planned data direction</h3><div className="p5-contract-direction"><ArrowRightLeft size={18}/><span>{system.direction}</span></div>
 <h3 className="p4-subhead">Minimum onboarding requirements</h3><p className="p4-body">{system.requires}</p>
 <h3 className="p4-subhead">Records synchronized</h3><p className="p4-body">{system.records}</p>
 <div className="p5-boundary"><LockKeyhole size={16}/><span>Connection controls are intentionally unavailable until identity, consent, secure backend adapters, event contracts and audit are implemented.</span></div>
 <div className="p5-help-row"><Button kind="secondary" onClick={()=>navigate('governance')}>Policy model <ArrowRight size={14}/></Button><Button kind="secondary" onClick={()=>navigate('security')}>Privacy boundary <ArrowRight size={14}/></Button></div>
 </Card></div>
 <Card title="Integration invariants" subtitle="Requirements before the first real external fact is admitted">
 <div className="p5-invariants">
 {[
 ['Authority separation','Wealth OS owns strategy and projections; external domain services own the underlying transactions and asset facts.'],
 ['User identity','Only Personal Kernel-governed subjects, explicit scopes and purpose binding may authorize cross-OS reads.'],
 ['Data lineage','Every external fact requires source_system, entity_type, entity_id, as_of, version, provenance and data quality.'],
 ['Idempotent events','Event envelopes must be versioned, deduplicated and auditable through outbox/inbox persistence.'],
 ['No speculative execution','Planning acknowledgement cannot debit a balance, trade a security or transfer funds. Finance OS must make its own decision.'],
 ['Consent minimization','Never leak account numbers, private family data, credentials or unnecessary record fields into intelligence prompts.']
 ].map(([title,description],i)=><div className="p5-invariant" key={title}><span>{String(i+1).padStart(2,'0')}</span><div><b>{title}</b><p>{description}</p></div><CheckCircle2 size={16}/></div>)}</div>
 </Card>
 <div className="p5-help-row"><Button kind="secondary" onClick={()=>navigate('settings')}>Workspace settings <ArrowRight size={14}/></Button></div>
 </div>;
}
