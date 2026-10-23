import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const discoverySessionCookie = "rapidlyon_discovery_admin";
const sessionDurationSeconds = 60 * 60 * 8;

function getSessionSecret() {
  const secret = process.env.DISCOVERY_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftDigest = Buffer.from(left);
  const rightDigest = Buffer.from(right);
  return leftDigest.length === rightDigest.length && timingSafeEqual(leftDigest, rightDigest);
}

export function discoveryAdminConfigured() {
  return Boolean(
    process.env.DISCOVERY_ADMIN_PASSWORD &&
      process.env.DISCOVERY_ADMIN_PASSWORD.length >= 16 &&
      getSessionSecret(),
  );
}

export function verifyAdminPassword(password: string) {
  const configuredPassword = process.env.DISCOVERY_ADMIN_PASSWORD;
  const secret = getSessionSecret();

  if (!configuredPassword || configuredPassword.length < 16 || !secret) {
    return false;
  }

  return safeEqual(sign(password, secret), sign(configuredPassword, secret));
}

export function createAdminSession() {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("DISCOVERY_SESSION_SECRET must contain at least 32 characters.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationSeconds;
  const payload = String(expiresAt);
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt };
}

export function verifyAdminSession(token: string | undefined) {
  const secret = getSessionSecret();
  if (!token || !secret) return false;

  const [expiresAt, signature, extra] = token.split(".");
  if (!expiresAt || !signature || extra || !/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;

  return safeEqual(signature, sign(expiresAt, secret));
}

export async function isDiscoveryAdmin() {
  const token = (await cookies()).get(discoverySessionCookie)?.value;
  return verifyAdminSession(token);
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
