import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const eventSchema=z.object({type:z.string(),data:z.object({email_id:z.string().uuid()})});
function verified(raw:string,request:Request,secret:string){
  const id=request.headers.get("svix-id"),ts=request.headers.get("svix-timestamp"),signature=request.headers.get("svix-signature");
  if(!id||!ts||!signature||!/^[0-9]+$/.test(ts))return false;
  if(Math.abs(Date.now()/1000-Number(ts))>300)return false;
  const key=secret.startsWith("whsec_")?secret.slice(6):secret;
  let digest:Buffer;try{digest=createHmac("sha256",Buffer.from(key,"base64")).update(`${id}.${ts}.${raw}`).digest();}catch{return false;}
  return signature.split(" ").some(piece=>{const encoded=piece.startsWith("v1,")?piece.slice(3):"";
    if(!encoded)return false;try{const given=Buffer.from(encoded,"base64");return given.length===digest.length&&timingSafeEqual(given,digest);}catch{return false;}});
}
function emailAddress(s:string){return s.match(/<([^<>]+)>/)?.[1]?.toLowerCase() ?? s.trim().toLowerCase();}
export async function POST(request:Request){
  const secret=process.env.RESEND_WEBHOOK_SECRET?.trim(),token=process.env.RESEND_API_KEY?.trim(),domain=process.env.INQUIRY_INBOUND_DOMAIN?.trim().toLowerCase();
  const db=getSupabaseServerConfig();
  if(!secret||!token||!domain||!db)return NextResponse.json({message:"Inbound email not configured"},{status:503});
  const raw=await request.text();if(raw.length>128*1024)return new NextResponse(null,{status:413});
  if(!verified(raw,request,secret))return new NextResponse(null,{status:401});
  let obj:unknown;try{obj=JSON.parse(raw);}catch{return new NextResponse(null,{status:400});}
  const event=eventSchema.safeParse(obj);if(!event.success)return new NextResponse(null,{status:400});
  if(event.data.type!=="email.received")return NextResponse.json({ok:true});
  const eid=event.data.data.email_id;
  const received=await fetch(`https://api.resend.com/emails/receiving/${eid}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  if(!received.ok)return NextResponse.json({message:"Could not fetch received message"},{status:503});
  const email=(await received.json()) as {from?:string;to?:string[];text?:string|null;subject?:string};
  const recipients=email.to||[];
  const ids=recipients.map(r=>emailAddress(r)).filter(r=>r.endsWith(`@${domain}`))
    .map(r=>r.match(/^inquiry\+([a-f0-9-]{36})@/)?.[1]).filter((v):v is string=>!!v&&z.uuid().safeParse(v).success);
  if(ids.length!==1)return NextResponse.json({ok:true,ignored:"unmatched recipient"});
  const inquiryId=ids[0];const headers={apikey:db.serviceRoleKey,Authorization:`Bearer ${db.serviceRoleKey}`};
  const lookup=await fetch(`${db.url}/rest/v1/inquiries?id=eq.${inquiryId}&select=id,email,archived_at`,{headers,cache:"no-store"});
  if(!lookup.ok)return NextResponse.json({message:"Lookup failed"},{status:503});
  const rows=(await lookup.json()) as {id:string;email:string;archived_at:string|null}[];
  if(!rows.length||rows[0].archived_at)return NextResponse.json({ok:true,ignored:"unknown or archived inquiry"});
  // Sender equality is routing validation, NOT cryptographic sender authentication (email can be spoofed).
  if(emailAddress(email.from||"")!==rows[0].email.trim().toLowerCase())return NextResponse.json({ok:true,ignored:"unmatched sender"});
  const body=(email.text||"").trim().slice(0,20000);
  if(!body)return NextResponse.json({ok:true,ignored:"no plain text"});
  const insert=await fetch(`${db.url}/rest/v1/inquiry_messages?on_conflict=provider_email_id`,{
    method:"POST",headers:{...headers,"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates,return=minimal"},
    cache:"no-store",body:JSON.stringify({inquiry_id:inquiryId,direction:"inbound",recipient:rows[0].email,body,delivery_status:"sent",provider_email_id:eid})});
  if(!insert.ok){console.error("Inbound inquiry storage failed",insert.status);return NextResponse.json({message:"Storage failed"},{status:503});}
  return NextResponse.json({ok:true});
}
