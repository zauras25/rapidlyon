import {NextResponse} from 'next/server';
import {z} from 'zod';
import {isDiscoveryAdmin,isSameOriginRequest} from '@/lib/discovery-auth';
import {readBoundedJson} from '@/lib/request-body';
import {adminTable} from '@/lib/admin-data';
import {checkRateLimit,rateLimitFailure} from '@/lib/rate-limit';
const settingSchema=z.object({
 business_name:z.string().trim().min(1).max(120),contact_email:z.union([z.literal(''),z.string().email().max(254)]),
 public_website:z.union([z.literal(''),z.string().url().max(500).refine(u=>u.startsWith('https://'))]),
 display_currency:z.enum(['PKR','USD']),digest_frequency:z.enum(['daily','weekly','off']),routine_email_alerts:z.boolean(),
}).strict();
export async function GET(){
 if(!(await isDiscoveryAdmin()))return NextResponse.json({message:'Unauthorized'},{status:401});
 try {const items=await adminTable('admin_workspace_settings',new URLSearchParams({select:'setting_id,business_name,contact_email,public_website,display_currency,digest_frequency,routine_email_alerts,updated_at',setting_id:'eq.owner',limit:'1'}));return NextResponse.json({settings:items[0]??null},{headers:{'Cache-Control':'private, no-store'}})}
 catch{return NextResponse.json({message:'Workspace settings unavailable. Check staging migration.'},{status:503})}
}
export async function PATCH(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({message:'Unverified origin'},{status:403});
 if(!(await isDiscoveryAdmin()))return NextResponse.json({message:'Unauthorized'},{status:401});
 const limit=await checkRateLimit(request,'admin-settings-edit',12,900);if(!limit.allowed)return rateLimitFailure(limit);
 const body=await readBoundedJson(request,5000);if(!body.ok)return NextResponse.json({message:'Invalid settings request'},{status:400});
 const parsed=settingSchema.safeParse(body.value);if(!parsed.success)return NextResponse.json({message:'Review the business settings fields.',errors:parsed.error.flatten().fieldErrors},{status:400});
 try {const items=await adminTable('admin_workspace_settings',new URLSearchParams({select:'*'}),'PATCH',{...parsed.data,updated_at:new Date().toISOString()},'owner');if(!items.length)return NextResponse.json({message:'Settings record missing; apply staging migration first.'},{status:404});return NextResponse.json({settings:items[0]})}
 catch{return NextResponse.json({message:'Could not save configuration.'},{status:503})}
}
