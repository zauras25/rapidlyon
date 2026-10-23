"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase";

type DeliverableReviewProps = {
  id: string;
  status: "draft" | "in_progress" | "ready_for_review" | "changes_requested" | "approved" | "completed";
  feedback: Array<{ id: string; message: string; created_at: string }>;
  canReview: boolean;
  reviewWorkflowAvailable: boolean;
};

function formatTimestamp(timestamp: string) {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function DeliverableReview({
  id,
  status,
  feedback,
  canReview,
  reviewWorkflowAvailable,
}: DeliverableReviewProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submitReview(action: "approve" | "request_changes") {
    if (action === "approve" && !window.confirm("Approve this deliverable? You can contact the studio if anything needs to change later.")) {
      return;
    }
    if (action === "request_changes" && message.trim().length < 10) {
      setError("Please describe the changes you need in at least 10 characters.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const { data: { session }, error: sessionError } = await getSupabaseClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        setError("Sign in again to review this deliverable.");
        return;
      }

      const response = await fetch(`/api/client/deliverables/${id}/review`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          action === "request_changes"
            ? { action, feedback: message.trim() }
            : { action },
        ),
      });
      const payload: unknown = await response.json();
      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !("success" in payload) ||
        payload.success !== true
      ) {
        const failureMessage =
          payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "Your deliverable review could not be saved.";
        throw new Error(failureMessage);
      }

      window.location.reload();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Your deliverable review could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {feedback.length ? (
        <div className="rounded-xl border border-divider bg-surface-soft p-4">
          <h4 className="text-sm font-semibold text-ink">Feedback history</h4>
          <ol className="mt-3 space-y-3">
            {feedback.map((entry) => (
              <li key={entry.id} className="border-t border-divider pt-3 first:border-0 first:pt-0">
                <time className="text-xs text-body-muted" dateTime={entry.created_at}>
                  {formatTimestamp(entry.created_at)}
                </time>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-body">{entry.message}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {status === "ready_for_review" && canReview ? (
        <div className="space-y-3 rounded-xl border border-warning-line bg-warning-soft p-4">
          <p className="text-sm leading-6 text-body">
            Review this work. Approving confirms the deliverable; requesting changes sends your note to the studio and returns the work to progress.
          </p>
          <label htmlFor={`feedback-${id}`} className="block text-sm font-medium text-ink">
            Request changes (optional)
          </label>
          <textarea
            id={`feedback-${id}`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={5000}
            rows={4}
            placeholder="Describe what needs to change and where..."
            className="w-full rounded-xl border border-divider-strong bg-surface px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-accent-deep focus:ring-2 focus:ring-accent/25"
          />
          <p className="text-xs text-body-muted">Include at least 10 characters so the studio has enough detail to act on.</p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void submitReview("approve")}
            >
              {submitting ? "Saving…" : "Approve deliverable"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={submitting || message.trim().length < 10}
              onClick={() => void submitReview("request_changes")}
            >
              Request changes
            </Button>
          </div>
          {error ? <p role="alert" className="text-sm text-danger-deep">{error}</p> : null}
        </div>
      ) : null}
      {status === "ready_for_review" && !reviewWorkflowAvailable ? (
        <p className="rounded-xl bg-surface-soft p-4 text-sm leading-6 text-body">
          Review actions are temporarily unavailable. Please contact the studio to share your decision.
        </p>
      ) : null}
      {status === "ready_for_review" && reviewWorkflowAvailable && !canReview ? (
        <p className="rounded-xl bg-surface-soft p-4 text-sm leading-6 text-body">
          Reviews are unavailable while this project is paused or complete.
        </p>
      ) : null}
    </div>
  );
}
