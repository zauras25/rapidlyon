"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminReviewRecordSchema,
  reviewStatusSchema,
  type AdminReview,
} from "@/lib/review-validation";

type ReviewDraft = {
  name: string;
  rating: number | "";
  review: string;
  status: AdminReview["status"];
  display_order: number;
};

const emptyDraft: ReviewDraft = {
  name: "",
  rating: "",
  review: "",
  status: "pending",
  display_order: 0,
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function sortReviews(reviews: AdminReview[]) {
  return [...reviews].sort(
    (left, right) =>
      left.display_order - right.display_order ||
      right.created_at.localeCompare(left.created_at),
  );
}

export function ReviewsAdmin() {
  const router = useRouter();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const orderedReviews = useMemo(() => sortReviews(reviews), [reviews]);
  const editingReview = editingId ? reviews.find((review) => review.id === editingId) ?? null : null;

  const loadReviews = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/reviews", { cache: "no-store" });
      const payload = await response.json();
      if (response.status === 401) {
        router.replace("/admin/reviews/login");
        return;
      }
      if (!response.ok || payload?.success !== true || !Array.isArray(payload.reviews)) {
        throw new Error(payload?.message || "Reviews could not be loaded.");
      }
      const parsed = adminReviewRecordSchema.array().safeParse(payload.reviews);
      if (!parsed.success) throw new Error("The review list had an unexpected format.");
      setReviews(sortReviews(parsed.data));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Reviews could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // This fetch synchronizes the admin list with persisted review records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReviews();
  }, [loadReviews]);

  const startNewReview = () => {
    const lastOrder = orderedReviews.at(-1)?.display_order ?? -1;
    setEditingId(null);
    setDraft({ ...emptyDraft, display_order: Math.min(lastOrder + 1, 100000) });
    setConfirmDelete(false);
    setError("");
    setNotice("");
  };

  const editReview = (review: AdminReview) => {
    setEditingId(review.id);
    setDraft({
      name: review.name,
      rating: review.rating,
      review: review.review,
      status: review.status,
      display_order: review.display_order,
    });
    setConfirmDelete(false);
    setError("");
    setNotice("");
  };

  const saveReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        editingId ? `/api/admin/reviews/${editingId}` : "/api/admin/reviews",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const payload = await response.json();
      if (response.status === 401) {
        router.replace("/admin/reviews/login");
        return;
      }
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || "Review could not be saved.");
      }
      const parsed = adminReviewRecordSchema.safeParse(payload.review);
      if (!parsed.success) throw new Error("The saved review had an unexpected format.");
      const previous = reviews.find((review) => review.id === parsed.data.id);
      const savedReview: AdminReview = {
        ...parsed.data,
        client: parsed.data.client ?? previous?.client ?? null,
        project: parsed.data.project ?? previous?.project ?? null,
      };
      setReviews((current) =>
        sortReviews([
          ...current.filter((review) => review.id !== parsed.data.id),
          savedReview,
        ]),
      );
      setEditingId(savedReview.id);
      setDraft({
        name: savedReview.name,
        rating: savedReview.rating,
        review: savedReview.review,
        status: savedReview.status,
        display_order: savedReview.display_order,
      });
      setConfirmDelete(false);
      setNotice(savedReview.status === "approved"
        ? "Review saved and visible on the public site."
        : "Review saved. It is not visible on the public site.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Review could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deleteReview = async () => {
    if (!editingId) return;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/reviews/${editingId}`, { method: "DELETE" });
      const payload = await response.json();
      if (response.status === 401) {
        router.replace("/admin/reviews/login");
        return;
      }
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || "Review could not be deleted.");
      }
      setReviews((current) => current.filter((review) => review.id !== editingId));
      startNewReview();
      setNotice("Review deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Review could not be deleted.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/reviews/login");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-label text-muted">Private · Content</p>
          <h1 className="mt-2 text-3xl font-semibold">Review management</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-body-muted">
            Manage submitted review text and publication state. Only approve feedback shared with permission; published reviews are not independently identity-verified.
          </p>
          <nav aria-label="Admin sections" className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
            <Link href="/admin" className="underline underline-offset-4">Operations</Link>
            <Link href="/admin/discovery" className="underline underline-offset-4">Project submissions</Link>
            <Link href="/admin/projects" className="underline underline-offset-4">Portfolio projects</Link>
            <Link href="/admin/reviews" aria-current="page" className="text-ink">Reviews</Link>
            <Link href="/admin/clients" className="underline underline-offset-4">Client projects</Link>
          </nav>
        </div>
        <button type="button" onClick={signOut} className="rounded-full border border-divider-strong px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep">
          Sign out
        </button>
      </header>

      {error ? <p role="alert" className="mt-6 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-strong">{error}</p> : null}
      {notice ? <p role="status" className="mt-6 rounded-xl border border-success-line bg-success-soft p-4 text-sm text-success-strong">{notice}</p> : null}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="review-list-heading" className="rounded-panel border border-divider bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="review-list-heading" className="text-lg font-semibold">All reviews</h2>
              <p className="mt-1 text-xs text-body-muted">{reviews.length} record{reviews.length === 1 ? "" : "s"} · ordered for display</p>
            </div>
            <button type="button" onClick={startNewReview} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep">
              Add review
            </button>
          </div>

          {loading ? <p role="status" className="py-10 text-center text-sm text-body-muted">Loading reviews…</p> : null}
          {!loading && reviews.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium">No review records yet.</p>
              <p className="mt-2 text-sm leading-6 text-body-muted">Visitor submissions will appear here as pending. Add only genuine feedback with permission.</p>
            </div>
          ) : null}
          <ul className="mt-4 divide-y divide-divider">
            {orderedReviews.map((review) => (
              <li key={review.id}>
                <button
                  type="button"
                  aria-current={editingId === review.id ? "true" : undefined}
                  onClick={() => editReview(review)}
                  className={`w-full rounded-xl px-3 py-4 text-left hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep ${editingId === review.id ? "bg-paper" : ""}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{review.name}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${review.status === "approved" ? "bg-success-soft text-success-strong" : review.status === "pending" ? "bg-warning-soft text-warning-strong" : "bg-surface text-body-muted"}`}>
                      {review.status === "approved" ? "Published" : review.status}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-body-muted">
                    {review.rating}/5 stars · Display order {review.display_order}
                  </span>
                  <span className="mt-2 block line-clamp-2 text-sm leading-5 text-body">{review.review}</span>
                  <span className="mt-2 block text-xs text-muted">Created {dateLabel(review.created_at)}</span>
                  {review.project ? <span className="mt-1 block text-xs text-body-muted">Project: {review.project.name}</span> : null}
                  {review.client ? <span className="mt-1 block text-xs text-body-muted">Client: {review.client.name}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="review-editor-heading" className="rounded-panel border border-divider bg-surface p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-label text-muted">{editingId ? "Edit record" : "New record"}</p>
              <h2 id="review-editor-heading" className="mt-2 text-xl font-semibold">{editingId ? "Review details" : "Add a review"}</h2>
            </div>
            {editingId && !editingReview?.client_project_id ? (
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-danger-line px-4 py-2 text-sm font-medium text-danger-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-line">
                Delete
              </button>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-6 text-body-muted">
            Keep the review faithful to the original feedback. Do not add a company, role, project, or outcome that was not provided.
          </p>
          {editingId ? (
            <div className="mt-4 rounded-xl border border-divider bg-paper p-4 text-sm">
              <p className="font-semibold text-ink">Submission context</p>
              {editingReview?.client_project_id ? <p className="mt-2 text-body-muted">Project reviews are retained for audit and cannot be deleted.</p> : null}
              {editingReview?.client ? (
                <p className="mt-2 text-body-muted">
                  Client: {editingReview.client.name} · {editingReview.client.email}
                </p>
              ) : <p className="mt-2 text-body-muted">No linked client record.</p>}
              {editingReview?.project ? (
                <p className="mt-1 text-body-muted">
                  Project:{" "}
                  <Link
                    href={`/admin/operations/projects/${editingReview.project.id}`}
                    className="font-medium text-ink underline underline-offset-4"
                  >
                    {editingReview.project.name}
                  </Link>
                  {" · "}{editingReview.project.status}
                  {editingReview.project.completed_at
                    ? ` · Completed ${dateLabel(editingReview.project.completed_at)}`
                    : ""}
                </p>
              ) : <p className="mt-1 text-body-muted">No linked client project.</p>}
              <p className="mt-1 text-xs text-muted">
                Submitted {editingReview ? dateLabel(editingReview.created_at) : "date unavailable"}
              </p>
            </div>
          ) : null}

          {confirmDelete ? (
            <div className="mt-5 rounded-xl border border-danger-line bg-danger-soft p-4" role="alert">
              <p className="text-sm font-medium text-danger-strong">Permanently delete this review?</p>
              <p className="mt-1 text-sm text-danger-strong">This cannot be undone. To hide a review without deleting it, change its status instead.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={deleting} onClick={() => void deleteReview()} className="rounded-full bg-danger-strong px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full border border-divider-strong px-4 py-2 text-sm font-medium">
                  Keep review
                </button>
              </div>
            </div>
          ) : null}

          <form className="mt-6 space-y-5" onSubmit={saveReview}>
            <div>
              <label htmlFor="admin-review-name" className="mb-2 block text-sm font-medium">Reviewer name</label>
              <input id="admin-review-name" required minLength={2} maxLength={100} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-divider-strong bg-paper px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent-deep" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="admin-review-rating" className="mb-2 block text-sm font-medium">Rating (1–5)</label>
                <select id="admin-review-rating" required value={draft.rating} onChange={(event) => setDraft((current) => ({ ...current, rating: event.target.value ? Number(event.target.value) : "" }))} className="w-full rounded-xl border border-divider-strong bg-paper px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent-deep">
                  <option value="">Choose a rating</option>
                  {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="admin-review-order" className="mb-2 block text-sm font-medium">Display order</label>
                <input id="admin-review-order" type="number" required min={0} max={100000} step={1} value={draft.display_order} onChange={(event) => setDraft((current) => ({ ...current, display_order: Number(event.target.value) }))} className="w-full rounded-xl border border-divider-strong bg-paper px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent-deep" />
                <p className="mt-1 text-xs text-body-muted">Lower numbers appear first. Equal values use newest first.</p>
              </div>
            </div>

            <div>
              <label htmlFor="admin-review-text" className="mb-2 block text-sm font-medium">Review text</label>
              <textarea id="admin-review-text" required minLength={20} maxLength={1200} rows={6} value={draft.review} onChange={(event) => setDraft((current) => ({ ...current, review: event.target.value }))} className="w-full rounded-xl border border-divider-strong bg-paper px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent-deep" />
              <p className="mt-1 text-xs text-body-muted">{draft.review.trim().length}/1200 characters · at least 20 required</p>
            </div>

            <div>
              <label htmlFor="admin-review-status" className="mb-2 block text-sm font-medium">Publication status</label>
              <select id="admin-review-status" value={draft.status} onChange={(event) => {
                const parsed = reviewStatusSchema.safeParse(event.target.value);
                if (parsed.success) setDraft((current) => ({ ...current, status: parsed.data }));
              }} className="w-full rounded-xl border border-divider-strong bg-paper px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent-deep">
                <option value="pending">Pending · not public</option>
                <option value="approved">Published · visible publicly</option>
                <option value="rejected">Rejected · not public</option>
              </select>
              {draft.status === "approved" ? (
                <p className="mt-2 text-sm text-success-strong">This review will be visible in the public Reviews section after saving.</p>
              ) : (
                <p className="mt-2 text-sm text-body-muted">This review is not visible on the public site.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={saving || confirmDelete} className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-on-dark disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "Saving…" : editingId ? "Save changes" : "Create review"}
              </button>
              {editingId ? <button type="button" onClick={startNewReview} className="rounded-full border border-divider-strong px-5 py-3 text-sm font-medium">Cancel edit</button> : null}
            </div>
          </form>

          {editingId && draft.status === "approved" ? (
            <article className="mt-8 border-t border-divider-strong pt-5" aria-label="Public review preview">
              <p className="text-xs font-medium uppercase tracking-label text-muted">Public preview</p>
              <blockquote className="mt-3 text-lg leading-8 text-ink">“{draft.review || "Review text will appear here."}”</blockquote>
              <p className="mt-3 text-sm font-semibold text-ink">{draft.name || "Reviewer name"}</p>
              <p className="mt-1 text-xs text-body-muted">Submitted review · not independently verified</p>
            </article>
          ) : null}
        </section>
      </div>
    </div>
  );
}
