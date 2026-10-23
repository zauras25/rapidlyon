import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin } from "@/lib/discovery-auth";
import { summarizeProjectMilestones } from "@/lib/project-milestones";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const projectStatusSchema = z.enum(["draft", "invited", "active", "paused", "completed", "cancelled"]);
const milestoneSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
  status: z.enum(["upcoming", "active", "client_review", "approved", "completed"]),
  client_approved_at: z.string().nullable(),
  admin_approved_at: z.string().nullable(),
  start_date: z.string().nullable(),
  due_date: z.string().nullable(),
});
const deliverableSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  milestone_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["draft", "in_progress", "ready_for_review", "changes_requested", "approved", "completed"]),
  due_date: z.string().nullable(),
  submitted_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});
const activitySchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  event_type: z.string(),
  details: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});
const invitationSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  client_id: z.string().uuid(),
  email: z.string().email(),
  status: z.enum(["pending", "accepted", "expired", "revoked"]),
  created_at: z.string(),
  expires_at: z.string(),
  accepted_at: z.string().nullable(),
});
const feedbackSchema = z.object({
  id: z.string().uuid(),
  deliverable_id: z.string().uuid(),
  message: z.string(),
  created_at: z.string(),
});
const scopeChangeSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  requested_by: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["requested", "approved", "rejected"]),
  decision_note: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  reviewed_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
const projectReviewSummarySchema = z.object({
  id: z.string().uuid(),
  client_project_id: z.string().uuid(),
  status: z.enum(["pending", "approved", "rejected"]),
  rating: z.number().int().min(1).max(5),
  created_at: z.string(),
});
const projectReviewDetailSchema = projectReviewSummarySchema.extend({
  name: z.string(),
  review: z.string(),
});

async function readRows<T>(
  url: string,
  config: { url: string; serviceRoleKey: string },
  schema: z.ZodType<T>,
): Promise<T[]> {
  const response = await fetch(url, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Admin operations query failed with status ${response.status}.`);
  }
  const payload: unknown = await response.json();
  const parsed = z.array(schema).safeParse(payload);
  if (!parsed.success) throw new Error("Admin operations query returned an invalid response.");
  return parsed.data;
}

export async function GET(request: Request) {
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to view operations." }, { status: 401 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  const params = new URL(request.url).searchParams;
  const projectId = params.get("projectId");
  if (projectId && !z.string().uuid().safeParse(projectId).success) {
    return NextResponse.json({ success: false, message: "Invalid project ID." }, { status: 400 });
  }
  const requestedStatus = params.get("status");
  const status = requestedStatus && requestedStatus !== "all"
    ? projectStatusSchema.safeParse(requestedStatus)
    : null;
  if (requestedStatus && requestedStatus !== "all" && !status?.success) {
    return NextResponse.json({ success: false, message: "Unknown project status." }, { status: 400 });
  }
  const search = (params.get("q") ?? "").trim().slice(0, 100).toLocaleLowerCase();

  try {
    const projectQuery = new URLSearchParams({
      select: "id,client_id,name,service_type,status,package_key,package_snapshot,agreed_price,currency,agreed_scope,start_date,target_completion_date,completed_at,updated_at",
      order: "updated_at.desc",
      limit: "500",
    });
    if (projectId) projectQuery.set("id", `eq.${projectId}`);

    const [
      clients,
      projects,
      discovery,
      invitations,
      reviews,
      scopeChanges,
    ] = await Promise.all([
      readRows(
        `${config.url}/rest/v1/clients?select=id,name,email,status&limit=500`,
        config,
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          email: z.string().email(),
          status: z.string(),
        }),
      ),
      readRows(
        `${config.url}/rest/v1/client_projects?${projectQuery}`,
        config,
        z.object({
          id: z.string().uuid(),
          client_id: z.string().uuid(),
          name: z.string(),
          service_type: z.string(),
          status: projectStatusSchema,
          package_key: z.string().nullable(),
          package_snapshot: z.record(z.string(), z.unknown()),
          agreed_price: z.number().nullable(),
          currency: z.string().nullable(),
          agreed_scope: z.record(z.string(), z.unknown()),
          start_date: z.string().nullable(),
          target_completion_date: z.string().nullable(),
          completed_at: z.string().nullable(),
          updated_at: z.string(),
        }),
      ),
      projectId ? Promise.resolve([]) : readRows(
        `${config.url}/rest/v1/discovery_submissions?select=id,full_name,email,company,services,status,qualification_status,created_at&order=created_at.desc&limit=200`,
        config,
        z.object({
          id: z.string().uuid(),
          full_name: z.string(),
          email: z.string().email(),
          company: z.string(),
          services: z.array(z.string()),
          status: z.string(),
          qualification_status: z.enum(["unqualified", "qualified"]),
          created_at: z.string(),
        }),
      ),
      readRows(
        `${config.url}/rest/v1/project_invitations?select=id,project_id,client_id,email,status,created_at,expires_at,accepted_at&order=created_at.desc&limit=500`,
        config,
        invitationSchema,
      ),
      projectId ? Promise.resolve([]) : readRows(
        `${config.url}/rest/v1/project_reviews?select=id,status&status=eq.pending&limit=500`,
        config,
        z.object({ id: z.string().uuid(), status: z.literal("pending") }),
      ),
      (() => {
        const scopeChangesQuery = new URLSearchParams({
          select: "id,project_id,requested_by,title,description,status,decision_note,reviewed_at,reviewed_by,created_at,updated_at",
          order: "created_at.desc",
          limit: "500",
        });
        if (projectId) scopeChangesQuery.set("project_id", `eq.${projectId}`);
        return readRows(
          `${config.url}/rest/v1/project_scope_changes?${scopeChangesQuery}`,
          config,
          scopeChangeSchema,
        );
      })(),
    ]);

    const clientById = new Map(clients.map((client) => [client.id, client]));
    const projectsWithClients = projects.flatMap((project) => {
      const client = clientById.get(project.client_id);
      return client ? [{ ...project, client }] : [];
    });
    if (projectId && !projectsWithClients.length) {
      return NextResponse.json({ success: false, message: "Project was not found." }, { status: 404 });
    }

    const projectIds = projectsWithClients.map(({ id }) => id);
    const projectReviewQuery = new URLSearchParams({
      select: projectId
        ? "id,client_project_id,status,rating,created_at,name,review"
        : "id,client_project_id,status,rating,created_at",
      client_project_id: `in.(${projectIds.join(",")})`,
    });
    const projectReviews = projectIds.length
      ? projectId
        ? await readRows(
            `${config.url}/rest/v1/project_reviews?${projectReviewQuery}`,
            config,
            projectReviewDetailSchema,
          )
        : await readRows(
            `${config.url}/rest/v1/project_reviews?${projectReviewQuery}`,
            config,
            projectReviewSummarySchema,
          )
      : [];
    const childQuery = (select: string, order?: string) => {
      const query = new URLSearchParams({ select, project_id: `in.(${projectIds.join(",")})` });
      if (order) query.set("order", order);
      return query;
    };
    const [milestones, deliverables, activity] = projectIds.length
      ? await Promise.all([
          readRows(
            `${config.url}/rest/v1/project_milestones?${childQuery("id,project_id,title,description,position,status,client_approved_at,admin_approved_at,start_date,due_date", "position.asc")}`,
            config,
            milestoneSchema,
          ),
          readRows(
            `${config.url}/rest/v1/project_deliverables?${childQuery("id,project_id,milestone_id,title,description,status,due_date,submitted_at,updated_at", "updated_at.desc")}`,
            config,
            deliverableSchema,
          ),
          readRows(
            `${config.url}/rest/v1/project_activity?${childQuery("id,project_id,event_type,details,created_at", "created_at.desc")}&limit=100`,
            config,
            activitySchema,
          ),
        ])
      : [[], [], []];

    const deliverableIds = deliverables.map(({ id }) => id);
    const feedback = deliverableIds.length
      ? await readRows(
          `${config.url}/rest/v1/deliverable_feedback?select=id,deliverable_id,message,created_at&deliverable_id=in.(${deliverableIds.join(",")})&order=created_at.desc&limit=500`,
          config,
          feedbackSchema,
        )
      : [];

    const now = new Date();
    const invitationRows = invitations.map((invitation) => ({
      ...invitation,
      status: invitation.status === "pending" && new Date(invitation.expires_at) <= now
        ? "expired" as const
        : invitation.status,
    }));
    const invitationsByProject = new Map<string, typeof invitationRows>();
    for (const invitation of invitationRows) {
      const rows = invitationsByProject.get(invitation.project_id) ?? [];
      rows.push(invitation);
      invitationsByProject.set(invitation.project_id, rows);
    }
    const milestonesByProject = new Map<string, typeof milestones>();
    for (const milestone of milestones) {
      const rows = milestonesByProject.get(milestone.project_id) ?? [];
      rows.push(milestone);
      milestonesByProject.set(milestone.project_id, rows);
    }
    const deliverablesByProject = new Map<string, typeof deliverables>();
    for (const deliverable of deliverables) {
      const rows = deliverablesByProject.get(deliverable.project_id) ?? [];
      rows.push(deliverable);
      deliverablesByProject.set(deliverable.project_id, rows);
    }
    const scopeChangesByProject = new Map<string, typeof scopeChanges>();
    for (const scopeChange of scopeChanges) {
      const rows = scopeChangesByProject.get(scopeChange.project_id) ?? [];
      rows.push(scopeChange);
      scopeChangesByProject.set(scopeChange.project_id, rows);
    }
    const feedbackByDeliverable = new Map<string, typeof feedback>();
    for (const entry of feedback) {
      const rows = feedbackByDeliverable.get(entry.deliverable_id) ?? [];
      rows.push(entry);
      feedbackByDeliverable.set(entry.deliverable_id, rows);
    }
    const projectReviewByProject = new Map(
      projectReviews.map((review) => [review.client_project_id, review]),
    );

    const projectSummaries = projectsWithClients.map((project) => {
      const projectMilestones = milestonesByProject.get(project.id) ?? [];
      const progress = summarizeProjectMilestones(projectMilestones, project.status === "draft" || project.status === "invited" || project.status === "cancelled" ? "paused" : project.status);
      const projectDeliverables = deliverablesByProject.get(project.id) ?? [];
      const pendingReviews = projectDeliverables.filter((item) => item.status === "ready_for_review");
      const changeRequests = projectDeliverables.filter((item) => item.status === "changes_requested");
      return {
        ...project,
        review: projectReviewByProject.get(project.id) ?? null,
        milestones: projectMilestones,
        progress,
        pendingReviewCount: pendingReviews.length,
        changeRequestCount: changeRequests.length,
        nextAction: project.status === "invited"
          ? "Follow up on the client invitation"
          : project.status === "draft"
            ? "Complete project setup"
            : project.status === "cancelled"
              ? "Project cancelled"
              : changeRequests.length
          ? `Review ${changeRequests.length} change request${changeRequests.length === 1 ? "" : "s"}`
          : pendingReviews.length
            ? `Review ${pendingReviews.length} deliverable${pendingReviews.length === 1 ? "" : "s"}`
            : progress.nextMessage,
        invitations: invitationsByProject.get(project.id) ?? [],
        scopeChanges: scopeChangesByProject.get(project.id) ?? [],
      };
    });

    if (projectId) {
      const project = projectSummaries[0];
      return NextResponse.json({
        success: true,
        project: {
          ...project,
          review: (() => {
            const review = projectReviewByProject.get(project.id);
            return review && "review" in review ? review : null;
          })(),
          deliverables: (deliverablesByProject.get(project.id) ?? []).map((item) => ({
            ...item,
            feedback: feedbackByDeliverable.get(item.id) ?? [],
          })),
          scopeChanges: (scopeChangesByProject.get(project.id) ?? []).map((scopeChange) => ({
            ...scopeChange,
            requester: project.client.name,
          })),
          activity: activity
            .filter((entry) => entry.project_id === project.id)
            .slice(0, 50),
        },
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const filteredProjects = projectSummaries.filter((project) =>
      (!status?.success || project.status === status.data) &&
      (!search || `${project.name} ${project.client.name} ${project.client.email}`.toLocaleLowerCase().includes(search)),
    );
    const today = new Date().toISOString().slice(0, 10);
    const upcomingLimit = new Date();
    upcomingLimit.setUTCDate(upcomingLimit.getUTCDate() + 7);
    const upcomingDate = upcomingLimit.toISOString().slice(0, 10);
    const dueMilestones = milestones
      .filter((milestone) =>
        milestone.status !== "completed" &&
        milestone.due_date !== null &&
        milestone.due_date <= upcomingDate,
      )
      .map((milestone) => ({
        ...milestone,
        overdue: milestone.due_date !== null && milestone.due_date < today,
        project: projectSummaries.find((project) => project.id === milestone.project_id) ?? null,
      }))
      .filter((item) => item.project);
    const pendingDeliverables = deliverables
      .filter((item) => item.status === "ready_for_review" || item.status === "changes_requested")
      .map((item) => ({
        ...item,
        project: projectSummaries.find((project) => project.id === item.project_id) ?? null,
        feedback: feedbackByDeliverable.get(item.id)?.[0] ?? null,
      }))
      .filter((item) => item.project);
    const latestActivity = [...activity]
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .slice(0, 12)
      .map((entry) => ({
        ...entry,
        project: projectSummaries.find((project) => project.id === entry.project_id) ?? null,
      }))
      .filter((entry) => entry.project);
    const pendingInvitations = invitationRows
      .filter((invitation) => invitation.status === "pending")
      .map((invitation) => ({
        ...invitation,
        project: projectSummaries.find((project) => project.id === invitation.project_id) ?? null,
        client: clientById.get(invitation.client_id) ?? null,
      }))
      .filter((item) => item.project && item.client);
    const pendingScopeChanges = scopeChanges
      .filter((scopeChange) => scopeChange.status === "requested")
      .map((scopeChange) => ({
        ...scopeChange,
        project: projectSummaries.find((project) => project.id === scopeChange.project_id) ?? null,
        requester: clientById.get(
          projectsWithClients.find((project) => project.id === scopeChange.project_id)?.client_id ?? "",
        )?.name ?? "Client",
      }))
      .filter((item) => item.project)
      .slice(0, 20);
    const invitationPipeline = invitationRows
      .map((invitation) => ({
        ...invitation,
        project: projectSummaries.find((project) => project.id === invitation.project_id) ?? null,
        client: clientById.get(invitation.client_id) ?? null,
      }))
      .filter((item) => item.project && item.client)
      .sort((left, right) =>
        (left.status === "pending" ? 0 : 1) - (right.status === "pending" ? 0 : 1) ||
        right.created_at.localeCompare(left.created_at),
      )
      .slice(0, 20);
    const activeDiscovery = discovery.filter((submission) =>
      submission.status === "New" || submission.qualification_status === "unqualified",
    );
    const recentDiscovery = activeDiscovery.slice(0, 10);
    const recentReviews = reviews.length;

    return NextResponse.json({
      success: true,
      projects: filteredProjects,
      attention: {
        discovery: recentDiscovery,
        invitations: pendingInvitations,
        scopeChanges: pendingScopeChanges,
        deliverables: pendingDeliverables,
        milestones: dueMilestones,
        pendingReviewCount: recentReviews,
      },
      invitationPipeline,
      invitationCounts: {
        pending: invitationRows.filter((invitation) => invitation.status === "pending").length,
        accepted: invitationRows.filter((invitation) => invitation.status === "accepted").length,
        expired: invitationRows.filter((invitation) => invitation.status === "expired").length,
        revoked: invitationRows.filter((invitation) => invitation.status === "revoked").length,
      },
      activity: latestActivity,
      counts: {
        newDiscovery: discovery.filter((submission) => submission.status === "New").length,
        unqualified: discovery.filter((submission) => submission.qualification_status === "unqualified").length,
        pendingInvitations: pendingInvitations.length,
        pendingScopeChanges: scopeChanges.filter((scopeChange) => scopeChange.status === "requested").length,
        pendingDeliverables: deliverables.filter((item) => item.status === "ready_for_review").length,
        changeRequests: deliverables.filter((item) => item.status === "changes_requested").length,
        dueMilestones: dueMilestones.length,
        activeProjects: projects.filter((project) => project.status === "active").length,
        completedProjects: projects.filter((project) => project.status === "completed").length,
        pendingReviews: recentReviews,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin operations data could not be loaded.", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { success: false, message: "Operations data could not be loaded. Check that the client delivery migrations have been applied." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
