import "server-only";

import {
  discoveryNotificationStatusSchema,
  type DiscoverySubmission,
} from "@/lib/discovery";
import type { SupabaseServerConfig } from "@/lib/supabase-server";

export type DiscoveryNotificationStatus = typeof discoveryNotificationStatusSchema.options[number];

type ClaimableStatus = Exclude<DiscoveryNotificationStatus, "sent">;

type NotificationAttemptResult =
  | { status: "sent" | "failed" }
  | { status: "not_claimed" | "tracking_failed" };

const emailAddressPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const staleSendingMilliseconds = 10 * 60 * 1000;

function notificationConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipient = process.env.DISCOVERY_NOTIFICATION_TO?.trim();
  const sender = process.env.DISCOVERY_NOTIFICATION_FROM?.trim();

  if (
    !apiKey ||
    !recipient ||
    !sender ||
    !emailAddressPattern.test(recipient) ||
    !emailAddressPattern.test(sender)
  ) {
    console.warn("Discovery notification is not configured with a valid Resend key, recipient, and sender.");
    return null;
  }

  return { apiKey, recipient, sender };
}

function indent(value: string) {
  return (value.trim() || "Not provided")
    .replace(/\0/g, "")
    .split(/\r\n?|\n/)
    .map((line) => `  ${line}`)
    .join("\n");
}

function createNotificationText(
  id: string,
  createdAt: string,
  submission: DiscoverySubmission,
) {
  const services = submission.services.join(" + ");
  const budget = submission.budget || "Not provided";
  const timeline = submission.timeline || "Not provided";

  return [
    "New Discovery lead",
    "",
    `Lead reference: ${id}`,
    `Submitted: ${new Date(createdAt).toISOString()}`,
    "",
    "Contact",
    `Name:\n${indent(submission.fullName)}`,
    `Email:\n${indent(submission.email)}`,
    `Company:\n${indent(submission.company)}`,
    "",
    "Engagement",
    `Selected service(s):\n${indent(services)}`,
    `Discovery method:\n${indent(submission.discoveryMethod)}`,
    `Industry / business stage:\n${indent(`${submission.industry} / ${submission.businessStage}`)}`,
    "",
    "Project context",
    `Overview:\n${indent(submission.projectOverview)}`,
    `Objectives:\n${indent(submission.objectives)}`,
    `Must-have features:\n${indent(submission.mustHaveFeatures)}`,
    `Budget:\n${indent(budget)}`,
    `Desired timeline:\n${indent(timeline)}`,
    "",
    "This is a lead notification, not a quote. Review the complete submission and any private attachments in the Discovery admin.",
  ].join("\n");
}

async function sendNotification(
  id: string,
  createdAt: string,
  submission: DiscoverySubmission,
) {
  const configuration = notificationConfiguration();
  if (!configuration) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `discovery-${id}`,
      },
      body: JSON.stringify({
        from: configuration.sender,
        to: [configuration.recipient],
        subject: "New Discovery lead",
        text: createNotificationText(id, createdAt, submission),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`Discovery notification provider returned status ${response.status}.`);
      return false;
    }
    return true;
  } catch {
    console.error("Discovery notification request failed or timed out.");
    return false;
  }
}

export async function attemptDiscoveryNotification(
  config: SupabaseServerConfig,
  id: string,
  createdAt: string,
  submission: DiscoverySubmission,
  expectedStatus: ClaimableStatus,
  expectedUpdatedAt?: string | null,
): Promise<NotificationAttemptResult> {
  const claimTime = new Date().toISOString();
  const claimQuery = new URLSearchParams({
    id: `eq.${id}`,
    notification_status: `eq.${expectedStatus}`,
  });
  if (expectedUpdatedAt) {
    claimQuery.set("notification_updated_at", `eq.${expectedUpdatedAt}`);
  }

  try {
    const claimResponse = await fetch(
      `${config.url}/rest/v1/discovery_submissions?${claimQuery}`,
      {
        method: "PATCH",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          notification_status: "sending",
          notification_updated_at: claimTime,
        }),
        cache: "no-store",
      },
    );

    if (!claimResponse.ok) {
      console.error(`Discovery notification could not be claimed; Supabase returned status ${claimResponse.status}.`);
      return { status: "tracking_failed" };
    }

    const claimedRows: unknown = await claimResponse.json();
    if (!Array.isArray(claimedRows) || claimedRows.length === 0) {
      return { status: "not_claimed" };
    }
  } catch {
    console.error("Discovery notification claim could not be recorded.");
    return { status: "tracking_failed" };
  }

  const sent = await sendNotification(id, createdAt, submission);
  const finalStatus: DiscoveryNotificationStatus = sent ? "sent" : "failed";
  const completeQuery = new URLSearchParams({
    id: `eq.${id}`,
    notification_status: "eq.sending",
    notification_updated_at: `eq.${claimTime}`,
  });

  try {
    const completeResponse = await fetch(
      `${config.url}/rest/v1/discovery_submissions?${completeQuery}`,
      {
        method: "PATCH",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          notification_status: finalStatus,
          notification_updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      },
    );

    if (!completeResponse.ok) {
      console.error(`Discovery notification status update failed with status ${completeResponse.status}.`);
      return { status: "tracking_failed" };
    }

    const updatedRows: unknown = await completeResponse.json();
    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      console.error("Discovery notification result could not be matched to its active attempt.");
      return { status: "tracking_failed" };
    }
  } catch {
    console.error("Discovery notification result could not be recorded.");
    return { status: "tracking_failed" };
  }

  return { status: finalStatus };
}

export function isStaleDiscoveryNotification(
  status: DiscoveryNotificationStatus,
  updatedAt: string | null,
) {
  return status === "sending" &&
    (!updatedAt || Date.now() - new Date(updatedAt).getTime() >= staleSendingMilliseconds);
}
