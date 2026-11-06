import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthenticatedSupabaseUser,
  getClientForAuthenticatedUser,
} from "@/lib/client-auth";
import { summarizeProjectMilestones } from "@/lib/project-milestones";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import { discoveryStatuses } from "@/lib/discovery";

const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  service_type: z.string(),
  status: z.enum(["active", "paused", "completed"]),
  package_key: z.string().nullable(),
  package_snapshot: z.record(z.string(), z.unknown()),
  agreed_scope: z.record(z.string(), z.unknown()),
  start_date: z.string().nullable(),
  target_completion_date: z.string().nullable(),
  completed_at: z.string().datetime({ offset: true }).nullable(),
  updated_at: z.string().datetime({ offset: true }),
});

const milestoneSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
  status: z.enum(["upcoming", "active", "client_review", "approved", "completed"]),
  client_approved_at: z.string().datetime({ offset: true }).nullable(),
  admin_approved_at: z.string().datetime({ offset: true }).nullable(),
  start_date: z.string().nullable(),
  due_date: z.string().nullable(),
});

const discoveryRequestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(discoveryStatuses),
  qualification_status: z.enum(["unqualified", "qualified"]),
  created_at: z.string().datetime({ offset: true }),
  next_action: z.string().nullable(),
  follow_up_at: z.string().nullable(),
});

const deliverableSchema = z.object({
  id: z.string().uuid(),
  milestone_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string(),
  status: z.enum([
    "draft",
    "in_progress",
    "ready_for_review",
    "changes_requested",
    "approved",
    "completed",
  ]),
  submitted_at: z.string().datetime({ offset: true }).nullable(),
});

const deliverableFeedbackSchema = z.object({
  id: z.string().uuid(),
  deliverable_id: z.string().uuid(),
  message: z.string(),
  created_at: z.string().datetime({ offset: true }),
});

const scopeChangeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["requested", "approved", "rejected"]),
  created_at: z.string().datetime({ offset: true }),
  reviewed_at: z.string().datetime({ offset: true }).nullable(),
});

const projectReviewSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  rating: z.number().int().min(1).max(5),
  review: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string().datetime({ offset: true }),
});

class WorkspaceDataError extends Error {
  constructor(
    message: string,
    readonly resource: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

const activitySchema = z.object({
  event_type: z.enum([
    "project_created",
    "invitation_sent",
    "invitation_accepted",
    "milestone_activated",
    "milestone_started",
    "milestone_submitted_for_review",
    "milestone_approved",
    "milestone_client_approved",
    "milestone_reopened_for_changes",
    "deliverable_submitted",
    "deliverable_ready_for_review",
    "deliverable_changes_requested",
    "deliverable_resubmitted",
    "client_feedback_received",
    "deliverable_approved",
    "deliverable_completed",
    "scope_change_requested",
    "scope_change_approved",
    "scope_change_rejected",
    "milestone_completed",
    "project_completed",
    "project_review_submitted",
  ]),
  details: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime({ offset: true }),
});

const activityMessages = {
  project_created: "Your project workspace was created",
  invitation_sent: "Your project invitation was sent",
  invitation_accepted: "You joined the project workspace",
  milestone_activated: "A project step started",
  milestone_started: "A project step started",
  milestone_submitted_for_review: "A project step is ready for your review",
  milestone_approved: "A project step was approved",
  milestone_client_approved: "You confirmed a project step",
  milestone_reopened_for_changes: "A project step returned to work after feedback",
  deliverable_submitted: "A deliverable was shared",
  deliverable_ready_for_review: "A deliverable is ready for your review",
  deliverable_changes_requested: "You requested changes to a deliverable",
  deliverable_resubmitted: "A deliverable was updated for another review",
  client_feedback_received: "Project feedback was received",
  deliverable_approved: "A deliverable was approved",
  deliverable_completed: "A deliverable was completed",
  scope_change_requested: "You requested a scope change",
  scope_change_approved: "A scope change was approved",
  scope_change_rejected: "A scope change was reviewed",
  milestone_completed: "A project step was completed",
  project_completed: "The project was completed",
  project_review_submitted: "You submitted a project review",
} as const;

function getAccessToken(request: Request) {
  const match = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) =>
    typeof item === "string" && item.trim()
      ? [item.trim().slice(0, 500)]
      : [],
  );
}

function safeScope(
  packageSnapshot: Record<string, unknown>,
  agreedScope: Record<string, unknown>,
  packageKey: string | null,
) {
  const overview = ["summary", "overview", "description"]
    .map((key) => agreedScope[key])
    .find((value) => typeof value === "string" && value.trim());
  const packageTitle = ["title", "name", "label"]
    .map((key) => packageSnapshot[key])
    .find((value) => typeof value === "string" && value.trim());
  const packageDescription = ["description", "summary"]
    .map((key) => packageSnapshot[key])
    .find((value) => typeof value === "string" && value.trim());
  const packageItems = ["deliverables", "features", "includes"]
    .flatMap((key) => textValues(packageSnapshot[key]));
  const agreedItems = ["included", "includes", "deliverables", "scope", "features"]
    .flatMap((key) => textValues(agreedScope[key]));
  const limits = ["limits", "revisions", "allowances"]
    .flatMap((key) => textValues(agreedScope[key]));
  const exclusions = ["exclusions", "excluded"]
    .flatMap((key) => textValues(agreedScope[key]));

  return {
    overview:
      typeof overview === "string" && overview.trim()
        ? overview.trim().slice(0, 1000)
        : null,
    packageName:
      typeof packageTitle === "string" && packageTitle.trim()
        ? packageTitle.trim().slice(0, 160)
        : packageKey,
    packageDescription:
      typeof packageDescription === "string" && packageDescription.trim()
        ? packageDescription.trim().slice(0, 1000)
        : null,
    packageItems: [...new Set(packageItems)].slice(0, 20),
    agreedItems: [...new Set(agreedItems)].slice(0, 20),
    limits: [...new Set(limits)].slice(0, 20),
    exclusions: [...new Set(exclusions)].slice(0, 20),
  };
}

async function readOwnedRows<T>(
  url: string,
  accessToken: string,
  publishableKey: string,
  schema: z.ZodType<T>,
  resource: string,
) {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    throw new WorkspaceDataError(
      `Workspace ${resource} request failed: ${error instanceof Error ? error.name : "unknown error"}.`,
      resource,
    );
  }

  if (!response.ok) {
    let code: string | undefined;
    try {
      const payload: unknown = await response.json();
      if (isRecord(payload) && typeof payload.code === "string") code = payload.code;
    } catch {
      code = undefined;
    }
    throw new WorkspaceDataError(
      `Workspace ${resource} request failed with status ${response.status}${code ? ` (${code})` : ""}.`,
      resource,
      response.status,
      code,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new WorkspaceDataError(`Workspace ${resource} response was invalid.`, resource);
  }

  if (!Array.isArray(payload)) throw new WorkspaceDataError(`Workspace ${resource} response was invalid.`, resource);
  return payload.map((row) => {
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      throw new WorkspaceDataError(`Workspace ${resource} response did not match the expected shape.`, resource);
    }
    return parsed.data;
  });
}

export async function GET(request: Request) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: "Sign in to view your workspace." },
      { status: 401 },
    );
  }

  const config = getSupabaseServerConfig();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!config || !publishableKey) {
    return NextResponse.json(
      { success: false, message: "The client workspace is not available right now." },
      { status: 503 },
    );
  }

  try {
    const user = await getAuthenticatedSupabaseUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Sign in to view your workspace." },
        { status: 401 },
      );
    }
    const client = await getClientForAuthenticatedUser(user);
    if (!client) {
      return NextResponse.json(
        { success: false, message: "This account is not connected to a client workspace." },
        { status: 403 },
      );
    }

    const projectsQuery = new URLSearchParams({
      select: "id,name,service_type,status,package_key,package_snapshot,agreed_scope,start_date,target_completion_date,completed_at,updated_at",
      client_id: `eq.${client.clientId}`,
      status: "in.(active,paused,completed)",
      order: "updated_at.desc",
      limit: "50",
    });
    const projects = await readOwnedRows(
      `${config.url}/rest/v1/client_projects?${projectsQuery}`,
      accessToken,
      publishableKey,
      projectSchema,
      "projects",
    );
    const discoveryQuery = new URLSearchParams({
      select: "id,status,qualification_status,created_at,next_action,follow_up_at",
      client_id: `eq.${client.clientId}`,
      order: "created_at.desc",
      limit: "50",
    });
    const discoveryRequests = await readOwnedRows(
      `${config.url}/rest/v1/discovery_submissions?${discoveryQuery}`,
      accessToken,
      publishableKey,
      discoveryRequestSchema,
      "discovery requests",
    );
    const project =
      projects.find((item) => item.status === "active") ??
      projects.find((item) => item.status === "paused") ??
      projects.find((item) => item.status === "completed") ??
      null;

    if (!project) {
      return NextResponse.json(
        { success: true, client: { name: client.name }, project: null, discoveryRequests },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const projectId = encodeURIComponent(project.id);
    const milestonesQuery = new URLSearchParams({
      select: "id,title,description,position,status,client_approved_at,admin_approved_at,start_date,due_date",
      project_id: `eq.${projectId}`,
      order: "position.asc",
    });
    const deliverablesQuery = new URLSearchParams({
      select: "id,milestone_id,title,description,status,submitted_at",
      project_id: `eq.${projectId}`,
      order: "created_at.desc",
      limit: "50",
    });
    const activityQuery = new URLSearchParams({
      select: "event_type,details,created_at",
      project_id: `eq.${projectId}`,
      order: "created_at.desc",
      limit: "12",
    });

    const [milestones, deliverables, activity] = await Promise.all([
      readOwnedRows(
        `${config.url}/rest/v1/project_milestones?${milestonesQuery}`,
        accessToken,
        publishableKey,
        milestoneSchema,
        "milestones",
      ),
      readOwnedRows(
        `${config.url}/rest/v1/project_deliverables?${deliverablesQuery}`,
        accessToken,
        publishableKey,
        deliverableSchema,
        "deliverables",
      ),
      readOwnedRows(
        `${config.url}/rest/v1/project_activity?${activityQuery}`,
        accessToken,
        publishableKey,
        activitySchema,
        "activity",
      ),
    ]);
    const scopeChangesQuery = new URLSearchParams({
      select: "id,title,description,status,created_at,reviewed_at",
      project_id: `eq.${projectId}`,
      order: "created_at.desc",
      limit: "100",
    });
    const scopeChanges = await readOwnedRows(
      `${config.url}/rest/v1/project_scope_changes?${scopeChangesQuery}`,
      accessToken,
      publishableKey,
      scopeChangeSchema,
      "scope changes",
    );
    const projectReviewsQuery = new URLSearchParams({
      select: "id,name,rating,review,status,created_at",
      client_project_id: `eq.${projectId}`,
      client_id: `eq.${client.clientId}`,
      limit: "1",
    });
    const projectReviews = await readOwnedRows(
      `${config.url}/rest/v1/project_reviews?${projectReviewsQuery}`,
      accessToken,
      publishableKey,
      projectReviewSchema,
      "project review",
    );
    const feedbackQuery = new URLSearchParams({
      select: "id,deliverable_id,message,created_at",
      deliverable_id: `in.(${deliverables.map(({ id }) => id).join(",")})`,
      order: "created_at.desc",
      limit: "200",
    });
    let feedback: z.infer<typeof deliverableFeedbackSchema>[] = [];
    let deliverableReviewAvailable = true;
    if (deliverables.length) {
      try {
        feedback = await readOwnedRows(
          `${config.url}/rest/v1/deliverable_feedback?${feedbackQuery}`,
          accessToken,
          publishableKey,
          deliverableFeedbackSchema,
          "deliverable feedback",
        );
      } catch (error) {
        if (
          error instanceof WorkspaceDataError &&
          error.resource === "deliverable feedback" &&
          error.status === 404 &&
          (error.code === "PGRST205" || error.code === "42P01")
        ) {
          deliverableReviewAvailable = false;
          console.error(
            "Client deliverable review is unavailable because public.deliverable_feedback is missing. Apply supabase/migrations/add_deliverable_review_workflow.sql.",
          );
        } else {
          throw error;
        }
      }
    }

    const milestoneTitles = new Map(milestones.map(({ id, title }) => [id, title]));
    const feedbackByDeliverable = new Map<string, typeof feedback>();
    for (const entry of feedback) {
      const entries = feedbackByDeliverable.get(entry.deliverable_id) ?? [];
      entries.push(entry);
      feedbackByDeliverable.set(entry.deliverable_id, entries);
    }
    const progress = summarizeProjectMilestones(milestones, project.status);
    return NextResponse.json(
      {
        success: true,
        client: { name: client.name },
        discoveryRequests,
        project: {
          id: project.id,
          name: project.name,
          service: project.service_type,
          status: project.status,
          startDate: project.start_date,
          targetCompletionDate: project.target_completion_date,
          completedAt: project.completed_at,
          scope: safeScope(
            isRecord(project.package_snapshot) ? project.package_snapshot : {},
            isRecord(project.agreed_scope) ? project.agreed_scope : {},
            project.package_key,
          ),
          milestones: milestones.map((milestone) => ({
            id: milestone.id,
            title: milestone.title,
            description: milestone.description,
            position: milestone.position,
            status: milestone.status,
            clientApprovedAt: milestone.client_approved_at,
            adminApprovedAt: milestone.admin_approved_at,
            start_date: milestone.start_date,
            due_date: milestone.due_date,
          })),
          progress: {
            completed: progress.completed,
            total: progress.total,
            percentage: progress.percentage,
            currentMilestone: progress.currentMilestone
              ? {
                  title: progress.currentMilestone.title,
                  description: progress.currentMilestone.description,
                  position: progress.currentMilestone.position,
                  status: progress.currentMilestone.status,
                  dueDate: progress.currentMilestone.due_date,
                }
              : null,
            nextMilestoneTitle: progress.nextMilestone?.title ?? null,
            nextMessage: progress.nextMessage,
          },
          deliverables: deliverables.map((deliverable) => ({
            id: deliverable.id,
            title: deliverable.title,
            description: deliverable.description,
            status: deliverable.status,
            submitted_at: deliverable.submitted_at,
            milestoneTitle: deliverable.milestone_id
              ? milestoneTitles.get(deliverable.milestone_id) ?? null
              : null,
            feedback: feedbackByDeliverable.get(deliverable.id)?.map((entry) => ({
              id: entry.id,
              message: entry.message,
              created_at: entry.created_at,
            })) ?? [],
          })),
          deliverableReviewAvailable,
          review: projectReviews[0] ?? null,
          scopeChanges,
          handoffMessage: project.status === "completed"
            ? "Your project is complete. The delivered milestones, final deliverables, and approved scope additions remain available below for reference."
            : null,
          activity: activity.map((entry) => ({
            message: entry.event_type === "scope_change_requested" &&
              typeof entry.details.title === "string"
              ? `You requested a scope change: “${entry.details.title}”`
              : activityMessages[entry.event_type],
            isCompletion: entry.event_type === "project_completed" ||
              entry.event_type === "milestone_completed" ||
              entry.event_type === "deliverable_completed",
            created_at: entry.created_at,
          })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Client workspace data could not be loaded.",
      error instanceof WorkspaceDataError
        ? error.message
        : error instanceof Error
          ? error.message
          : "unknown",
    );
    return NextResponse.json(
      { success: false, message: "Your workspace could not be loaded. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
