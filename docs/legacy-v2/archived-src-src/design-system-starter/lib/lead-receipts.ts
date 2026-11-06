import 'server-only';
import { siteConfig } from '@/data/site';
import { createLeadToken, type LeadTokenScope } from '@/lib/lead-links';

export function createPublicStatusUrl(scope:LeadTokenScope,id:string) {
  const token=createLeadToken(scope,id,30*86400);
  if (!token) return null;
  try {
    const url=new URL('/request-status',siteConfig.url);
    if (url.protocol!=='https:' && url.hostname!=='localhost') return null;
    url.searchParams.set('token',token);
    return url.toString();
  } catch {
    console.error('Public site URL is invalid; request receipt link unavailable');
    return null;
  }
}
export async function sendReceiptEmail(recipient:string,reference:string,statusUrl:string|null,kind:'inquiry'|'discovery') {
  const key=process.env.RESEND_API_KEY?.trim();
  const from=process.env.INQUIRY_REPLY_FROM?.trim()||process.env.DISCOVERY_NOTIFICATION_FROM?.trim();
  if (!key || !from) return false;
  const text=`We received your RapidlyOn ${kind} request.\nReference: ${reference}\n\nNext step: our team will review it and respond by email. Submitting a request does not confirm an accepted project or create a payment obligation.${statusUrl?`\n\nCheck the public status of your request (private link, expires in 30 days):\n${statusUrl}`:''}\n\nRapidlyOn`;
  try {
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({from,to:[recipient],subject:`RapidlyOn ${kind} received · ${reference}`,text}),
      cache:'no-store',signal:AbortSignal.timeout(8000),
    });
    if(!response.ok) console.error('Acknowledgement email provider returned',response.status);
    return response.ok; // Accepted by provider, NOT proof of delivery.
  } catch(error) {console.error('Acknowledgement email not accepted by provider',error);return false;}
}
