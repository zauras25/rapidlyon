import 'server-only';
import { z } from 'zod';
import type { SupabaseServerConfig } from '@/lib/supabase-server';

const followUpSchema=z.object({id:z.string().uuid(),serial_no:z.string(),follow_up_at:z.string(),status:z.string()});
export type DueFollowUp=z.infer<typeof followUpSchema>&{kind:'inquiry'|'discovery'};
export async function getDueFollowUps(config:SupabaseServerConfig,limit=100):Promise<DueFollowUp[]> {
  const dueAt=new Date().toISOString();
  const headers={apikey:config.serviceRoleKey,Authorization:`Bearer ${config.serviceRoleKey}`};
  const makeQuery=(closed:string)=>new URLSearchParams({
    select:'id,serial_no,follow_up_at,status',follow_up_at:`lte.${dueAt}`,status:`neq.${closed}`,
    archived_at:'is.null',order:'follow_up_at.asc',limit:String(limit),
  });
  const [inquiries,discovery]=await Promise.all([
    fetch(`${config.url}/rest/v1/inquiries?${makeQuery('closed')}`,{headers,cache:'no-store',signal:AbortSignal.timeout(7000)}),
    fetch(`${config.url}/rest/v1/discovery_submissions?${makeQuery('Closed')}`,{headers,cache:'no-store',signal:AbortSignal.timeout(7000)}),
  ]);
  if(!inquiries.ok||!discovery.ok) throw new Error('Due follow-up lookup failed');
  const [a,b]=await Promise.all([inquiries.json(),discovery.json()]);
  return [...z.array(followUpSchema).parse(a).map(x=>({...x,kind:'inquiry' as const})),
    ...z.array(followUpSchema).parse(b).map(x=>({...x,kind:'discovery' as const}))]
    .sort((l,r)=>l.follow_up_at.localeCompare(r.follow_up_at));
}
