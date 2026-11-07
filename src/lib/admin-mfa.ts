import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const challengeSeconds = 300;
function secret(){const v=process.env.DISCOVERY_SESSION_SECRET;return v&&v.length>=32?v:null}
function decodeBase32(input:string){
 const normalized=input.replace(/[\s-]/g,'').replace(/=+$/,'').toUpperCase();
 if(!/^[A-Z2-7]{26,}$/.test(normalized))return null;
 let bits=0,acc=0;const output:number[]=[];
 for(const c of normalized){const index='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);acc=(acc<<5)|index;bits+=5;if(bits>=8){bits-=8;output.push((acc>>bits)&255)}}
 return output.length>=16?Buffer.from(output):null;
}
export function adminMfaConfigured(){return Boolean(decodeBase32(process.env.DISCOVERY_ADMIN_TOTP_SECRET??''))}
function sign(value:string){const key=secret();if(!key)return null;return createHmac('sha256',key).update('admin-mfa-challenge:'+value).digest('base64url')}
export function createMfaChallenge(){
 const until=Math.floor(Date.now()/1000)+challengeSeconds;
 const payload=`${until}.${randomBytes(20).toString('base64url')}`;
 const signature=sign(payload);if(!signature)throw new Error('Admin session secret missing');
 return {token:`${payload}.${signature}`,expiresAt:until};
}
export function validMfaChallenge(token:string|undefined){
 if(!token)return false;const parts=token.split('.');if(parts.length!==3||!/^[0-9]{10}$/.test(parts[0])||!/^[-_a-zA-Z0-9]{20,}$/.test(parts[1]))return false;
 if(Number(parts[0])<=Date.now()/1000)return false;
 const signature=sign(`${parts[0]}.${parts[1]}`);if(!signature)return false;
 const a=Buffer.from(parts[2]);const b=Buffer.from(signature);
 return a.length===b.length&&timingSafeEqual(a,b);
}
function totp(secretKey:Buffer,timeStep:number){
 const data=Buffer.alloc(8);data.writeBigUInt64BE(BigInt(timeStep));
 const mac=createHmac('sha1',secretKey).update(data).digest();const offset=mac[mac.length-1]&15;
 const n=(mac.readUInt32BE(offset)&0x7fffffff)%1000000;
 return n.toString().padStart(6,'0');
}
export function verifyAdminTotp(code:string){
 const key=decodeBase32(process.env.DISCOVERY_ADMIN_TOTP_SECRET??'');
 if(!key||!/^[0-9]{6}$/.test(code))return false;
 const step=Math.floor(Date.now()/30000);
 const provided=Buffer.from(code);
 return [-1,0,1].some(delta=>{const expected=Buffer.from(totp(key,step+delta));return timingSafeEqual(provided,expected)});
}
