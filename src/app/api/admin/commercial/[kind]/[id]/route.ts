import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import {
  callCommercialRpc,
  CommercialError,
  readCommercialRows,
  sendCommercialEmail,
  uuidSchema,
} from "@/lib/commercial";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";

const paramsSchema = z.object({
  kind: z.enum(["proposal", "agreement", "invoice"]),
  id: uuidSchema,
});
const recordSchema = z.record(z.string(), z.unknown());
const actionSchema = z.object({ action: z.enum(["send", "expire"]) });
const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.string().regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0),
  unit_price: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
});
const proposalDraftSchema = z.object({
  kind: z.literal("proposal"),
  proposal_number: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(5000),
  scope: z.record(z.string(), z.unknown()),
  deliverables: z.array(z.string().trim().min(1).max(500)).max(50),
  exclusions: z.array(z.string().trim().min(1).max(500)).max(50),
  timeline: z.record(z.string(), z.unknown()),
  milestones: z.array(z.record(z.string(), z.unknown())).max(50),
  payment_schedule: z.array(z.record(z.string(), z.unknown())).max(20),
  amount: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  notes: z.string().max(5000),
  expires_at: z.string().datetime({ offset: true }).nullable(),
});
const agreementDraftSchema = z.object({
  kind: z.literal("agreement"),
  terms: z.string().trim().min(1).max(20000),
  version: z.number().int().positive().max(1000),
});
const invoiceDraftSchema = z.object({
  kind: z.literal("invoice"),
  invoice_number: z.string().trim().min(1).max(80),
  issue_date: z.string().date(),
  due_date: z.string().date(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  discount: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
  tax: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
  notes: z.string().max(5000),
  payment_instructions: z.string().max(3000),
  line_items: z.array(lineItemSchema).min(1).max(100),
});

async function lookup(table: string, id: string) {
  return readCommercialRows(table, new URLSearchParams({
    select: "*",
    id: `eq.${id}`,
    limit: "1",
  }), recordSchema);
}

export async function PATCH(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "This request could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in as an administrator." }, { status: 401 });
  }
  const limit = await checkRateLimit(request, "admin-commercial-edit", 40, 900);
  if (!limit.allowed) return rateLimitFailure(limit);

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ success: false, message: "The billing record could not be found." }, { status: 404 });
  }
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
    proposalDraftSchema,
    agreementDraftSchema,
    invoiceDraftSchema,
  ]).safeParse(body);
  if (!parsed.success || parsed.data.kind !== params.data.kind) {
    return NextResponse.json({ success: false, message: "Check the draft details and try again." }, { status: 400 });
  }
  if (parsed.data.kind === "invoice" && parsed.data.due_date < parsed.data.issue_date) {
    return NextResponse.json({ success: false, message: "The due date must be on or after the issue date." }, { status: 400 });
  }

  try {
    const data = parsed.data;
    const record = data.kind === "invoice"
      ? {
          invoice_number: data.invoice_number,
          issue_date: data.issue_date,
          due_date: data.due_date,
          currency: data.currency,
          discount: data.discount,
          tax: data.tax,
          notes: data.notes,
          payment_instructions: data.payment_instructions,
        }
      : data;
    const items = data.kind === "invoice"
      ? data.line_items.map((item, position) => ({ ...item, position }))
      : [];
    const updated = await callCommercialRpc(
      "update_admin_commercial_draft",
      {
        p_kind: data.kind,
        p_id: params.data.id,
        p_record: record,
        p_items: items,
      },
      recordSchema,
    );
    return NextResponse.json({ success: true, record: updated });
  } catch (error) {
    const failure = error instanceof CommercialError
      ? error
      : new CommercialError("The draft could not be saved.");
    return NextResponse.json({ success: false, message: failure.message }, { status: failure.status });
  }
}

export async function POST(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "This request could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in as an administrator." }, { status: 401 });
  }
  const limit = await checkRateLimit(request, "admin-commercial-transition", 40, 900);
  if (!limit.allowed) return rateLimitFailure(limit);

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ success: false, message: "The billing record could not be found." }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success || (params.data.kind !== "proposal" && parsed.data.action === "expire")) {
    return NextResponse.json({ success: false, message: "This action is not available for the selected record." }, { status: 400 });
  }

  try {
    const table = params.data.kind === "proposal"
      ? "project_proposals"
      : params.data.kind === "agreement"
        ? "project_agreements"
        : "invoices";
    const existingRows = await lookup(table, params.data.id);
    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json({ success: false, message: "The billing record could not be found." }, { status: 404 });
    }
    const clientId = typeof existing.client_id === "string" ? existing.client_id : "";
    const clientRows = clientId ? await lookup("clients", clientId) : [];
    const client = clientRows[0];
    if (parsed.data.action === "send" && typeof client?.email !== "string") {
      return NextResponse.json({
        success: false,
        message: "Add a valid client email address before sending this record.",
      }, { status: 400 });
    }

    const row = await callCommercialRpc(
      "transition_admin_commercial_record",
      {
        p_kind: params.data.kind,
        p_id: params.data.id,
        p_action: parsed.data.action,
      },
      recordSchema,
    );
    const projectId = typeof row.project_id === "string" ? row.project_id : "";
    const projectRows = projectId ? await lookup("client_projects", projectId) : [];
    const project = projectRows[0];
    const clientEmail = typeof client?.email === "string" ? client.email : "";
    const clientName = typeof client?.name === "string" ? client.name : "Client";
    const projectName = typeof project?.name === "string" ? project.name : "your project";
    const recordNumber = String(row.proposal_number ?? row.invoice_number ?? "Agreement");
    let emailSent: boolean | null = null;

    if (parsed.data.action === "send") {
      const href = params.data.kind === "proposal"
        ? `/client/billing?proposal=${encodeURIComponent(params.data.id)}`
        : params.data.kind === "agreement"
          ? `/client/billing?agreement=${encodeURIComponent(params.data.id)}`
          : `/client/billing?invoice=${encodeURIComponent(params.data.id)}`;
      emailSent = await sendCommercialEmail({
        to: clientEmail,
        subject: params.data.kind === "proposal"
          ? `Your proposal for ${projectName}`
          : params.data.kind === "agreement"
            ? `Your agreement is ready for ${projectName}`
            : `Invoice ${recordNumber} for ${projectName}`,
        heading: params.data.kind === "proposal"
          ? "Your proposal is ready"
          : params.data.kind === "agreement"
            ? "Your agreement is ready"
            : "Your invoice is ready",
        message: `${clientName}, please review the ${params.data.kind} for ${projectName} in your Rapidlyon workspace.`,
        actionLabel: params.data.kind === "proposal"
          ? "Review proposal"
          : params.data.kind === "agreement"
            ? "Review agreement"
            : "View invoice",
        actionUrl: href,
        idempotencyKey: `commercial-${params.data.kind}-${params.data.id}-sent`,
      });
    }

    return NextResponse.json({
      success: true,
      record: row,
      emailSent,
      message: emailSent === false
        ? "The status was updated, but the email could not be delivered. Contact the client directly."
        : undefined,
    });
  } catch (error) {
    const failure = error instanceof CommercialError
      ? error
      : new CommercialError("The billing record could not be updated.");
    return NextResponse.json({ success: false, message: failure.message }, { status: failure.status });
  }
}