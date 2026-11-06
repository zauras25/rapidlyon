export type MilestoneState =
  | "upcoming"
  | "active"
  | "client_review"
  | "approved"
  | "completed";

export type MilestoneSummary = {
  title: string;
  description: string;
  position: number;
  status: MilestoneState;
  due_date: string | null;
};

export type ProjectProgressSummary = {
  completed: number;
  total: number;
  percentage: number;
  currentMilestone: MilestoneSummary | null;
  nextMilestone: MilestoneSummary | null;
  nextMessage: string;
};

export function calculateProjectProgress(
  milestones: readonly Pick<MilestoneSummary, "status">[],
) {
  const total = milestones.length;
  const completed = milestones.filter(
    (milestone) => milestone.status === "approved" || milestone.status === "completed",
  ).length;

  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function summarizeProjectMilestones(
  milestones: readonly MilestoneSummary[],
  projectStatus: "active" | "paused" | "completed",
): ProjectProgressSummary {
  const ordered = [...milestones].sort((left, right) => left.position - right.position);
  const progress = calculateProjectProgress(ordered);
  const active = ordered.find((milestone) => milestone.status === "active") ?? null;
  const inReview = ordered.find((milestone) => milestone.status === "client_review") ?? null;
  const upcoming = ordered.filter((milestone) => milestone.status === "upcoming");
  const currentMilestone =
    active ??
    inReview ??
    upcoming[0] ??
    (projectStatus === "completed" ? ordered.at(-1) ?? null : null);
  const nextMilestone =
    active || inReview
      ? upcoming.find((milestone) => milestone.position > (active ?? inReview)!.position) ?? null
      : upcoming[0] ?? null;

  let nextMessage = "Nothing is scheduled after this step yet.";
  if (projectStatus === "completed") {
    nextMessage = "Project handoff is complete.";
  } else if (projectStatus === "paused") {
    nextMessage = "The project is paused.";
  } else if (inReview) {
    nextMessage = "Your review is next.";
  } else if (active) {
    nextMessage = nextMilestone
      ? `The studio is working on this milestone. Next up: ${nextMilestone.title}.`
      : "The studio is working on this milestone.";
  } else if (nextMilestone) {
    nextMessage = `Next up: ${nextMilestone.title}.`;
  } else if (progress.total === 0) {
    nextMessage = "The project roadmap is being prepared.";
  } else if (progress.completed === progress.total) {
    nextMessage = "Project handoff is next.";
  }

  return { ...progress, currentMilestone, nextMilestone, nextMessage };
}
