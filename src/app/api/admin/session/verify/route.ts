import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {adminMfaConfigured,validMfaChallenge,verifyAdminTotp} from '@/lib/admin-mfa';
import {createAdminSession,discoverySessionCookie,isSameOriginRequest} from '@/lib/discovery-auth';
import {readBoundedJson} from '@/lib/request-body';
import {checkRateLimit,rateLimitFailure} from '@/lib/rate-limit';

export async function POST(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({message:'Request origin could not be verified'},{status:403});
 const limit=await checkRateLimit(request,'admin-mfa-verification',5,15*60);if(!limit.allowed)return rateLimitFailure(limit);
 if(!adminMfaConfigured())return NextResponse.json({message:'Admin MFA unavailable'},{status:503});
 const pending=(await cookies()).get('rapidlyon_admin_mfa_pending')?.value;
 if(!validMfaChallenge(pending))return NextResponse.json({message:'Verification expired. Sign in again.'},{status:401});
 const body=await readBoundedJson(request,1024);
 const code=body.ok&&typeof body.value==='object'&&body.value!==null&&'code' in body.value?(body.value as {code?:unknown}).code:null;
 if(typeof code!=='string'||!verifyAdminTotp(code))return NextResponse.json({message:'Invalid verification code.'},{status:401});
 const {token,expiresAt}=createAdminSession();
 const response=NextResponse.json({success:true});
 response.cookies.delete('rapidlyon_admin_mfa_pending');
 response.cookies.set(discoverySessionCookie,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',expires:new Date(expiresAt*1000)});
 return response;
}
