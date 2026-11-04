'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type PublicStatus={reference:string;status:string;receivedAt:string};

async function loadRequestStatus(token:string|null, signal:AbortSignal):Promise<PublicStatus>{
  if(!token)throw new Error('A private status link is required.');
  const response=await fetch(`/api/request-status?token=${encodeURIComponent(token)}`,{cache:'no-store',signal});
  const body=await response.json();
  if(!response.ok)throw new Error(body.message||'Could not load status.');
  return body as PublicStatus;
}
export function RequestStatus(){
  const [status,setStatus]=useState<PublicStatus|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    const token=new URL(window.location.href).searchParams.get('token');
    // Remove the bearer token before other navigation or URL sharing.
    if(token)window.history.replaceState(null,'','/request-status');
    void loadRequestStatus(token,controller.signal)
      .then(result=>{if(!controller.signal.aborted)setStatus(result);})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load status.');})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>controller.abort();
  },[]);
  return <section className="section-tight"><div className="shell" style={{maxWidth:660}}><div className="content-card" role="status">
    <h1 style={{fontSize:'var(--text-h3)'}}>Request status</h1>
    {busy?<p>Loading your request…</p>:error?<p>{error}</p>:status?<dl className="detail-grid"><div><dt>Reference</dt><dd>{status.reference}</dd></div><div><dt>Current status</dt><dd>{status.status}</dd></div><div><dt>Received</dt><dd>{new Date(status.receivedAt).toLocaleDateString('en-US')}</dd></div></dl>:null}
    <p className="form-hint">This page shows a limited public-safe status only. It does not confirm acceptance, project start or payment.</p>
    <Link className="btn btn-outline btn-sm" href="/contact">Contact the studio</Link>
  </div></div></section>;
}
