import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

const incrementScript = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "return {count <= tonumber(ARGV[2]) and 1 or 0, redis.call('TTL', KEYS[1])}",
].join("\n");

type RateLimitResult =
  | { allowed: true; configured: boolean }
  | { allowed: false; unavailable: boolean; retryAfter?: number };

let missingProductionConfigurationReported = false;

function requestIdentity(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    "unknown"
  );
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint && !token) {
    if (process.env.NODE_ENV === "production") {
      if (!missingProductionConfigurationReported) {
        console.error("Upstash rate limiting is required in production but is not configured.");
        missingProductionConfigurationReported = true;
      }
      return { allowed: false, unavailable: true };
    }
    return { allowed: true, configured: false };
  }
  if (!endpoint || !token) return { allowed: false, unavailable: true };

  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return { allowed: false, unavailable: true };

    const identity = createHmac("sha256", token).update(requestIdentity(request)).digest("hex");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        incrementScript,
        "1",
        `rapidlyon:rate:v1:${scope}:${identity}`,
        String(windowSeconds),
        String(limit),
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return { allowed: false, unavailable: true };
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("result" in payload)) {
      return { allowed: false, unavailable: true };
    }

    const result = (payload as { result: unknown }).result;
    if (!Array.isArray(result) || result.length < 2) return { allowed: false, unavailable: true };
    const allowed = Number(result[0]) === 1;
    return allowed
      ? { allowed: true, configured: true }
      : { allowed: false, unavailable: false, retryAfter: Math.max(1, Number(result[1]) || windowSeconds) };
  } catch {
    return { allowed: false, unavailable: true };
  }
}

export function rateLimitFailure(result: Extract<RateLimitResult, { allowed: false }>) {
  return NextResponse.json(
    {
      success: false,
      message: result.unavailable
        ? "Submission protection is temporarily unavailable. Please try again later."
        : "Too many requests. Please wait before trying again.",
    },
    {
      status: result.unavailable ? 503 : 429,
      headers: result.retryAfter ? { "Retry-After": String(result.retryAfter) } : undefined,
    },
  );
}