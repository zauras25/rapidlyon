import { NextResponse } from "next/server";
import { z } from "zod";
import {
  attemptDiscoveryNotification,
  isStaleDiscoveryNotification,
} from "@/lib/discovery-notification";
import { discoveryNotificationStatusSchema, discoverySubmissionSchema } from "@/lib/discovery";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
const recordSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  submission: discoverySubmissionSchema,
  notification_status: discoveryNotificationStatusSchema,
  notification_updated_at: z.string().datetime().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to retry this notification." }, { status: 401 });
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, message: "Invalid submission ID." }, { status: 400 });
  }

  const rateLimit = await checkRateLimit(request, "admin-discovery-notification", 10, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  const query = new URLSearchParams({
    id: `eq.${id}`,
    select: "id,created_at,submission,notification_status,notification_updated_at",
  });

  try {
    const response = await fetch(`${config.url}/rest/v1/discovery_submissions?${query}`, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Supabase discovery notification lookup failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "The notification could not be retried." }, { status: 502 });
    }

    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: "Submission not found." }, { status: 404 });
    }

    const record = recordSchema.safeParse(rows[0]);
    if (!record.success) {
      console.error("Stored Discovery notification data did not match the expected format.");
      return NextResponse.json({ success: false, message: "The notification could not be retried." }, { status: 502 });
    }

    const { notification_status: status, notification_updated_at: updatedAt } = record.data;
    if (status === "sent") {
      return NextResponse.json({ success: false, message: "This notification has already been sent." }, { status: 409 });
    }
    if (status === "sending" && !isStaleDiscoveryNotification(status, updatedAt)) {
      return NextResponse.json({ success: false, message: "This notification is already being attempted." }, { status: 409 });
    }

    const attempt = await attemptDiscoveryNotification(
      config,
      record.data.id,
      record.data.created_at,
      record.data.submission,
      status,
      updatedAt,
    );

    if (attempt.status === "not_claimed") {
      return NextResponse.json({ success: false, message: "The notification was already claimed by another attempt." }, { status: 409 });
    }
    if (attempt.status !== "sent") {
      return NextResponse.json(
        { success: false, message: "The lead remains saved, but its notification was not sent. You can retry it from the admin." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Discovery notification sent.",
      notification_status: "sent",
      notification_updated_at: new Date().toISOString(),
    });
  } catch {
    console.error("Supabase discovery notification retry failed.");
    return NextResponse.json({ success: false, message: "The notification could not be retried." }, { status: 502 });
  }
}
