import {useEffect,useId,useRef} from 'react';
import type {ReactNode} from 'react';
import {X} from 'lucide-react';

/** Accessible local modal: initial focus, tab containment, Escape, focus restore and scroll lock. */
export function AccessibleDialog({title,description,children,onClose}:{title:string;description:string;children:ReactNode;onClose:()=>void}){
 const dialog=useRef<HTMLDivElement>(null);
 const titleId=useId(),descriptionId=useId();
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  dialog.current?.focus();
  function key(e:KeyboardEvent){
   if(e.key==='Escape'){e.stopPropagation();close.current();return}
   if(e.key!=='Tab'||!dialog.current)return;
   const focusable=Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(x=>x.getClientRects().length>0);
   if(focusable.length===0){e.preventDefault();dialog.current.focus();return}
   const first=focusable[0],last=focusable[focusable.length-1];
   if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){e.preventDefault();first.focus()}
  }
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=previousOverflow;previouslyFocused?.focus()};
 },[]);
 return <div className="wos-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div ref={dialog} tabIndex={-1} className="wos-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
   <div className="wos-modal-top"><div><small>WEALTH OS · BROWSER-LOCAL DEMONSTRATION</small><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div>
    <button type="button" aria-label="Close dialog" onClick={onClose} className="wos-close"><X size={19}/></button></div>
   {children}
  </div>
 </div>;
}
