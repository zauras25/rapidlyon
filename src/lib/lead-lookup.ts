import 'server-only';
import { z } from 'zod';
import { supabaseServerHeaders, type SupabaseServerConfig } from '@/lib/supabase-server';

export const inquiryLeadSchema = z.object({
  id: z.string().uuid(), name: z.string(), email: z.string().email(),
  company: z.string().nullable(), serial_no: z.string().nullable(), archived_at: z.string().nullable(),
});
export type InquiryLead = z.infer<typeof inquiryLeadSchema>;
function headers(config:SupabaseServerConfig){return supabaseServerHeaders(config);}
export async function readInvitableInquiry(config:SupabaseServerConfig, id:string):Promise<{lead:InquiryLead|null;claimed:boolean}> {
  const [inquiryResult,linkedResult] = await Promise.all([
    fetch(`${config.url}/rest/v1/inquiries?id=eq.${id}&select=id,name,email,company,serial_no,archived_at&limit=1`,{headers:headers(config),cache:'no-store',signal:AbortSignal.timeout(7000)}),
    fetch(`${config.url}/rest/v1/discovery_submissions?source_inquiry_id=eq.${id}&select=id&limit=1`,{headers:headers(config),cache:'no-store',signal:AbortSignal.timeout(7000)}),
  ]);
  if (!inquiryResult.ok || !linkedResult.ok) throw new Error('Lead lookup unavailable or migration missing');
  const leads = z.array(inquiryLeadSchema).parse(await inquiryResult.json());
  const linked = z.array(z.object({id:z.string().uuid()})).parse(await linkedResult.json());
  return {lead:leads[0]??null,claimed:linked.length>0};
}
