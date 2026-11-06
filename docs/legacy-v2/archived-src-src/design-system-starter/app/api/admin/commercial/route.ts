import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import {
  callCommercialRpc,
  CommercialError,
  readCommercialRows,
  uuidSchema,
} from "@/lib/commercial";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";

const rowSchema = z.record(z.string(), z.unknown());
const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.string().regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0),
  unit_price: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
});
const proposalSchema = z.object({
  kind: z.literal("proposal"),
  client_id: uuidSchema,
  project_id: uuidSchema,
  proposal_number: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(5000).default(""),
  scope: z.record(z.string(), z.unknown()).default({}),
  deliverables: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  exclusions: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  timeline: z.record(z.string(), z.unknown()).default({}),
  milestones: z.array(z.record(z.string(), z.unknown())).max(50).default([]),
  payment_schedule: z.array(z.record(z.string(), z.unknown())).max(20).default([]),
  amount: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  notes: z.string().max(5000).default(""),
  expires_at: z.string().datetime({ offset: true }).nullable().default(null),
});
const agreementSchema = z.object({
  kind: z.literal("agreement"),
  client_id: uuidSchema,
  project_id: uuidSchema,
  proposal_id: uuidSchema,
  version: z.number().int().positive().max(1000),
  terms: z.string().trim().min(1).max(20000),
});
const invoiceSchema = z.object({
  kind: z.literal("invoice"),
  client_id: uuidSchema,
  project_id: uuidSchema,
  proposal_id: uuidSchema.nullable().default(null),
  agreement_id: uuidSchema.nullable().default(null),
  invoice_number: z.string().trim().min(1).max(80),
  issue_date: z.string().date(),
  due_date: z.string().date(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  discount: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/).default("0"),
  tax: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/).default("0"),
  notes: z.string().max(5000).default(""),
  payment_instructions: z.string().max(3000).default(""),
  line_items: z.array(lineItemSchema).min(1).max(100),
});

const outputRowSchema = z.union([rowSchema, z.array(rowSchema)]);

async function readRows(table: string, select: string) {
  return readCommercialRows(table, new URLSearchParams({
    select,
    order: "created_at.desc",
    limit: "500",
  }), rowSchema);
}

export async function GET() {
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in as an administrator." }, { status: 401 });
  }
  try {
    const [clients, projects, proposals, agreements, invoices, items, payments] =
      await Promise.all([
        readRows("clients", "id,name,email,status"),
        readRows("client_projects", "id,client_id,name,status,currency"),
        readRows("project_proposals", "*"),
        readRows("project_agreements", "*"),
        readRows("invoices", "*"),
        readRows("invoice_line_items", "*"),
        readRows("invoice_payments", "id,invoice_id,client_id,provider,provider_transaction_id,amount,currency,status,payment_method,created_at,completed_at"),
      ]);
    return NextResponse.json({
      success: true,
      clients: clients.filter((client) => client.status === "active"),
      projects,
      proposals,
      agreements,
      invoices,
      lineItems: items,
      payments,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error instanceof CommercialError
      ? error
      : new CommercialError("Billing records could not be loaded.");
    return NextResponse.json({ success: false, message: failure.message }, { status: failure.status });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "This request could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in as an administrator." }, { status: 401 });
  }
  const limit = await checkRateLimit(request, "admin-commercial-create", 30, 900);
  if (!limit.allowed) return rateLimitFailure(limit);

  const text = await request.text();
  if (text.length > 30_000) {
    return NextResponse.json({ success: false, message: "The submitted record is too large." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ success: false, message: "The submitted data could not be read." }, { status: 400 });
  }
  const parsed = z.discriminatedUnion("kind", [
    proposalSchema,
    agreementSchema,
    invoiceSchema,
  ]).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      message: "Check the highlighted billing details and try again.",
      errors: parsed.error.flatten().fieldErrors,
    }, { status: 400 });
  }
  if (parsed.data.kind === "invoice" && parsed.data.due_date < parsed.data.issue_date) {
    return NextResponse.json({ success: false, message: "The due date must be on or after the issue date." }, { status: 400 });
  }

  try {
    const data = parsed.data;
    const record = data.kind === "invoice"
      ? {
          ...data,
          line_items: undefined,
        }
      : data;
    const items = data.kind === "invoice"
      ? data.line_items.map((item, position) => ({ ...item, position }))
      : [];
    const result = await callCommercialRpc(
      "create_admin_commercial_record",
      { p_kind: data.kind, p_record: record, p_items: items },
      outputRowSchema,
    );
    return NextResponse.json({ success: true, record: Array.isArray(result) ? result[0] : result }, { status: 201 });
  } catch (error) {
    const failure = error instanceof CommercialError
      ? error
      : new CommercialError("The billing record could not be saved.");
    return NextResponse.json({ success: false, message: failure.message }, { status: failure.status });
  }
}