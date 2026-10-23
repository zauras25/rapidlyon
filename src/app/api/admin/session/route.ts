import { NextResponse } from "next/server";
import {
  createAdminSession,
  discoveryAdminConfigured,
  discoverySessionCookie,
  isSameOriginRequest,
  verifyAdminPassword,
} from "@/lib/discovery-auth";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }

  const rateLimit = await checkRateLimit(request, "admin-login", 5, 15 * 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  if (!discoveryAdminConfigured()) {
    return NextResponse.json(
      { success: false, message: "Admin sign-in is not configured. Set the required discovery admin environment variables." },
      { status: 503 },
    );
  }

  if (!getSupabaseServerConfig()) {
    return NextResponse.json(
      { success: false, message: "Supabase is not connected. Configure SUPABASE_URL and the server-only SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const requestBody = await readBoundedJson(request, 2 * 1024);
  if (!requestBody.ok) {
    return NextResponse.json({ success: false, message: "Submit a valid sign-in request." }, { status: 400 });
  }

  const password = typeof requestBody.value === "object" && requestBody.value !== null && "password" in requestBody.value
    ? (requestBody.value as { password?: unknown }).password
    : null;

  if (typeof password !== "string" || password.length > 256 || !verifyAdminPassword(password)) {
    return NextResponse.json({ success: false, message: "Password is incorrect." }, { status: 401 });
  }

  const { token, expiresAt } = createAdminSession();
  const response = NextResponse.json({ success: true });
  response.cookies.set(discoverySessionCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(expiresAt * 1000),
  });
  return response;
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(discoverySessionCookie);
  return response;
}
