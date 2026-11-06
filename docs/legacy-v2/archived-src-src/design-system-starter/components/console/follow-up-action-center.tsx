'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
type Reminder={id:string;kind:'inquiry'|'discovery';serial_no:string;status:string;follow_up_at:string};
export function FollowUpActionCenter(){
  const [records,setRecords]=useState<Reminder[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    fetch('/api/admin/action-center',{cache:'no-store'})
      .then(async r=>{const v=await r.json();if(!r.ok)throw new Error(v.message||'Unavailable');return v})
      .then(v=>setRecords(v.records||[])).catch(e=>setError(e instanceof Error?e.message:'Unable to load reminders'))
      .finally(()=>setLoading(false));
  },[]);
  return <div className="content-card" style={{marginTop:18}}><h3>Due follow-ups</h3>
    {loading?<p>Checking due work…</p>:error?<p role="status">{error}</p>:records.length===0?<p>No overdue lead follow-ups found in the first 100 records per category.</p>:<>
      <p className="form-hint">Assigned to: Studio admin · resolve each reminder in its record</p>
      <ul style={{padding:0,listStyle:'none',display:'grid',gap:8}}>{records.slice(0,12).map(x=><li key={`${x.kind}-${x.id}`}>
        <Link href={x.kind==='inquiry'?'/admin/inquiries':'/admin/discovery'} className="btn btn-outline btn-sm" style={{width:'100%',justifyContent:'space-between'}}>{x.serial_no} · {x.status} · Due {new Date(x.follow_up_at).toLocaleDateString('en-GB')}</Link>
      </li>)}</ul>{records.length>12&&<p className="form-hint">{records.length-12} more due. Open Inquiries or Discovery to review.</p>}</>}
  </div>;
}
