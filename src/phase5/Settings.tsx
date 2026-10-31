import {useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowRight,BookOpen,CheckCircle2,Compass,Database,FileText,HardDrive,Info,ShieldCheck,WalletCards} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {updateWorkspaceSettings} from './model';
import type {WorkspaceSettings} from './model';
import {Alert,Badge,Button,Card,ErrorNote,Field,Header,Sample,Stat,errorText} from '../phase3/ui';
export function SettingsScreen({navigate}:{navigate:(r:'dashboard'|'decisions'|'reports'|'integrations'|'security')=>void}){
 const {state,update,notify}=useWealth();
 const settings=state.governance.settings;
 const [form,setForm]=useState<WorkspaceSettings>({...settings}),[error,setError]=useState('');
 function save(e:FormEvent){e.preventDefault();setError('');try{update(s=>updateWorkspaceSettings(s,form));notify('Local display and report preferences saved. No server profile was changed.')}catch(err){setError(errorText(err))}}
 function restore(){setForm({...settings});notify('Unsaved settings discarded.')}
 return <div className="wos-screen">
 <Header title="Workspace Settings" description="Configure browser-local presentation, reporting preferences and your default landing screen." actions={<Button kind="secondary" onClick={()=>navigate('dashboard')}><Compass size={15}/> Command Center</Button>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="Currency" value="KES" hint="Kenyan shillings; no FX feeds" icon={<WalletCards size={18}/>}/>
 <Stat title="Locale" value="en-KE" hint="Browser display formatting" icon={<Compass size={18}/>} tone="blue"/>
 <Stat title="Persistence" value="This browser" hint="localStorage only" icon={<HardDrive size={18}/>} tone="gold"/>
 <Stat title="Sync" value="Not active" hint="No backend or cloud account" icon={<Database size={18}/>} tone="teal"/>
 </div>
 <Alert>These settings apply only to the demonstration workspace stored in this browser. No user account, cross-device synchronization, currency conversion or real integration preferences exist yet.</Alert>
 <div className="wos-grid halves">
 <Card title="Presentation & reporting" subtitle="Customize how locally calculated information is displayed">
 <form className="wos-form" onSubmit={save}>
 <div className="wos-form-two">
 <Field title="Currency"><input value="KES — Kenyan shillings" readOnly aria-label="Currency fixed at KES"/></Field>
 <Field title="Locale"><input value="en-KE — Kenya / English" readOnly aria-label="Locale fixed at en-KE"/></Field>
 </div>
 <Field title="Landing screen (when opening without a URL hash)"><select value={form.defaultScreen} onChange={e=>setForm(f=>({...f,defaultScreen:e.target.value as WorkspaceSettings['defaultScreen']}))}><option value="dashboard">Command Center</option><option value="decisions">Decision Journal</option><option value="reports">Wealth Reports</option></select></Field>
 <Field title="Report history scope"><select value={form.reportPeriod} onChange={e=>setForm(f=>({...f,reportPeriod:e.target.value as WorkspaceSettings['reportPeriod']}))}><option value="CURRENT">Current wealth snapshot only</option><option value="ALL">Current snapshot + eligible local event history</option></select></Field>
 <label className="p5-toggle-row"><input type="checkbox" checked={form.compactDisplay} onChange={e=>setForm(f=>({...f,compactDisplay:e.target.checked}))}/><span><b>Use compact number formatting in Reports</b><small>For example, KES 12.84M instead of KES 12,840,000 on the reports screen.</small></span></label>
 <ErrorNote error={error}/>
 <div className="wos-form-actions"><Button kind="secondary" onClick={restore}>Discard edits</Button><Button type="submit"><CheckCircle2 size={14}/> Save local settings</Button></div>
 </form></Card>
 <Card title="Environment & capabilities" subtitle="Accurate status of this release">
 <div className="p5-security-rows">
 {[
 ['Application release','Frontend v0.5 demonstration','teal'],['Finance database','Not connected','gold'],['Real identities / sign-in','Not implemented','gold'],['Wealth intelligence','Deterministic sample engine','teal'],['Financial execution','Disabled','teal'],['Cross-device synchronization','Not implemented','gold'],['Personal Kernel integration','Planned','gold']
 ].map(([label,value,tone])=><div key={label}><span>{label}</span><Badge tone={tone as 'teal'|'gold'}>{value}</Badge></div>)}
 </div>
 <div className="p5-boundary"><ShieldCheck size={16}/><span>The prototype does not request passwords, payment cards, identity numbers or real API keys.</span></div>
 </Card></div>
 <Card title="Supporting modules" subtitle="Use the workflows that shape your wealth strategy and review its safety boundaries">
 <div className="p5-support-links">
 <button type="button" onClick={()=>navigate('decisions')}><BookOpen size={19}/><span><b>Decision Journal</b><small>Evidence, recommendation origin and review histories</small></span><ArrowRight size={16}/></button>
 <button type="button" onClick={()=>navigate('reports')}><FileText size={19}/><span><b>Wealth Reports</b><small>Current sample statement and CSV/JSON export</small></span><ArrowRight size={16}/></button>
 <button type="button" onClick={()=>navigate('integrations')}><Database size={19}/><span><b>Integration Architecture</b><small>Authoritative systems and future contract requirements</small></span><ArrowRight size={16}/></button>
 <button type="button" onClick={()=>navigate('security')}><ShieldCheck size={19}/><span><b>Security & Privacy</b><small>Local preferences, backup and demo reset</small></span><ArrowRight size={16}/></button>
 </div>
 </Card>
 <div className="p5-boundary"><Info size={16}/><span>Future integrations and live governance will require a backend and the authoritative Personal Kernel security boundary. Do not use browser-local sample data for real financial planning.</span></div>
 </div>;
}
