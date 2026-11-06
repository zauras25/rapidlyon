import 'server-only';
import nodemailer from 'nodemailer';

const address=/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

function sender() {
  return process.env.DISCOVERY_NOTIFICATION_FROM?.trim() || process.env.INQUIRY_REPLY_FROM?.trim() || '';
}

export function discoveryEmailConfigured(): boolean {
  if (!sender()) return false;
  if (process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD) return true;
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendDiscoveryEmail(message:{to:string;subject:string;text:string;reference?:string}): Promise<boolean> {
  const from=sender();
  if (!from || !address.test(message.to)) return false;
  if (process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD) {
    const port=Number(process.env.SMTP_PORT || '465');
    if (![465,587].includes(port)) return false;
    const transport=nodemailer.createTransport({
      host:process.env.SMTP_HOST.trim(), port, secure:port===465,
      requireTLS:port===587,
      auth:{user:process.env.SMTP_USER.trim(),pass:process.env.SMTP_PASSWORD},
      connectionTimeout:12000, greetingTimeout:12000, socketTimeout:15000,
    });
    try {
      await transport.sendMail({from,to:message.to,subject:message.subject,text:message.text});
      return true;
    } catch(error) {
      console.error('Discovery SMTP delivery failed:', error instanceof Error ? error.message : 'Unknown SMTP error');
      return false;
    } finally { transport.close(); }
  }
  const key=process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  try {
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(message.reference?{'Idempotency-Key':message.reference}:{})},
      body:JSON.stringify({from,to:[message.to],subject:message.subject,text:message.text}),
      cache:'no-store',signal:AbortSignal.timeout(12000),
    });
    return response.ok;
  } catch { return false; }
}
