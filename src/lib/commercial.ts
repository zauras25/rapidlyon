import "server-only";

import { z } from "zod";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export const uuidSchema = z.string().uuid();
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);
export const commercialKindSchema = z.enum(["proposal", "agreement", "invoice"]);

export class CommercialError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

function serviceHeaders() {
  const config = getSupabaseServerConfig();
  if (!config) throw new CommercialError("Billing is not available right now.", 503);
  return {
    config,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  };
}

export async function readCommercialRows<T>(
  table: string,
  query: URLSearchParams,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const { config, headers } = serviceHeaders();
  let response: Response;
  try {
    response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new CommercialError("Billing information could not be loaded.", 503);
  }
  if (!response.ok) {
    console.error(`Commercial ${table} lookup failed with status ${response.status}.`);
    throw new CommercialError("Billing information could not be loaded.");
  }
  const payload: unknown = await response.json().catch(() => null);
  const parsed = schema.array().safeParse(payload);
  if (!parsed.success) {
    console.error(`Commercial ${table} data failed validation.`);
    throw new CommercialError("Billing information could not be processed.");
  }
  return parsed.data;
}

export async function callCommercialRpc<T>(
  functionName: string,
  parameters: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const { config, headers } = serviceHeaders();
  let response: Response;
  try {
    response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers,
      body: JSON.stringify(parameters),
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new CommercialError("The requested billing update could not be completed.", 503);
  }
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error(`Commercial action ${functionName} failed (${response.status}): ${details.slice(0, 300)}`);
    const status = response.status === 409 ? 409 : 400;
    throw new CommercialError("The billing record could not be updated. Refresh and try again.", status);
  }
  const result: unknown = await response.json().catch(() => null);
  const parsed = schema.safeParse(result);
  if (!parsed.success) {
    console.error(`Commercial action ${functionName} returned an invalid result.`);
    throw new CommercialError("The billing update could not be confirmed.");
  }
  return parsed.data;
}

export async function sendCommercialEmail(input: {
  to: string;
  subject: string;
  heading: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
  idempotencyKey: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.DISCOVERY_NOTIFICATION_FROM?.trim();
  if (!apiKey || !from) {
    console.warn("Commercial email was not sent because Resend is not configured.");
    return false;
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) {
    console.error("Commercial email was not sent because NEXT_PUBLIC_SITE_URL is missing.");
    return false;
  }
  let origin: string;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    console.error("Commercial email was not sent because NEXT_PUBLIC_SITE_URL is invalid.");
    return false;
  }
  let action: URL;
  try {
    action = new URL(input.actionUrl, origin);
    if (action.origin !== origin || !action.pathname.startsWith("/")) {
      throw new Error("outside site");
    }
  } catch {
    console.error("Commercial email was not sent because its action URL is invalid.");
    return false;
  }

  const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] ?? character);
  const safeHeading = escapeHtml(input.heading);
  const safeMessage = escapeHtml(input.message);
  const safeLabel = escapeHtml(input.actionLabel);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: `${input.heading}\n\n${input.message}\n\n${input.actionLabel}: ${action.toString()}\n\nRapidlyon`,
        html: `<div style="background:#f5f5ef;padding:40px 16px;font-family:Arial,sans-serif;color:#171916"><div style="max-width:560px;margin:0 auto;background:#fff;padding:36px;border:1px solid #e8e9e4"><p style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#557b25">RAPIDLYON</p><h1 style="font-size:26px;line-height:1.2">${safeHeading}</h1><p style="font-size:16px;line-height:1.7;color:#4f544d">${safeMessage}</p><p style="margin:28px 0"><a href="${escapeHtml(action.toString())}" style="display:inline-block;background:#171916;color:#fff;text-decoration:none;padding:13px 20px;font-weight:bold">${safeLabel}</a></p><p style="font-size:12px;line-height:1.6;color:#73776d">If the button does not work, open this link: ${escapeHtml(action.toString())}</p><hr style="border:0;border-top:1px solid #e8e9e4;margin:28px 0"><p style="font-size:12px;color:#73776d">Rapidlyon · Questions? Reply to this email or contact the studio.</p></div></div>`,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`Commercial email provider returned status ${response.status}.`);
      return false;
    }
    return true;
  } catch {
    console.error("Commercial email provider request failed or timed out.");
    return false;
  }
}