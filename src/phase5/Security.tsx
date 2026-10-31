import {makeWorkspaceBackup,readWorkspaceBackup} from '../phase6/backup';
import {useRef,useState} from 'react';
import {Archive,ArrowRight,Database,Download,Eye,EyeOff,FileJson,HardDriveDownload,LockKeyhole,RefreshCw,ShieldAlert,ShieldCheck,Trash2,UserRoundX} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {updatePrivacy} from './model';
import type {PrivacyPrefs} from './model';
import {saveLocalFile,sampleDateStamp} from './download';
import {Alert,Badge,Button,Card,Header,Sample,Stat,cash} from '../phase3/ui';
const key='wealth-os-demo-advisor-session';
export function SecurityScreen({navigate}:{navigate:(r:'governance'|'integrations'|'reports')=>void}){
 const {state,metrics,update,replace,reset,notify}=useWealth();
 const fileInput=useRef<HTMLInputElement>(null);
 const [storageError,setStorageError]=useState('');
 const p=state.governance.privacy;
 const stateText=p.showSensitiveDemoValues?cash(metrics.netWorth):'Hidden in this privacy preview';
 function change(name:keyof PrivacyPrefs,value:boolean){update(s=>updatePrivacy(s,{...s.governance.privacy,[name]:value}));notify('Local privacy preference updated. No external settings were changed.')}
 function exportDemo(){try{saveLocalFile('wealth-os-local-sample-'+sampleDateStamp()+'.json',makeWorkspaceBackup(state));notify('Demo workspace exported to a local JSON file. Treat exported files as readable plain text.')}catch(e){setStorageError(e instanceof Error?e.message:'Export failed.')}}
 async function importDemo(file:File|undefined){
  if(!file)return;
  setStorageError('');
  try{
   if(file.size>3*1024*1024)throw Error('Backup is too large. Maximum size: 3 MB.');
   const workspace=readWorkspaceBackup(await file.text());
   if(!window.confirm('Replace all current edited sample data with this backup? This cannot be undone.'))return;
   replace(workspace);
   notify('Local sample backup restored. No external accounts were accessed.');
  }catch(e){setStorageError(e instanceof Error?e.message:'Unable to restore this backup. No local data was changed.')}
  finally{if(fileInput.current)fileInput.current.value=''}
 }
 function deleteDemo(){if(!window.confirm('Reset ALL locally edited sample holdings, goals, intelligence and decisions back to their fictional defaults? This cannot be undone.'))return;try{localStorage.removeItem(key)}catch{/* Browser storage may be blocked */}reset();notify('Reset complete. The default fictional workspace will remain in browser storage until the browser is cleared.')}
 function clearAdvisor(){try{localStorage.removeItem(key);notify('Saved browser-local advisor transcript cleared. Existing open tabs may still display an in-memory copy.')}catch(e){setStorageError(e instanceof Error?e.message:'Unable to clear local transcript.')}}
 return <div className="wos-screen">
 <Header title="Security & Privacy" description="Understand the limitations of this browser-only prototype, control local preferences and export or reset fictional records." actions={<Button kind="secondary" onClick={()=>navigate('governance')}><ShieldCheck size={14}/> Policy boundary</Button>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="User authentication" value="Not active" hint="No credentials or verified identities" icon={<UserRoundX size={18}/>} tone="gold"/>
 <Stat title="Data location" value="This browser" hint="Local storage; no backend" icon={<Database size={18}/>}/>
 <Stat title="Encryption at rest" value="Not provided" hint="Do not store real private data here" icon={<LockKeyhole size={18}/>} tone="gold"/>
 <Stat title="External data sharing" value="None built in" hint="No financial services are connected" icon={<ShieldCheck size={18}/>} tone="teal"/>
 </div>
 <Alert>**Security notice:** Browser localStorage is readable by JavaScript running on this site, is not encrypted by Wealth OS and is not a secure vault. Do not enter real balances, identifiers, credentials, API keys or family secrets. Browser deletion is not verified secure erasure or deletion of downloaded copies.</Alert>
 <div className="wos-grid halves">
 <Card title="Local privacy preferences" subtitle="Functional demonstration controls; not a legally valid consent or Personal Kernel policy">
 <div className="p5-switches">
 <label className="p5-toggle-row"><input type="checkbox" checked={p.showSensitiveDemoValues} onChange={e=>change('showSensitiveDemoValues',e.target.checked)}/><span><b>Show amounts in this privacy overview</b><small>Hides the sample net-worth amount only in the preview below. Other financial modules remain visible.</small></span></label>
 <label className="p5-toggle-row"><input type="checkbox" checked={p.rememberAdvisorSessions} onChange={e=>change('rememberAdvisorSessions',e.target.checked)}/><span><b>Remember advisor Q&A in this browser</b><small>Off by default. When enabled, the offline advisor saves short local transcripts; these are not encrypted.</small></span></label>
 <label className="p5-toggle-row"><input type="checkbox" checked={p.includeAuditInExport} onChange={e=>change('includeAuditInExport',e.target.checked)}/><span><b>Include local decision events in reports</b><small>Affects generated report JSON. Full workspace backup always includes local governance history.</small></span></label>
 <label className="p5-toggle-row"><input type="checkbox" checked={p.familySharingIntent} onChange={e=>change('familySharingIntent',e.target.checked)}/><span><b>Record future family-sharing preference</b><small>Intent only. No Family OS connection and nothing is transmitted or shared.</small></span></label>
 </div>
 <div className="p5-privacy-preview">{p.showSensitiveDemoValues?<Eye size={18}/>:<EyeOff size={18}/>}<div><small>Sample net-worth preview</small><b>{stateText}</b></div></div>
 </Card>
 <Card title="Storage & data controls" subtitle="Operate only on fictional records currently held in this browser">
 <div className="p5-storage-list"><div><Archive size={17}/><div><b>Restore a sample workspace backup</b><small>Imports a previously exported Wealth OS JSON file. Structural validation runs before replacing local data.</small></div>
 <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Select Wealth OS JSON backup" className="p6-visually-hidden" onChange={e=>{void importDemo(e.target.files?.[0])}}/>
 <Button kind="secondary" onClick={()=>fileInput.current?.click()}>Import</Button></div>
 <div><Archive size={17}/><div><b>Full browser workspace export</b><small>Plain-text JSON containing sample portfolio, planning, decisions and local preferences.</small></div><Button kind="secondary" onClick={exportDemo}><Download size={14}/> Export</Button></div>
 <div><FileJson size={17}/><div><b>Clear stored advisor transcript</b><small>Deletes the optional offline Q&A transcript for this origin in this browser only.</small></div><Button kind="secondary" onClick={clearAdvisor}>Clear</Button></div>
 <div><Trash2 size={17}/><div><b>Reset local demo data</b><small>Restores fictional seed figures and clears edited local decisions. No remote deletion is performed.</small></div><Button kind="secondary" onClick={deleteDemo}><RefreshCw size={14}/> Reset</Button></div></div>
 {storageError&&<p className="wos-error" role="alert">{storageError}</p>}
 <div className="p5-boundary"><ShieldAlert size={17}/><span>Browser history, external downloaded files and other tabs are outside these reset controls.</span></div>
 </Card></div>
 <div className="wos-grid halves">
 <Card title="Threat & capability checklist" subtitle="Honest implementation status for the frontend-only prototype">
 <div className="p5-security-rows">{[
 ['Demo display and local state','Implemented','teal'],['Authentication / access tokens','Not implemented','gold'],['MFA and independent approvals','Not implemented','gold'],['Server-side authorization & isolation','Not implemented','gold'],['Tamper-evident financial audit','Not implemented','gold'],['Bank and provider credentials','None used','teal'],['Personal Kernel consent enforcement','Not connected','gold']
 ].map(([label,result,tone])=><div key={label}><span>{label}</span><Badge tone={tone as 'teal'|'gold'}>{result}</Badge></div>)}</div>
 </Card>
 <Card title="Cross-OS privacy and governance" subtitle="Future architecture, not functioning integrations">
 <p className="p4-body">A real Wealth OS must obtain explicit scopes from Personal Kernel, read only minimum-necessary Finance OS/Asset OS/Company OS facts, and route any real execution back to the appropriate authoritative system.</p>
 <div className="p5-authority"><div><span className="p5-level pass">01</span><div><b>Wealth OS prototype</b><p>Sample insights, local preferences and demonstrations only.</p></div></div><div><span className="p5-level demo">02</span><div><b>Personal Kernel & external OSs</b><p>Identity, consent, provider authorization, sensitive-data storage and review remain pending.</p></div></div></div>
 <div className="p5-help-row"><Button kind="secondary" onClick={()=>navigate('integrations')}>Integration contracts <ArrowRight size={14}/></Button><Button kind="secondary" onClick={()=>navigate('reports')}><HardDriveDownload size={14}/> Wealth reports</Button></div>
 </Card></div>
 </div>;
}
