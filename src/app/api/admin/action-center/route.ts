import { NextResponse } from 'next/server';
import { isDiscoveryAdmin } from '@/lib/discovery-auth';
import { getSupabaseServerConfig } from '@/lib/supabase-server';
import { getDueFollowUps } from '@/lib/follow-up-queue';

export async function GET(){
  if(!(await isDiscoveryAdmin())) return NextResponse.json({message:'Unauthorized'},{status:401});
  const config=getSupabaseServerConfig();
  if(!config) return NextResponse.json({message:'Database not configured'},{status:503});
  try {
    const records=await getDueFollowUps(config);
    return NextResponse.json({count:records.length,limited:records.length>=200,records},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){console.error('Admin action center unavailable',error);return NextResponse.json({message:'Unable to load due follow-ups'},{status:502});}
}
