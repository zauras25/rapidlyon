import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthenticatedClient,
} from "@/lib/client-auth";
import { isSameOriginRequest } from "@/lib/discovery-auth";
import {
  CommercialError,
  readCommercialRows,
  sendCommercialEmail,
} from "@/lib/commercial";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const rowSchema = z.record(z.string(), z.unknown());
const actionSchema = z.object({
  action: z.enum(["accept_proposal", "decline_proposal", "accept_agreement"]),
  id: z.string().uuid(),
});
const resultSchema = z.record(z.string(), z.unknown());

// Only shared lifecycle states and client-facing fields may leave this endpoint.
const clientRecordPolicies = {
  project_proposals: {
    states: "sent,viewed,accepted,declined,expired",
    fields: "id,client_id,project_id,proposal_number,title,summary,scope,deliverables,exclusions,timeline,milestones,payment_schedule,amount,currency,status,expires_at,sent_at,viewed_at,accepted_at,declined_at,created_at,updated_at",
  },
  project_agreements: {
    states: "sent,accepted,declined,superseded",
    fields: "id,client_id,project_id,proposal_id,version,terms,status,sent_at,accepted_at,declined_at,created_at,updated_at",
  },
  invoices: {
    states: "sent,viewed,pending,paid,overdue,cancelled,refunded",
    fields: "id,client_id,project_id,proposal_id,agreement_id,invoice_number,status,issue_date,due_date,currency,subtotal,discount,tax,total,notes,payment_instructions,sent_at,viewed_at,paid_at,cancelled_at,created_at,updated_at",
  },
} as const;

async function clientRows(table: keyof typeof clientRecordPolicies, clientId: string) {
  const policy = clientRecordPolicies[table];
  return readCommercialRows(table, new URLSearchParams({
    select: policy.fields,
    client_id: `eq.${clientId}`,
    status: `in.(${policy.states})`,
    order: "created_at.desc",
    limit: "500",
  }), rowSchema);
}

async function markViewed(table: "project_proposals" | "invoices", id: string, clientId: string) {
  const config = getSupabaseServerConfig();
  if (!config) return;
  const statusColumn = table === "project_proposals" ? "sent" : "sent";
  const timestampColumn = table === "project_proposals" ? "viewed_at" : "viewed_at";
  const query = new URLSearchParams({
    id: `eq.${id}`,
    client_id: `eq.${clientId}`,
    status: `eq.${statusColumn}`,
  });
  const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status: "viewed", [timestampColumn]: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error(`Commercial ${table} view timestamp could not be recorded.`);
  }
}

export async function GET(request: Request) {
  try {
    const client = await getAuthenticatedClient(request);
    if (!client) {
      return NextResponse.json({ success: false, message: "This account is not connected to a client workspace." }, { status: 403 });
    }
    const [proposals, agreements, invoices] = await Promise.all([
      clientRows("project_proposals", client.clientId),
      clientRows("project_agreements", client.clientId),
      clientRows("invoices", client.clientId),
    ]);
    const projectIds = [...new Set(
      [...proposals, ...agreements, ...invoices]
        .map((record) => record.project_id)
        .filter((id): id is string => typeof id === "string"),
    )];
    const projectNames = projectIds.length
      ? await readCommercialRows("client_projects", new URLSearchParams({
          select: "id,name",
          client_id: `eq.${client.clientId}`,
          id: `in.(${projectIds.join(",")})`,
        }), z.object({ id: z.string().uuid(), name: z.string() }))
      : [];
    const nameByProject = new Map(projectNames.map((project) => [project.id, project.name]));
    const withProjectNames = (records: typeof proposals) =>
      records.map((record) => ({
        ...record,
        project_name: typeof record.project_id === "string"
          ? nameByProject.get(record.project_id) ?? ""
          : "",
      }));
    const invoiceIds = invoices.map((invoice) => invoice.id).filter((id): id is string => typeof id === "string");
    const [lineItems, payments] = invoiceIds.length
      ? await Promise.all([
          readCommercialRows("invoice_line_items", new URLSearchParams({
            select: "id,invoice_id,client_id,position,description,quantity,unit_price,line_total",
            client_id: `eq.${client.clientId}`,
            invoice_id: `in.(${invoiceIds.join(",")})`,
            order: "position.asc",
          }), rowSchema),
          readCommercialRows("invoice_payments", new URLSearchParams({
            select: "id,invoice_id,client_id,amount,currency,status,created_at,completed_at",
            client_id: `eq.${client.clientId}`,
            invoice_id: `in.(${invoiceIds.join(",")})`,
            order: "created_at.desc",
            limit: "500",
          }), rowSchema),
        ])
      : [[], []];

    await Promise.all([
      ...proposals
        .filter((record) => record.status === "sent" && typeof record.id === "string")
        .map((record) => markViewed("project_proposals", record.id as string, client.clientId)),
      ...invoices
        .filter((record) => record.status === "sent" && typeof record.id === "string")
        .map((record) => markViewed("invoices", record.id as string, client.clientId)),
    ]);
    return NextResponse.json({
      success: true,
      client: { name: client.name, email: client.email },
      proposals: withProjectNames(proposals),
      agreements: withProjectNames(agreements),
      invoices: withProjectNames(invoices),
      lineItems,
      payments,
      paymentAvailable: false,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error instanceof CommercialError ? error : new CommercialError("Billing information could not be loaded.");
    return NextResponse.json({ success: false, message: failure.message }, { status: failure.status });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "This request could not be verified." }, { status: 403 });
  }
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Choose an available action and try again." }, { status: 400 });
  }
  try {
    const client = await getAuthenticatedClient(request);
    if (!client) {
      return NextResponse.json({ success: false, message: "This account is not connected to a client workspace." }, { status: 403 });
    }
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    const config = getSupabaseServerConfig();
    if (!publishableKey || !config) {
      return NextResponse.json({ success: false, message: "This billing action is unavailable right now." }, { status: 503 });
    }
    const rpcName = parsed.data.action === "accept_proposal"
      ? "accept_project_proposal"
      : parsed.data.action === "decline_proposal"
        ? "decline_project_proposal"
        : "accept_project_agreement";
    const parameter = parsed.data.action === "accept_agreement"
      ? "p_agreement_id"
      : "p_proposal_id";
    const response = await fetch(`${config.url}/rest/v1/rpc/${rpcName}`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [parameter]: parsed.data.id }),
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error(`Client commercial action failed (${response.status}): ${details.slice(0, 300)}`);
      return NextResponse.json({
        success: false,
        message: "This item is no longer available for this action. Refresh your billing page.",
      }, { status: response.status === 401 ? 401 : 409 });
    }
    const payload: unknown = await response.json().catch(() => null);
    const result = resultSchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json({ success: false, message: "The action could not be confirmed. Contact the studio before retrying." }, { status: 502 });
    }

    const actionLabel = parsed.data.action === "accept_proposal"
      ? "proposal accepted"
      : parsed.data.action === "decline_proposal"
        ? "proposal declined"
        : "agreement accepted";
    const recordName = parsed.data.action === "accept_agreement" ? "agreement" : "proposal";
    const recordRows = await readCommercialRows(
      parsed.data.action === "accept_agreement" ? "project_agreements" : "project_proposals",
      new URLSearchParams({ select: "*", id: `eq.${parsed.data.id}`, client_id: `eq.${client.clientId}`, limit: "1" }),
      rowSchema,
    );
    const record = recordRows[0];
    const admins = process.env.DISCOVERY_NOTIFICATION_TO?.trim();
    if (admins) {
      await sendCommercialEmail({
        to: admins,
        subject: `Client ${actionLabel}`,
        heading: `A client ${actionLabel}`,
        message: `${client.name} ${actionLabel} for a project in the Rapidlyon workspace.`,
        actionLabel: "Open billing",
        actionUrl: "/admin/billing",
        idempotencyKey: `client-commercial-${parsed.data.action}-${parsed.data.id}`,
      });
    }
    if (parsed.data.action !== "decline_proposal") {
      await sendCommercialEmail({
        to: client.email,
        subject: `We recorded your ${recordName} response`,
        heading: parsed.data.action === "accept_agreement" ? "Agreement accepted" : "Proposal accepted",
        message: `Your response has been recorded securely for ${typeof record?.title === "string" ? record.title : "your project"}.`,
        actionLabel: "View your billing",
        actionUrl: "/client/billing",
        idempotencyKey: `client-commercial-confirmation-${parsed.data.action}-${parsed.data.id}`,
      });
    }
    return NextResponse.json({ success: true, result: result.data });
  } catch (error) {
    const failure = error instanceof CommercialError ? error : new CommercialError("The billing action could not be completed.");
    return NextResponse.json({ success: false, message: failure.message }, { status: failure.status });
  }
}