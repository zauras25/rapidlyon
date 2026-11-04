'use client';
import { useEffect, useState } from 'react';
type Event={kind:string;title:string;reference:string|null;status:string;date:string};
export function LeadTimeline({inquiryId}:{inquiryId:string}){
  const [events,setEvents]=useState<Event[]>([]);
  const [error,setError]=useState('');const [busy,setBusy]=useState(true);
  useEffect(()=>{
    fetch(`/api/admin/leads/${encodeURIComponent(inquiryId)}/timeline`,{cache:'no-store'})
      .then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.message||'Could not read lead history');return x})
      .then(x=>setEvents(x.events||[]))
      .catch(e=>setError(e instanceof Error?e.message:'Timeline unavailable'))
      .finally(()=>setBusy(false));
  },[inquiryId]);
  return <section className="form-section" style={{maxWidth:630}}><h3>Unified lead timeline</h3>
    {busy?<p className="form-hint">Loading inquiry → discovery → proposal history…</p>:error?<p className="form-hint" role="status">{error}</p>:
    <ol style={{paddingLeft:20}}>{events.map((item,index)=><li key={index} style={{padding:'8px 0'}}><strong>{item.title}</strong> · {item.status}<div className="form-hint">{item.reference?`${item.reference} · `:''}{new Date(item.date).toLocaleString('en-GB')}</div></li>)}</ol>}
  </section>;
}
