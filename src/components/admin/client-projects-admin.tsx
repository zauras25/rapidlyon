"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

const projectsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    status: z.enum([
      "draft",
      "invited",
      "active",
      "paused",
      "completed",
      "cancelled",
    ]),
    client: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    milestones: z.array(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
        description: z.string(),
        position: z.number().int(),
        status: z.enum([
          "upcoming",
          "active",
          "client_review",
          "approved",
          "completed",
        ]),
        client_approved_at: z.string().datetime({ offset: true }).nullable(),
        admin_approved_at: z.string().datetime({ offset: true }).nullable(),
        start_date: z.string().nullable(),
        due_date: z.string().nullable(),
      }),
    ),
  }),
);

type ClientProjects = z.infer<typeof projectsSchema>;
type MilestoneAction =
  | "start"
  | "submit_for_review"
  | "approve"
  | "complete";

const milestoneLabels = {
  upcoming: "Coming up",
  active: "In progress",
  client_review: "Awaiting confirmations",
  approved: "Both confirmed",
  completed: "Completed",
} as const;

const projectLabels = {
  draft: "Ready to invite",
  invited: "Invitation sent",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
} as const;

export function ClientProjectsAdmin() {
  const router = useRouter();
  const [projects, setProjects] = useState<ClientProjects>([]);
  const [loading, setLoading] = useState(true);
  const [busyMilestone, setBusyMilestone] = useState("");
  const [busyInvitation, setBusyInvitation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/client-projects", {
        cache: "no-store",
      });

      const payload = await response.json();

      if (response.status === 401) {
        router.replace("/admin/discovery/login");
        return;
      }

      if (!response.ok || payload?.success !== true) {
        throw new Error(
          payload?.message || "Client projects could not be loaded.",
        );
      }

      const parsed = projectsSchema.safeParse(payload.projects);

      if (!parsed.success) {
        throw new Error(
          "Client projects were returned in an unexpected format.",
        );
      }

      setProjects(parsed.data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Client projects could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Synchronize the admin list with the server after navigation and transitions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjects();
  }, [loadProjects]);

  async function sendInvitation(projectId: string) {
    setBusyInvitation(projectId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/client-projects/${projectId}/invitation`,
        {
          method: "POST",
        },
      );

      const payload = await response.json();

      if (!response.ok || payload?.success !== true) {
        throw new Error(
          payload?.message || "Client invitation could not be sent.",
        );
      }

      setNotice("Client invitation sent successfully.");
      await loadProjects();
    } catch (invitationError) {
      setError(
        invitationError instanceof Error
          ? invitationError.message
          : "Client invitation could not be sent.",
      );
    } finally {
      setBusyInvitation("");
    }
  }

  async function transition(
    projectId: string,
    milestoneId: string,
    action: MilestoneAction,
  ) {
    setBusyMilestone(milestoneId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/projects/${projectId}/milestones/${milestoneId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );

      const payload = await response.json();

      if (!response.ok || payload?.success !== true) {
        throw new Error(
          payload?.message || "Milestone could not be updated.",
        );
      }

      setNotice("Milestone updated.");
      await loadProjects();
    } catch (transitionError) {
      setError(
        transitionError instanceof Error
          ? transitionError.message
          : "Milestone could not be updated.",
      );
    } finally {
      setBusyMilestone("");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-label text-muted">
            Private · Client delivery
          </p>

          <h1 className="mt-2 text-3xl font-semibold">Client projects</h1>

          <p className="mt-2 text-sm text-body-muted">
            Prepare projects, send client invitations, and manage delivery milestones.
          </p>

          <nav
            aria-label="Admin sections"
            className="mt-4 flex flex-wrap gap-4 text-sm font-medium"
          >
            <Link
              href="/admin"
              className="underline underline-offset-4"
            >
              Operations
            </Link>

            <Link
              href="/admin/discovery"
              className="underline underline-offset-4"
            >
              Project submissions
            </Link>

            <Link
              href="/admin/projects"
              className="underline underline-offset-4"
            >
              Portfolio projects
            </Link>

            <Link
              href="/admin/reviews"
              className="underline underline-offset-4"
            >
              Reviews
            </Link>

            <Link
              href="/admin/clients"
              aria-current="page"
              className="text-ink"
            >
              Client projects
            </Link>
          </nav>
        </div>
      </div>

      {notice ? (
        <p
          role="status"
          className="mt-5 rounded-xl border border-success-line bg-success-soft p-4 text-sm text-success-strong"
        >
          {notice}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-deep"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-body-muted">
          Loading client projects…
        </p>
      ) : null}

      {!loading && projects.length === 0 ? (
        <p className="mt-8 rounded-xl border border-divider bg-surface p-6 text-sm text-body-muted">
          No client projects are available yet.
        </p>
      ) : null}

      <div className="mt-8 space-y-6">
        {projects.map((project) => {
          const canInvite = project.status === "draft";

          return (
            <section
              key={project.id}
              className="rounded-card border border-divider bg-surface p-5 shadow-card sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{project.name}</h2>

                  <p className="mt-1 text-sm text-body-muted">
                    {project.client.name} ·{" "}
                    <a
                      href={`mailto:${project.client.email}`}
                      className="underline underline-offset-2"
                    >
                      {project.client.email}
                    </a>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-divider px-3 py-1 text-xs font-medium">
                    {projectLabels[project.status]}
                  </span>

                  {canInvite ? (
                    <button
                      type="button"
                      disabled={busyInvitation === project.id}
                      onClick={() => void sendInvitation(project.id)}
                      className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyInvitation === project.id
                        ? "Sending…"
                        : "Invite client"}
                    </button>
                  ) : null}
                </div>
              </div>

              {project.status === "invited" ? (
                <p className="mt-4 rounded-xl border border-divider bg-surface-soft p-4 text-sm text-body-muted">
                  Invitation sent. The project will become active after the
                  client accepts the invitation.
                </p>
              ) : null}

              {project.milestones.length ? (
                <ol className="mt-5 divide-y divide-divider border-t border-divider">
                  {project.milestones.map((milestone) => {
                    const action =
                      milestone.status === "upcoming"
                        ? "start"
                        : milestone.status === "active"
                          ? "submit_for_review"
                          : milestone.status === "client_review"
                            ? "approve"
                            : milestone.status === "approved"
                              ? "complete"
                              : null;

                    const actionLabel =
                      action === "start"
                        ? "Start milestone"
                        : action === "submit_for_review"
                          ? "Send to client for review"
                          : action === "approve"
                            ? milestone.admin_approved_at
                              ? "Studio confirmed"
                              : "Confirm as studio"
                            : action === "complete"
                              ? "Complete and move forward"
                              : null;

                    return (
                      <li
                        key={milestone.id}
                        className="flex flex-wrap items-start justify-between gap-4 py-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">
                              {milestone.title}
                            </h3>

                            <span className="rounded-full border border-divider px-2.5 py-1 text-xs">
                              {milestoneLabels[milestone.status]}
                            </span>
                          </div>

                          {milestone.description ? (
                            <p className="mt-2 text-sm leading-6 text-body-muted">
                              {milestone.description}
                            </p>
                          ) : null}

                          {milestone.status === "client_review" ? (
                            <p className="mt-2 text-xs text-body-muted">
                              Client:{" "}
                              {milestone.client_approved_at
                                ? "confirmed"
                                : "waiting"}{" "}
                              · Studio:{" "}
                              {milestone.admin_approved_at
                                ? "confirmed"
                                : "waiting"}
                            </p>
                          ) : null}
                        </div>

                        {action && actionLabel ? (
                          <button
                            type="button"
                            disabled={
                              busyMilestone === milestone.id ||
                              (action === "approve" &&
                                Boolean(milestone.admin_approved_at))
                            }
                            onClick={() =>
                              void transition(
                                project.id,
                                milestone.id,
                                action,
                              )
                            }
                            className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyMilestone === milestone.id
                              ? "Saving…"
                              : actionLabel}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="mt-5 border-t border-divider pt-4 text-sm text-body-muted">
                  No milestones have been added to this project yet.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
