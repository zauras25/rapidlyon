import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerConfig } from '@/lib/supabase-server';
import { verifyLeadToken } from '@/lib/lead-links';

const privateHeaders={'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer'};
const recordSchema=z.object({serial_no:z.string(),status:z.string(),created_at:z.string()});
function publicStatus(kind:'inquiries'|'discovery_submissions', raw:string) {
  if(kind==='inquiries') return ({new:'Received',reviewing:'Reviewing',contacted:'Contacted',qualified:'Reviewing',closed:'Closed'} as Record<string,string>)[raw]??'Reviewing';
  return ({New:'Received','In Review':'Reviewing','Awaiting Client Information':'Needs information','Meeting Requested':'Meeting requested','Discovery Completed':'Review complete','Proposal In Progress':'Proposal in progress',Closed:'Closed'} as Record<string,string>)[raw]??'Reviewing';
}
export async function GET(request:Request){
  const token=new URL(request.url).searchParams.get('token');
  const inquiryId=verifyLeadToken(token,'qi');const discoveryId=inquiryId?null:verifyLeadToken(token,'qd');
  if(!inquiryId&&!discoveryId) return NextResponse.json({message:'This private status link is invalid or expired.'},{status:410,headers:privateHeaders});
  const config=getSupabaseServerConfig();
  if(!config) return NextResponse.json({message:'Status service is not configured.'},{status:503,headers:privateHeaders});
  const table=inquiryId?'inquiries':'discovery_submissions';const id=inquiryId||discoveryId;
  try {
    const result=await fetch(`${config.url}/rest/v1/${table}?id=eq.${id}&select=serial_no,status,created_at&limit=1`,{
      headers:{apikey:config.serviceRoleKey,Authorization:`Bearer ${config.serviceRoleKey}`},cache:'no-store',signal:AbortSignal.timeout(7000),
    });
    if(!result.ok) throw new Error(`Status lookup HTTP ${result.status}`);
    const rows=z.array(recordSchema).parse(await result.json());
    if(!rows.length) return NextResponse.json({message:'Request not found.'},{status:404,headers:privateHeaders});
    const item=rows[0];
    // Do not expose internal notes, client IDs, budget, email or project details.
    return NextResponse.json({reference:item.serial_no,status:publicStatus(table,item.status),receivedAt:item.created_at},{headers:privateHeaders});
  }catch(error){console.error('Public request status failed',error);return NextResponse.json({message:'Status is temporarily unavailable.'},{status:502,headers:privateHeaders});}
}
