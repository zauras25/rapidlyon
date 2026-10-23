"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  CircleCheck,
  Clock3,
  LogOut,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/data/site";
import { getSupabaseClient } from "@/lib/supabase";
import { DeliverableReview } from "@/components/client/deliverable-review";
import { z } from "zod";

const workspaceSchema = z.object({
  success: z.literal(true),
  client: z.object({ name: z.string() }),
  discoveryRequests: z.array(z.object({
    id: z.string().uuid(),
    status: z.enum(["New", "In Review", "Awaiting Client Information", "Meeting Requested", "Discovery Completed", "Proposal In Progress", "Closed"]),
    qualification_status: z.enum(["unqualified", "qualified"]),
    created_at: z.string().datetime({ offset: true }),
    next_action: z.string().nullable(),
    follow_up_at: z.string().nullable(),
  })),
  project: z.object({
    id: z.string().uuid(),
    name: z.string(),
    service: z.string(),
    status: z.enum(["active", "paused", "completed"]),
    startDate: z.string().nullable(),
    targetCompletionDate: z.string().nullable(),
    completedAt: z.string().datetime({ offset: true }).nullable(),
    scope: z.object({
      overview: z.string().nullable(),
      packageName: z.string().nullable(),
      packageDescription: z.string().nullable(),
      packageItems: z.array(z.string()),
      agreedItems: z.array(z.string()),
      limits: z.array(z.string()),
      exclusions: z.array(z.string()),
    }),
    milestones: z.array(z.object({
      id: z.string().uuid(),
      title: z.string(),
      description: z.string(),
      position: z.number().int(),
      status: z.enum(["upcoming", "active", "client_review", "approved", "completed"]),
      clientApprovedAt: z.string().datetime({ offset: true }).nullable(),
      adminApprovedAt: z.string().datetime({ offset: true }).nullable(),
      start_date: z.string().nullable(),
      due_date: z.string().nullable(),
    })),
    progress: z.object({
      completed: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      percentage: z.number().int().min(0).max(100),
      currentMilestone: z.object({
        title: z.string(),
        description: z.string(),
        position: z.number().int(),
        status: z.enum(["upcoming", "active", "client_review", "approved", "completed"]),
        dueDate: z.string().nullable(),
      }).nullable(),
      nextMilestoneTitle: z.string().nullable(),
      nextMessage: z.string(),
    }),
    deliverables: z.array(z.object({
      id: z.string().uuid(),
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
      submitted_at: z.string().nullable(),
      milestoneTitle: z.string().nullable(),
      feedback: z.array(z.object({
        id: z.string().uuid(),
        message: z.string(),
        created_at: z.string().datetime({ offset: true }),
      })),
    })),
    deliverableReviewAvailable: z.boolean(),
    handoffMessage: z.string().nullable(),
    review: z.object({
      id: z.string().uuid(),
      name: z.string(),
      rating: z.number().int().min(1).max(5),
      review: z.string(),
      status: z.enum(["pending", "approved", "rejected"]),
      created_at: z.string().datetime({ offset: true }),
    }).nullable(),
    scopeChanges: z.array(z.object({
      id: z.string().uuid(),
      title: z.string(),
      description: z.string(),
      status: z.enum(["requested", "approved", "rejected"]),
      created_at: z.string().datetime({ offset: true }),
      reviewed_at: z.string().datetime({ offset: true }).nullable(),
    })),
    activity: z.array(z.object({
      message: z.string(),
      isCompletion: z.boolean(),
      created_at: z.string().datetime({ offset: true }),
    })),
  }).nullable(),
});

type Workspace = z.infer<typeof workspaceSchema>;
type ViewState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "not_client" }
  | { status: "error" }
  | { status: "ready"; workspace: Workspace };

const milestoneLabels = {
  upcoming: "Coming up",
  active: "In progress",
  client_review: "Your review",
  approved: "Approved",
  completed: "Completed",
} as const;

const discoveryStatusDescriptions: Record<string, string> = {
  New: "Your request has been received and is waiting for review.",
  "In Review": "The studio is reviewing your request.",
  "Awaiting Client Information": "The studio needs more information from you.",
  "Meeting Requested": "The studio will confirm meeting details with you.",
  "Discovery Completed": "Discovery has been completed.",
  "Proposal In Progress": "The studio is preparing a proposal.",
  Closed: "This request has been closed.",
};

const deliverableLabels = {
  draft: "Preparing",
  in_progress: "In progress",
  ready_for_review: "Ready for review",
  changes_requested: "Changes requested",
  approved: "Approved",
  completed: "Completed",
} as const;

function formatDate(date: string | null) {
  if (!date) return null;
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(parsed);
}

function formatTimestamp(timestamp: string) {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function statusClasses(status: string) {
  if (status === "completed" || status === "approved") {
    return "border-success-line bg-success-soft text-success-strong";
  }
  if (status === "client_review" || status === "ready_for_review") {
    return "border-warning-line bg-warning-soft text-warning-strong";
  }
  if (status === "active" || status === "in_progress") {
    return "border-accent/60 bg-accent-pale text-accent-deep";
  }
  return "border-divider bg-surface-soft text-body";
}

function LoadingWorkspace() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8" aria-label="Loading client workspace" role="status">
      <span className="sr-only">Loading your project workspace…</span>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-paper-raised" />
      <div className="mt-8 h-52 animate-pulse rounded-card bg-paper-raised" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-panel bg-paper-raised" />
        <div className="h-64 animate-pulse rounded-panel bg-paper-raised" />
      </div>
    </div>
  );
}

export function ClientWorkspace() {
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [signingOut, setSigningOut] = useState(false);
  const [approvingMilestone, setApprovingMilestone] = useState("");
  const [milestoneError, setMilestoneError] = useState("");
  const [scopeChangeError, setScopeChangeError] = useState("");
  const [submittingScopeChange, setSubmittingScopeChange] = useState(false);

  useEffect(() => {
    let current = true;
    let requestId = 0;
    let unsubscribe = () => {};

    async function loadWorkspace(accessToken: string | null) {
      const thisRequest = ++requestId;
      if (!accessToken) {
        if (current) setView({ status: "signed_out" });
        return;
      }

      if (current) setView({ status: "loading" });
      try {
        const response = await fetch("/api/client/workspace", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });

        if (!current || thisRequest !== requestId) return;
        if (response.status === 401) {
          setView({ status: "signed_out" });
          return;
        }
        if (response.status === 403) {
          setView({ status: "not_client" });
          return;
        }
        if (!response.ok) {
          setView({ status: "error" });
          return;
        }

        const parsed = workspaceSchema.safeParse(await response.json());
        if (!parsed.success) {
          setView({ status: "error" });
          return;
        }
        setView({ status: "ready", workspace: parsed.data });
      } catch {
        if (current && thisRequest === requestId) setView({ status: "error" });
      }
    }

    void Promise.resolve()
      .then(() => getSupabaseClient())
      .then((supabase) => {
        if (!current) return;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          void loadWorkspace(session?.access_token ?? null);
        });
        unsubscribe = () => subscription.unsubscribe();

        return supabase.auth.getSession().then(({ data, error }) => {
          if (!current) return;
          if (error) {
            setView({ status: "error" });
            return;
          }
          void loadWorkspace(data.session?.access_token ?? null);
        });
      })
      .catch(() => {
        if (current) setView({ status: "error" });
      });

    return () => {
      current = false;
      unsubscribe();
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) {
        setSigningOut(false);
        setView({ status: "error" });
      }
    } catch {
      setSigningOut(false);
      setView({ status: "error" });
    }
  }

  async function approveMilestone(projectId: string, milestoneId: string) {
    setApprovingMilestone(milestoneId);
    setMilestoneError("");
    try {
      const { data: { session }, error } = await getSupabaseClient().auth.getSession();
      if (error) throw error;
      if (!session?.access_token) {
        setView({ status: "signed_out" });
        return;
      }
      const response = await fetch(`/api/client/projects/${projectId}/milestones/${milestoneId}/approval`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || "Your milestone confirmation could not be saved.");
      }
      window.location.reload();
    } catch (error) {
      setMilestoneError(error instanceof Error ? error.message : "Your milestone confirmation could not be saved.");
    } finally {
      setApprovingMilestone("");
    }
  }

  async function requestScopeChange(projectId: string, title: string, description: string) {
    setSubmittingScopeChange(true);
    setScopeChangeError("");
    try {
      const { data: { session }, error } = await getSupabaseClient().auth.getSession();
      if (error) throw error;
      if (!session?.access_token) {
        setView({ status: "signed_out" });
        return;
      }
      const response = await fetch(`/api/client/projects/${projectId}/scope-changes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || "Your scope change request could not be saved.");
      }
      window.location.reload();
    } catch (error) {
      setScopeChangeError(error instanceof Error ? error.message : "Your scope change request could not be saved.");
    } finally {
      setSubmittingScopeChange(false);
    }
  }

  async function submitProjectReview(projectId: string, rating: number, review: string) {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession();
    if (error) throw error;
    if (!session?.access_token) {
      setView({ status: "signed_out" });
      throw new Error("Sign in again to submit your review.");
    }

    const response = await fetch(`/api/client/projects/${projectId}/review`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rating, review }),
    });
    const payload: unknown = await response.json();
    const result = z.object({
      success: z.literal(true),
      review: workspaceSchema.shape.project.unwrap().shape.review.unwrap(),
    }).safeParse(payload);
    if (!response.ok || !result.success) {
      const message = typeof payload === "object" && payload !== null &&
        "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "Your review could not be submitted.";
      throw new Error(message);
    }

    setView((current) => {
      if (current.status !== "ready" || current.workspace.project?.id !== projectId) return current;
      return {
        ...current,
        workspace: {
          ...current.workspace,
          project: { ...current.workspace.project, review: result.data.review },
        },
      };
    });
  }

  if (view.status === "loading") return <LoadingWorkspace />;
  if (view.status === "signed_out") {
    return (
      <CenteredState
        eyebrow="Client workspace"
        title="Sign in to see your project"
        message="Use the Supabase Auth account connected to your project invitation. If you need help accessing your account, contact the studio."
        action={<Link href="/client/login" className="inline-flex rounded-full bg-ink px-5 py-3 text-sm font-medium text-on-dark">Sign in or create account</Link>}
      />
    );
  }
  if (view.status === "not_client") {
    return (
      <CenteredState
        eyebrow="Client workspace"
        title="Your client workspace is not set up yet"
        message="Submit a discovery request while signed in. It will appear here so you can follow its review status."
        action={<Link href="/discovery" className="inline-flex rounded-full bg-ink px-5 py-3 text-sm font-medium text-on-dark">Start a discovery request</Link>}
      />
    );
  }
  if (view.status === "error") {
    return (
      <CenteredState
        eyebrow="Client workspace"
        title="Your workspace could not be loaded"
        message="Please try again in a moment. If the issue continues, contact the studio for help."
        action={<Button onClick={() => window.location.reload()}>Try again</Button>}
      />
    );
  }

  const { client, project, discoveryRequests } = view.workspace;
  return (
    <>
      <header className="border-b border-divider bg-surface">
        <div className="ds-shell flex min-h-18 flex-wrap items-center justify-between gap-3 py-3 sm:gap-4">
          <Link href="/" className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-deep">
            <Image
              src="/brand/rapidlyon-mark.svg"
              alt={siteConfig.brand}
              width={140}
              height={140}
              className="h-10 w-10 sm:h-11 sm:w-11"
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/client/billing"
              className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
            >
              Billing
            </Link>
            <div className="min-w-0 max-w-[12rem] text-right sm:max-w-none">
              <p className="truncate text-sm font-semibold text-ink">{client.name}</p>
              <p className="text-xs text-body-muted">Project workspace</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={signOut}
              disabled={signingOut}
              className="gap-2 px-4 py-2.5"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="hidden sm:inline">{signingOut ? "Signing out…" : "Sign out"}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8" id="workspace-content">
        {discoveryRequests.length ? (
          <section className="mb-7" aria-labelledby="discovery-requests-heading">
            <Card className="p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">Your requests</p>
              <h1 id="discovery-requests-heading" className="mt-2 text-xl font-semibold text-ink">Discovery request status</h1>
              <ul className="mt-5 divide-y divide-divider">
                {discoveryRequests.map((request) => (
                  <li key={request.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-ink">{request.status}</p>
                      <span className="rounded-full border border-divider px-3 py-1 text-xs text-body-muted">
                        {request.qualification_status === "qualified" ? "Qualified" : "Under review"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-body-muted">{discoveryStatusDescriptions[request.status]}</p>
                    {request.next_action ? <p className="mt-2 text-sm text-body"><strong>Next step:</strong> {request.next_action}</p> : null}
                    {request.follow_up_at ? <p className="mt-1 text-xs text-body-muted">Follow-up: {formatDate(request.follow_up_at)}</p> : null}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}
        {project ? (
          <WorkspaceProject
            project={project}
            onApproveMilestone={(milestoneId) => void approveMilestone(project.id, milestoneId)}
            approvingMilestone={approvingMilestone}
            milestoneError={milestoneError}
            onRequestScopeChange={(title, description) => void requestScopeChange(project.id, title, description)}
            submittingScopeChange={submittingScopeChange}
            scopeChangeError={scopeChangeError}
            onSubmitProjectReview={(rating, review) => submitProjectReview(project.id, rating, review)}
          />
        ) : (
          <div className="py-10">
            <CenteredState
              eyebrow="Your project"
              title="Your workspace is ready"
              message="There is no active project to show yet. The studio will update this space when your project is ready to begin."
            />
          </div>
        )}
      </div>
    </>
  );
}

type Project = NonNullable<Workspace["project"]>;

function WorkspaceProject({
  project,
  onApproveMilestone,
  approvingMilestone,
  milestoneError,
  onRequestScopeChange,
  submittingScopeChange,
  scopeChangeError,
  onSubmitProjectReview,
}: {
  project: Project;
  onApproveMilestone: (milestoneId: string) => void;
  approvingMilestone: string;
  milestoneError: string;
  onRequestScopeChange: (title: string, description: string) => void;
  submittingScopeChange: boolean;
  scopeChangeError: string;
  onSubmitProjectReview: (rating: number, review: string) => Promise<void>;
}) {
  const [scopeChangeTitle, setScopeChangeTitle] = useState("");
  const [scopeChangeDescription, setScopeChangeDescription] = useState("");
  const [reviewRating, setReviewRating] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingReview(true);
    setReviewError("");
    setReviewNotice("");
    try {
      await onSubmitProjectReview(Number(reviewRating), reviewText);
      setReviewNotice("Thank you. Your review has been received and is awaiting moderation.");
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Your review could not be submitted.");
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="rounded-card bg-ink p-6 text-on-dark sm:p-9 lg:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-label text-accent">Your project</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-display-tight sm:text-4xl">
              {project.name}
            </h1>
            <p className="mt-2 text-sm text-on-dark/70">{project.service}</p>
          </div>
          <span className="rounded-full border border-on-dark/20 bg-on-dark/10 px-3 py-1.5 text-sm font-medium text-on-dark">
            {project.status === "active" ? "In progress" : project.status === "paused" ? "Paused" : "Completed"}
          </span>
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-on-dark/80 sm:text-base">
          {project.scope.overview ||
            project.scope.packageDescription ||
            "Your project scope and agreed delivery details are kept together here, so you can always see what the work is focused on."}
        </p>
        <div className="mt-7 grid gap-4 border-t border-on-dark/15 pt-5 sm:grid-cols-2">
          {project.startDate && (
            <DateDetail label="Started" date={project.startDate} dark />
          )}
          {project.targetCompletionDate && (
            <DateDetail label="Target completion" date={project.targetCompletionDate} dark />
          )}
        </div>
      </section>

      {project.status === "completed" ? (
        <section aria-labelledby="handoff-heading" className="rounded-card border border-success-line bg-success-soft p-6 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-label text-success-strong">Project handoff</p>
          <h2 id="handoff-heading" className="mt-2 text-2xl font-semibold text-ink">Project completed</h2>
          {project.completedAt ? <p className="mt-2 text-sm text-body">Completed {formatTimestamp(project.completedAt)}.</p> : null}
          <p className="mt-3 text-sm leading-6 text-body">{project.handoffMessage}</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Completed milestones</h3>
              <p className="mt-1 text-sm text-body">{project.milestones.filter((milestone) => milestone.status === "completed").length} of {project.milestones.length} milestones completed.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Final deliverables</h3>
              <p className="mt-1 text-sm text-body">{project.deliverables.filter((deliverable) => deliverable.status === "completed").length} deliverables completed and retained below.</p>
            </div>
          </div>
          {project.scopeChanges.some((change) => change.status === "approved") ? (
            <div className="mt-5 border-t border-success-line pt-4">
              <h3 className="text-sm font-semibold text-ink">Approved scope additions</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-body">
                {project.scopeChanges.filter((change) => change.status === "approved").map((change) => (
                  <li key={change.id}><span className="font-medium">{change.title}:</span> {change.description}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {project.status === "completed" ? (
        <section aria-labelledby="project-review-heading" className="rounded-card border border-divider bg-surface p-6 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">Optional next step</p>
          <h2 id="project-review-heading" className="mt-2 text-xl font-semibold text-ink">How did this project go?</h2>
          <p className="mt-2 text-sm leading-6 text-body-muted">You can leave a short review for the studio. It will be checked before it may be shared publicly.</p>
          {reviewNotice ? <p role="status" className="mt-4 rounded-xl border border-success-line bg-success-soft p-3 text-sm text-success-strong">{reviewNotice}</p> : null}
          {project.review ? (
            <div className="mt-5 rounded-xl border border-divider bg-surface-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-ink">Your review · {project.review.rating} / 5</p>
                <span className="rounded-full border border-divider px-2.5 py-1 text-xs capitalize text-body-muted">
                  {project.review.status === "pending"
                    ? "Awaiting moderation"
                    : project.review.status === "approved"
                      ? "Published"
                      : "Not published"}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-body">{project.review.review}</p>
              <p className="mt-2 text-xs text-body-muted">Submitted {formatTimestamp(project.review.created_at)}</p>
            </div>
          ) : (
            <form className="mt-5 max-w-2xl space-y-4" onSubmit={(event) => void submitReview(event)}>
              {reviewError ? <p role="alert" className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger-deep">{reviewError}</p> : null}
              <label className="block text-sm font-medium text-ink">
                Rating
                <select
                  required
                  value={reviewRating}
                  onChange={(event) => setReviewRating(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-divider-strong bg-surface px-3 py-2.5"
                >
                  <option value="">Choose a rating</option>
                  {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-ink">
                Your review
                <textarea
                  required
                  minLength={20}
                  maxLength={1200}
                  rows={4}
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-divider-strong bg-surface px-3 py-2.5"
                />
                <span className="mt-1 block text-xs font-normal text-body-muted">At least 20 characters. Your review is optional.</span>
              </label>
              <Button type="submit" disabled={submittingReview || !reviewRating || reviewText.trim().length < 20}>
                {submittingReview ? "Submitting review…" : "Submit project review"}
              </Button>
            </form>
          )}
          <div className="mt-6 border-t border-divider pt-5">
            <h3 className="text-sm font-semibold text-ink">Planning another project?</h3>
            <p className="mt-1 text-sm text-body-muted">Start a new conversation through the studio&apos;s existing discovery flow.</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium">
              <Link href="/discovery" className="underline underline-offset-4">Discuss a new project</Link>
              <Link href="/services" className="underline underline-offset-4">Explore services</Link>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <section aria-labelledby="progress-heading">
          <Card className="h-full p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">Project progress</p>
                <h2 id="progress-heading" className="mt-2 text-xl font-semibold text-ink">Where things stand</h2>
              </div>
              {project.milestones.length > 0 && (
                <p className="text-sm text-body">
                  {project.progress.completed} of {project.progress.total} milestones complete
                </p>
              )}
            </div>
            {milestoneError ? <p role="alert" className="mb-4 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-deep">{milestoneError}</p> : null}
            {project.milestones.length ? (
              <div className="mt-6">
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-paper-raised"
                  role="progressbar"
                  aria-label="Project milestone progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={project.progress.percentage}
                >
                  <div
                    className="h-full rounded-full bg-accent-deep transition-[width]"
                  style={{ width: `${project.progress.percentage}%` }}
                  />
                </div>
                <p className="mt-2 text-right text-sm font-semibold text-ink">{project.progress.percentage}%</p>
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-surface-soft p-4 text-sm leading-6 text-body">
                Your project roadmap is being prepared. Milestones will appear here when they are ready.
              </p>
            )}
            <div className="mt-5 flex items-start gap-3 border-t border-divider pt-5">
              <span className="mt-0.5 rounded-full bg-accent-pale p-2 text-accent-deep">
                <CircleDotIcon />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-label text-body-muted">
                  {project.progress.currentMilestone?.status === "active"
                    ? "Currently working on"
                    : project.progress.currentMilestone?.status === "client_review"
                      ? "Current review"
                      : "Current stage"}
                </p>
                <p className="mt-1 font-semibold text-ink">
                  {project.progress.currentMilestone?.title ?? "Roadmap in preparation"}
                </p>
                {project.progress.currentMilestone && (
                  <>
                    {project.progress.currentMilestone.description && (
                      <p className="mt-1 text-sm leading-6 text-body">
                        {project.progress.currentMilestone.description}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-body">
                      {milestoneLabels[project.progress.currentMilestone.status]}
                      {project.progress.currentMilestone.dueDate ? ` · Due ${formatDate(project.progress.currentMilestone.dueDate)}` : ""}
                    </p>
                  </>
                )}
              </div>
            </div>
          </Card>
        </section>

        <section aria-labelledby="next-action-heading">
          <Card className="h-full border-accent/35 bg-accent-pale p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">Next action</p>
            <h2 id="next-action-heading" className="mt-2 text-xl font-semibold text-ink">
              {project.progress.nextMessage}
            </h2>
            <p className="mt-3 text-sm leading-6 text-body">
              {project.status === "completed"
                ? "The project delivery is complete. Your project history and shared deliverables remain available here."
                : project.status === "paused"
                  ? "The project is paused for now. Contact the studio if you have a question about restarting work."
                  : project.progress.currentMilestone?.status === "client_review"
                    ? "A project step is ready for your review. Review shared deliverables below and approve them or request specific changes."
                    : project.progress.currentMilestone?.status === "active"
                      ? "We’re working through the current project step. We’ll let you know when your input is needed."
                      : "The next project step is reflected in the roadmap below."}
            </p>
            {project.status === "paused" && (
              <a className="button-secondary mt-5" href={`mailto:${siteConfig.email}`}>
                Contact the studio <ArrowRight size={16} aria-hidden="true" />
              </a>
            )}
          </Card>
        </section>
      </div>

      <section aria-labelledby="roadmap-heading">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">The roadmap</p>
          <h2 id="roadmap-heading" className="mt-2 text-2xl font-semibold text-ink">Project steps</h2>
        </div>
        {project.milestones.length ? (
          <ol className="space-y-3">
            {project.milestones.map((milestone, index) => {
              const isDone = milestone.status === "completed" || milestone.status === "approved";
              const isCurrent = milestone.position === project.progress.currentMilestone?.position;
              return (
                <li key={`${milestone.position}-${milestone.title}`}>
                  <Card className={`flex gap-4 p-4 sm:gap-5 sm:p-5 ${isCurrent ? "border-accent/50" : ""}`}>
                    <div className="flex w-9 shrink-0 flex-col items-center">
                      <span className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold ${
                        isDone ? "bg-success-soft text-success-strong" : isCurrent ? "bg-ink text-on-dark" : "bg-paper-raised text-body"
                      }`}>
                        {isDone ? <Check size={16} aria-label="Completed" /> : index + 1}
                      </span>
                      {index < project.milestones.length - 1 && (
                        <span className={`mt-2 min-h-8 w-px flex-1 ${isDone ? "bg-success-line" : "bg-divider-strong"}`} aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-ink">{milestone.title}</h3>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(milestone.status)}`}>
                          {milestoneLabels[milestone.status]}
                        </span>
                      </div>
                      {milestone.description && (
                        <p className="mt-2 text-sm leading-6 text-body">{milestone.description}</p>
                      )}
                      {milestone.due_date && (
                        <p className="mt-2 flex items-center gap-2 text-xs text-body-muted">
                          <CalendarDays size={14} aria-hidden="true" />
                          Due {formatDate(milestone.due_date)}
                        </p>
                      )}
                      {milestone.status === "client_review" ? (
                        <div className="mt-4 rounded-xl border border-divider bg-surface-soft p-4">
                          <p className="text-sm text-body">
                            {milestone.clientApprovedAt
                              ? "Your confirmation is recorded."
                              : "This milestone is ready for your review."}{" "}
                            {milestone.adminApprovedAt
                              ? "The studio has also confirmed it."
                              : "The studio must also confirm before it can move forward."}
                          </p>
                          {!milestone.clientApprovedAt ? (
                            <Button
                              type="button"
                              className="mt-3"
                              disabled={approvingMilestone === milestone.id}
                              onClick={() => onApproveMilestone(milestone.id)}
                            >
                              {approvingMilestone === milestone.id ? "Saving confirmation…" : "Confirm this milestone"}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        ) : (
          <Card className="p-6 text-sm leading-6 text-body">
            Your project roadmap is being prepared. The studio will add milestones here as the delivery plan is confirmed.
          </Card>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="deliverables-heading">
          <Card className="h-full p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <PackageCheck size={20} className="text-accent-deep" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">Shared work</p>
                <h2 id="deliverables-heading" className="mt-1 text-xl font-semibold text-ink">Deliverables</h2>
              </div>
            </div>
            {!project.deliverableReviewAvailable ? (
              <p role="status" className="mt-5 rounded-xl border border-warning-line bg-warning-soft p-4 text-sm leading-6 text-body">
                Deliverable review actions are temporarily unavailable. The studio has been notified and can help with your review.
              </p>
            ) : null}
            {project.deliverables.length ? (
              <ul className="mt-5 divide-y divide-divider">
                {project.deliverables.map((deliverable, index) => (
                  <li key={`${deliverable.title}-${index}`} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{deliverable.title}</p>
                        {deliverable.description && (
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-body">
                            {deliverable.description}
                          </p>
                        )}
                        {deliverable.milestoneTitle && (
                          <p className="mt-1 text-xs text-body-muted">{deliverable.milestoneTitle}</p>
                        )}
                        {deliverable.submitted_at && (
                          <p className="mt-1 text-xs text-body-muted">Shared {formatTimestamp(deliverable.submitted_at)}</p>
                        )}
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(deliverable.status)}`}>
                        {deliverableLabels[deliverable.status]}
                      </span>
                    </div>
                    <DeliverableReview
                      id={deliverable.id}
                      status={deliverable.status}
                      feedback={deliverable.feedback}
                      canReview={project.status === "active" && project.deliverableReviewAvailable}
                      reviewWorkflowAvailable={project.deliverableReviewAvailable}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 rounded-2xl bg-surface-soft p-4 text-sm leading-6 text-body">
                Deliverables will appear here as the project moves forward.
              </p>
            )}
          </Card>
        </section>

        <section aria-labelledby="scope-heading">
          <Card className="h-full p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className="text-accent-deep" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">Agreed together</p>
                <h2 id="scope-heading" className="mt-1 text-xl font-semibold text-ink">Project scope</h2>
              </div>
            </div>
            {project.scope.packageName && (
              <p className="mt-5 rounded-2xl bg-accent-pale px-4 py-3 text-sm font-semibold text-ink">
                {project.scope.packageName}
              </p>
            )}
            {project.scope.packageDescription && (
              <p className="mt-4 text-sm leading-6 text-body">{project.scope.packageDescription}</p>
            )}
            {project.scope.packageItems.length > 0 && (
              <ScopeList title="Package includes" items={project.scope.packageItems} />
            )}
            {project.scope.agreedItems.length > 0 && (
              <ScopeList title="Agreed for this project" items={project.scope.agreedItems} />
            )}
            {project.scope.limits.length > 0 && (
              <ScopeList title="Agreed limits" items={project.scope.limits} />
            )}
            {project.scope.exclusions.length > 0 && (
              <ScopeList title="Not included" items={project.scope.exclusions} />
            )}
            {!project.scope.packageName &&
              !project.scope.packageDescription &&
              project.scope.packageItems.length === 0 &&
              project.scope.agreedItems.length === 0 &&
              project.scope.limits.length === 0 &&
              project.scope.exclusions.length === 0 && (
                <p className="mt-5 text-sm leading-6 text-body">
                  The agreed scope will be added here once the project details are finalized.
                </p>
              )}
            {project.scopeChanges.length ? (
              <div className="mt-6 border-t border-divider pt-5">
                <h3 className="text-sm font-semibold text-ink">Scope change requests</h3>
                <ul className="mt-3 space-y-3">
                  {project.scopeChanges.map((change) => (
                    <li key={change.id} className="rounded-xl bg-surface-soft p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-ink">{change.title}</p>
                        <span className="rounded-full border border-divider px-2.5 py-1 text-xs capitalize text-body-muted">{change.status}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-body">{change.description}</p>
                      <p className="mt-2 text-xs text-body-muted">
                        Requested {formatTimestamp(change.created_at)}
                        {change.reviewed_at ? ` · Reviewed ${formatTimestamp(change.reviewed_at)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {project.status === "active" ? (
              <form
                className="mt-6 border-t border-divider pt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  onRequestScopeChange(scopeChangeTitle, scopeChangeDescription);
                }}
              >
                <h3 className="text-sm font-semibold text-ink">Request a scope change</h3>
                <p className="mt-1 text-sm leading-6 text-body-muted">Describe the additional or changed work. The studio will review it before it becomes part of the agreed scope.</p>
                {scopeChangeError ? <p role="alert" className="mt-3 rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger-deep">{scopeChangeError}</p> : null}
                <label className="mt-4 block text-sm font-medium text-ink">
                  Request title
                  <input
                    required
                    minLength={3}
                    maxLength={160}
                    value={scopeChangeTitle}
                    onChange={(event) => setScopeChangeTitle(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-divider-strong bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent-deep focus:ring-2 focus:ring-accent-deep/20"
                  />
                </label>
                <label className="mt-3 block text-sm font-medium text-ink">
                  Requested change
                  <textarea
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={4}
                    value={scopeChangeDescription}
                    onChange={(event) => setScopeChangeDescription(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-divider-strong bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent-deep focus:ring-2 focus:ring-accent-deep/20"
                  />
                </label>
                <Button type="submit" disabled={submittingScopeChange} className="mt-4">
                  {submittingScopeChange ? "Sending request…" : "Submit scope change request"}
                </Button>
              </form>
            ) : null}
          </Card>
        </section>
      </div>

      <section aria-labelledby="activity-heading">
        <Card className="p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-accent-deep" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">Project history</p>
              <h2 id="activity-heading" className="mt-1 text-xl font-semibold text-ink">Recent activity</h2>
            </div>
          </div>
          {project.activity.length ? (
            <ol className="mt-5 space-y-4">
              {project.activity.map((entry, index) => (
                <li key={`${entry.message}-${entry.created_at}-${index}`} className="flex gap-3">
                  <span className="mt-1 text-accent-deep" aria-hidden="true">
                    {entry.isCompletion ? <CircleCheck size={17} /> : <Clock3 size={17} />}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{entry.message}</p>
                    <time className="mt-1 block text-xs text-body-muted" dateTime={entry.created_at}>
                      {formatTimestamp(entry.created_at)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 text-sm leading-6 text-body">
              Project updates will appear here as work progresses.
            </p>
          )}
        </Card>
      </section>

      <p className="pb-2 text-center text-xs text-body-muted">
        A clear view of what’s happening, what’s next, and what has been delivered.
      </p>
    </div>
  );
}

function ScopeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2 text-sm leading-6 text-body">
            <Check size={16} className="mt-1 shrink-0 text-accent-deep" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DateDetail({ label, date, dark = false }: { label: string; date: string; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${dark ? "text-on-dark/80" : "text-body"}`}>
      <CalendarDays size={16} aria-hidden="true" />
      <span><strong className={dark ? "text-on-dark" : "text-ink"}>{label}:</strong> {formatDate(date)}</span>
    </div>
  );
}

function CenteredState({
  eyebrow,
  title,
  message,
  action,
}: {
  eyebrow: string;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[55dvh] max-w-xl items-center px-4 py-12">
      <Card className="w-full p-7 text-center sm:p-10">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-pale text-accent-deep">
          <Circle size={20} aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-label text-accent-deep">{eyebrow}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-display-tight text-ink sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-body">{message}</p>
        {action && <div className="mt-6">{action}</div>}
      </Card>
    </div>
  );
}

function CircleDotIcon() {
  return <span className="block size-2 rounded-full bg-current" aria-hidden="true" />;
}
