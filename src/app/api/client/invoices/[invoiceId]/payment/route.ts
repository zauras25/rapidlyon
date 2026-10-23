import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedClient } from "@/lib/client-auth";
import { isSameOriginRequest } from "@/lib/discovery-auth";

type RouteContext = { params: Promise<{ invoiceId: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "This request could not be verified." }, { status: 403 });
  }
  const { invoiceId } = await context.params;
  if (!z.string().uuid().safeParse(invoiceId).success) {
    return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
  }
  try {
    const client = await getAuthenticatedClient(request);
    if (!client) {
      return NextResponse.json({ success: false, message: "Sign in to continue." }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ success: false, message: "Billing is temporarily unavailable." }, { status: 503 });
  }
  return NextResponse.json({
    success: false,
    message: "Online payments are not configured. No payment was started and no invoice status was changed.",
  }, { status: 503 });
}