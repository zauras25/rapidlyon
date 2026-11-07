import {NextResponse} from 'next/server';
import {z} from 'zod';
import {isDiscoveryAdmin,isSameOriginRequest} from '@/lib/discovery-auth';
import {readBoundedJson} from '@/lib/request-body';
import {adminTable} from '@/lib/admin-data';
import {checkRateLimit,rateLimitFailure} from '@/lib/rate-limit';
const uuid=z.string().uuid();
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await isDiscoveryAdmin()))return NextResponse.json({message:'Unauthorized'},{status:401});
 const {id}=await params;if(!uuid.safeParse(id).success)return NextResponse.json({message:'Invalid client ID'},{status:400});
 try {const notes=await adminTable('client_relationship_notes',new URLSearchParams({select:'id,client_id,content,created_at,created_by',client_id:`eq.${id}`,order:'created_at.desc',limit:'100'}));return NextResponse.json({notes},{headers:{'Cache-Control':'private, no-store'}})}
 catch{return NextResponse.json({message:'Client notes unavailable. Confirm staging migration.'},{status:503})}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isSameOriginRequest(request))return NextResponse.json({message:'Unverified origin'},{status:403});
 if(!(await isDiscoveryAdmin()))return NextResponse.json({message:'Unauthorized'},{status:401});
 const {id}=await params;if(!uuid.safeParse(id).success)return NextResponse.json({message:'Invalid client ID'},{status:400});
 const limit=await checkRateLimit(request,'admin-client-notes',30,900);if(!limit.allowed)return rateLimitFailure(limit);
 const body=await readBoundedJson(request,5000);if(!body.ok)return NextResponse.json({message:'Invalid note'},{status:400});
 const parsed=z.object({content:z.string().trim().min(1).max(4000)}).strict().safeParse(body.value);
 if(!parsed.success)return NextResponse.json({message:'Note must contain between 1 and 4000 characters.'},{status:400});
 try {const notes=await adminTable('client_relationship_notes',new URLSearchParams({select:'*'}),'POST',[{client_id:id,content:parsed.data.content,created_by:'owner'}]);return NextResponse.json({note:notes[0]},{status:201})}
 catch{return NextResponse.json({message:'Could not save note. Check client and migration.'},{status:503})}
}
