import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {initialState,hydrateState,summary,appendActivity} from './model';
import type {WealthState} from './model';
const STORAGE='wealth-os-phase2-sample-v1';
interface Store {state:WealthState;metrics:ReturnType<typeof summary>;update:(action:(s:WealthState)=>WealthState)=>void;replace:(value:WealthState)=>void;reset:()=>void;notice:string;notify:(message:string)=>void}
const WealthContext=createContext<Store|null>(null);
export function WealthProvider({children}:{children:ReactNode}){
 const [state,setState]=useState<WealthState>(()=>{
  try {const value=localStorage.getItem(STORAGE);if(value){const parsed:unknown=JSON.parse(value);return hydrateState(parsed)}}catch{ /* storage unavailable: preserve in-memory demo */ }
  return structuredClone(initialState);
 });
 const stateRef=useRef(state);
 const [notice,setNotice]=useState('');
 useEffect(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(state))}catch{/* ephemeral demo */}},[state]);
 useEffect(()=>{if(!notice)return;const t=window.setTimeout(()=>setNotice(''),4200);return()=>window.clearTimeout(t)},[notice]);
 const update=useCallback((action:(s:WealthState)=>WealthState)=>{const next=appendActivity(stateRef.current,action(stateRef.current));stateRef.current=next;setState(next)},[]);
 const replace=useCallback((value:WealthState)=>{const hydrated=hydrateState(value);stateRef.current=hydrated;setState(hydrated);setNotice('Browser-local sample backup restored. No live accounts were changed.')},[]);
 const reset=useCallback(()=>{const seed=structuredClone(initialState);stateRef.current=seed;setState(seed);setNotice('Illustrative workspace reset to default sample figures.')},[]);
 const notify=useCallback((s:string)=>setNotice(s),[]);
 const metrics=useMemo(()=>summary(state),[state]);
 return <WealthContext.Provider value={{state,metrics,update,replace,reset,notice,notify}}>{children}</WealthContext.Provider>;
}
export function useWealth(){const c=useContext(WealthContext);if(!c)throw new Error('WealthProvider missing');return c}
