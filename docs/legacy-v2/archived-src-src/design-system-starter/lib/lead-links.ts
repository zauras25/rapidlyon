import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const uuid = z.string().uuid();
export type LeadTokenScope = 'invite' | 'qi' | 'qd';
const scopes: readonly LeadTokenScope[] = ['invite','qi','qd'];

function secret() {
  const key = process.env.LEAD_LINK_SECRET?.trim() || process.env.DISCOVERY_SESSION_SECRET?.trim();
  if (!key || key.length < 32) return null;
  return key;
}
export function leadLinksConfigured() { return Boolean(secret()); }

// A token carries only its purpose, opaque UUID and expiry. No name/email is in the URL.
export function createLeadToken(scope: LeadTokenScope, id: string, ttlSeconds: number) {
  const key=secret();
  if (!key || !uuid.safeParse(id).success || !scopes.includes(scope) || !Number.isInteger(ttlSeconds) || ttlSeconds<1) return null;
  const expires=Math.floor(Date.now()/1000)+ttlSeconds;
  const payload=`${scope}.${id}.${expires}`;
  const signature=createHmac('sha256',key).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
export function verifyLeadToken(token: unknown, scope: LeadTokenScope): string | null {
  const key=secret();
  if (!key || typeof token!=='string' || token.length>250 || !scopes.includes(scope)) return null;
  const parts=token.split('.');
  if (parts.length!==4) return null;
  const [purpose,id,expiry,signature]=parts;
  if (purpose!==scope || !uuid.safeParse(id).success || !/^\d{10}$/.test(expiry)) return null;
  const expires=Number(expiry);
  if (expires<=Math.floor(Date.now()/1000) || expires>Math.floor(Date.now()/1000)+91*86400) return null;
  const expected=createHmac('sha256',key).update(`${purpose}.${id}.${expiry}`).digest();
  const provided=Buffer.from(signature,'base64url');
  if (provided.length!==expected.length || !timingSafeEqual(provided,expected)) return null;
  return id;
}
