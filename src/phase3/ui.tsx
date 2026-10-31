import {useEffect} from 'react';
import type {ReactNode} from 'react';
import {Info,X,ArrowUpRight} from 'lucide-react';
export const cash=(x:number)=>'KES '+new Intl.NumberFormat('en-KE',{maximumFractionDigits:0}).format(x);
export const shortCash=(x:number)=>Math.abs(x)>=1e6?'KES '+(x/1e6).toFixed(2)+'M':Math.abs(x)>=1e3?'KES '+Math.round(x/1e3)+'K':cash(x);
export const newId=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
export const errorText=(e:unknown)=>e instanceof Error?e.message:'Unable to save sample changes.';
export function Header({title,description,actions}:{title:string;description:string;actions?:ReactNode}){
 return <div className="wos-page-head"><div><span className="wos-eyebrow">WEALTH OS / PERSONAL WEALTH / SAMPLE WORKSPACE</span><h1>{title}</h1><p>{description}</p></div><div className="wos-head-actions">{actions}</div></div>;
}
export function Button({children,onClick,kind='primary',type='button',disabled=false}:{children:ReactNode;onClick?:()=>void;kind?:'primary'|'secondary'|'plain';type?:'submit'|'button';disabled?:boolean}){return <button type={type} onClick={onClick} className={'wos-action '+kind} disabled={disabled}>{children}</button>}
export function Card({title,subtitle,side,children,className=''}:{title:string;subtitle?:string;side?:ReactNode;children:ReactNode;className?:string}){return <section className={'wos-card '+className}><div className="wos-card-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{side}</div>{children}</section>}
export function Stat({title,value,hint,icon,tone='violet'}:{title:string;value:string;hint:string;icon:ReactNode;tone?:'violet'|'teal'|'gold'|'blue'}){return <div className="wos-kpi"><div className="wos-kpi-top"><span>{title}</span><i className={'wos-icon '+tone}>{icon}</i></div><strong>{value}</strong><small>{hint}</small></div>}
export function Progress({value,color='#6e5cea'}:{value:number;color?:string}){return <div className="wos-progress"><span style={{width:Math.max(0,Math.min(100,value))+'%',background:color}}/></div>}
export function Alert({children}:{children:ReactNode}){return <div className="wos-advisory"><Info size={16}/><span>{children}</span></div>}
export function Field({title,children}:{title:string;children:ReactNode}){return <label className="wos-field"><span>{title}</span>{children}</label>}
export function ErrorNote({error}:{error:string}){return error?<div role="alert" className="wos-error">{error}</div>:null}
export function Modal({title,subtitle,onClose,children}:{title:string;subtitle:string;onClose:()=>void;children:ReactNode}){
 useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[onClose]);
 return <div className="wos-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="wos-modal" role="dialog" aria-modal="true" aria-label={title}><div className="wos-modal-top"><div><small>WEALTH OS · BROWSER-LOCAL DEMONSTRATION</small><h2>{title}</h2><p>{subtitle}</p></div><button type="button" aria-label="Close dialog" onClick={onClose} className="wos-close"><X size={19}/></button></div>{children}</div></div>;
}
export function Badge({children,tone='violet'}:{children:ReactNode;tone?:'violet'|'teal'|'gold'}){return <span className={'p3-badge '+tone}>{children}</span>}
export function Sample(){return <div className="wos-live-tag"><span/> Local sample data · no connected financial services</div>}
export function LinkButton({onClick,children}:{onClick:()=>void;children:ReactNode}){return <button type="button" className="p3-link" onClick={onClick}>{children} <ArrowUpRight size={13}/></button>}
