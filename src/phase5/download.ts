/** Browser-side download helpers. No upload or external network calls. */
export function saveLocalFile(name:string,content:string,mime='application/json'):void {
 const blob=new Blob([content],{type:mime+';charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');
 anchor.href=url;anchor.download=name;anchor.style.display='none';document.body.appendChild(anchor);anchor.click();anchor.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function sampleDateStamp(){return new Date().toISOString().slice(0,10)}
