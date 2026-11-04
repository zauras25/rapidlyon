import { NextResponse } from 'next/server';
import { getSupabaseServerConfig } from '@/lib/supabase-server';
import { verifyLeadToken } from '@/lib/lead-links';
import { readInvitableInquiry } from '@/lib/lead-lookup';

const noStore={'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer'};
export async function GET(request:Request) {
  const token=new URL(request.url).searchParams.get('token');
  const id=verifyLeadToken(token,'invite');
  if (!id) return NextResponse.json({message:'Invitation invalid or expired. Please contact the studio.'},{status:410,headers:noStore});
  const config=getSupabaseServerConfig();
  if (!config) return NextResponse.json({message:'Invitation lookup is not configured.'},{status:503,headers:noStore});
  try {
    const {lead,claimed}=await readInvitableInquiry(config,id);
    if (!lead || lead.archived_at || claimed) return NextResponse.json({message:'This invitation is no longer available.'},{status:410,headers:noStore});
    return NextResponse.json({name:lead.name,email:lead.email,company:lead.company??''},{headers:noStore});
  }catch(error){console.error('Lead invitation lookup failed',error);return NextResponse.json({message:'Invitation service temporarily unavailable.'},{status:502,headers:noStore});}
}
