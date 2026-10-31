import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowRight,BookOpen,BrainCircuit,CheckCircle2,ChevronRight,Database,LockKeyhole,MessageCircle,Send,ShieldCheck,Sparkles} from 'lucide-react';
import {useWealth} from '../phase2/context';
import {advisorAnswer} from './model';
import type {AdvisorAnswer} from './model';
import {Header,Button,Card,Stat,Alert,Sample,Badge} from '../phase3/ui';

const examples=[
 'How is my net worth calculated?',
 'What are my biggest wealth risks?',
 'How much capital is available?',
 'When am I financially independent?',
 'What do my goals need?',
 'Should I pay down debt?',
 'Which opportunities are affordable?',
 'Explain the forecast assumptions.'
];
interface Exchange {id:string;question:string;answer:AdvisorAnswer}
export function AdvisorScreen({navigate}:{navigate:(route:'dashboard'|'risk'|'capital'|'independence'|'goals'|'liabilities'|'opportunities'|'forecasts'|'net-worth')=>void}){
 const {state,metrics}=useWealth();
 const [draft,setDraft]=useState('');
 const remember=state.governance.privacy.rememberAdvisorSessions;
 const [messages,setMessages]=useState<Exchange[]>(()=>{
  if(!remember)return [];
  try {const value=localStorage.getItem('wealth-os-demo-advisor-session');const parsed:unknown=value?JSON.parse(value):[];
   return Array.isArray(parsed)?parsed.slice(0,15) as Exchange[]:[];}catch{return []}
 });
 useEffect(()=>{
  try{if(remember)localStorage.setItem('wealth-os-demo-advisor-session',JSON.stringify(messages.slice(0,15)));
   else localStorage.removeItem('wealth-os-demo-advisor-session')}catch{/* browser storage unavailable */}
 },[remember,messages]);
 function ask(question:string){const prompt=question.trim();if(!prompt)return;const answer=advisorAnswer(state,prompt);setMessages(s=>[{id:String(Date.now())+'-'+s.length,question:prompt,answer},...s].slice(0,15));setDraft('')}
 function send(e:FormEvent){e.preventDefault();ask(draft)}
 function move(route:string){navigate(route as 'dashboard'|'risk'|'capital'|'independence'|'goals'|'liabilities'|'opportunities'|'forecasts'|'net-worth')}
 return <div className="wos-screen">
 <Header title="AI Wealth Advisor" description="A transparent, offline decision-explanation experience over your illustrative wealth workspace—not a connected AI model." actions={<Badge tone="gold"><LockKeyhole size={13}/> Rules engine · offline</Badge>}/>
 <Sample/>
 <div className="wos-kpis">
 <Stat title="Reasoning mode" value="Rules only" hint="No LLM, API or external service" icon={<BrainCircuit size={18}/>}/>
 <Stat title="Supported question types" value="8" hint="Net worth, risk, capital, goals, debt, independence, opportunities, forecasts" icon={<MessageCircle size={18}/>} tone="blue"/>
 <Stat title="Connected real accounts" value="0" hint="All figures are illustrative" icon={<LockKeyhole size={18}/>} tone="gold"/>
 <Stat title="Financial execution" value="Disabled" hint="No transfers, trades or approvals" icon={<ShieldCheck size={18}/>} tone="teal"/>
 </div>
 <Alert>This is a deterministic wealth Q&A prototype. It is deliberately NOT a live LLM or registered financial adviser. It uses only data already in this browser and never sends prompts to an external provider. Responses are rules-based explanations, not personal investment instructions.</Alert>
 <div className="p4-advisor-layout">
 <Card title="Ask your Wealth OS" subtitle="Type a supported question or choose a prompt">
 <div className="p4-advisor-intro"><span><Sparkles size={22}/></span><h3>Ask better wealth questions.</h3><p>Every answer includes the calculation source, its sample evidence and what the current prototype cannot know.</p></div>
 <form className="p4-ask" onSubmit={send}><label htmlFor="wealth-question">Your question</label><textarea id="wealth-question" value={draft} onChange={e=>setDraft(e.target.value)} rows={3} maxLength={400} placeholder="e.g. How much capital can I actually allocate?"/><Button type="submit" disabled={!draft.trim()}><Send size={14}/> Explain with sample evidence</Button></form>
 <h3 className="p4-subhead">Suggested questions</h3><div className="p4-prompt-list">{examples.map(q=><button type="button" key={q} onClick={()=>ask(q)}><MessageCircle size={14}/><span>{q}</span><ChevronRight size={13}/></button>)}</div>
 </Card>
 <Card title="Evidence-backed explanations" subtitle={messages.length?messages.length+' current-session responses':'Select a question to begin'} side={messages.length?<Button kind="secondary" onClick={()=>setMessages([])}>Clear session</Button>:null}>
 {messages.length? <div className="p4-chat">{messages.map(m=><div key={m.id} className="p4-exchange"><div className="p4-user-question">{m.question}</div><div className="p4-answer"><div className="p4-answer-head"><BrainCircuit size={17}/><b>{m.answer.headline}</b></div><p>{m.answer.body}</p>
 <div className="p4-evidence-title"><Database size={14}/> Evidence used</div><div className="p4-evidence-table">{m.answer.facts.map((f,i)=><div key={i}><span>{f.label}<small>{f.origin}</small></span><b>{f.value}</b></div>)}</div>
 <div className="p4-answer-caveat"><LockKeyhole size={14}/>{m.answer.limitations}</div><div className="p4-answer-next"><div><small>Reasonable next review</small><p>{m.answer.next}</p></div><Button kind="secondary" onClick={()=>move(m.answer.route)}>Open screen <ArrowRight size={13}/></Button></div>
 </div></div>)}</div>:<div className="p4-advisor-empty"><BookOpen size={31}/><h3>Your reasoning trail appears here</h3><p>Start with an example to see what data supports an explanation. Unknown questions are handled with transparent limitations rather than invented answers. When enabled in Security & Privacy, short Q&A transcripts are stored locally without encryption. Otherwise questions remain in this page session only.</p></div>}
 </Card></div>
 <Card title="Agent permissions · current prototype" subtitle="No autonomous execution or access to private external data">
 <div className="p4-permission-grid"><div><CheckCircle2 size={17}/><span>Read local sample metrics</span></div><div><CheckCircle2 size={17}/><span>Show transparent formulas and risk thresholds</span></div><div><CheckCircle2 size={17}/><span>Explain local scenarios and assumptions</span></div><div className="blocked"><LockKeyhole size={17}/><span>No transactions, trading, policy changes or external calls</span></div></div>
 <div className="p4-button-row"><Button kind="secondary" onClick={()=>move('risk')}>Risk Center <ArrowRight size={13}/></Button><Button kind="secondary" onClick={()=>move('dashboard')}>Command Center <ArrowRight size={13}/></Button></div>
 </Card>
 <div className="p4-disclaimer">Current local net worth for reference: {metrics.netWorth.toLocaleString('en-KE')} KES. No sensitive records are ingested from external systems.</div>
 </div>
}
