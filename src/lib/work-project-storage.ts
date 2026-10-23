import "server-only";
import { z } from "zod";
import { featuredProjects } from "@/data/site";
import {
  workProjectDraftSchema,
  workProjectSchema,
  type WorkProject,
} from "@/lib/work-project-schema";
import { getSupabaseServerConfig, type SupabaseServerConfig } from "@/lib/supabase-server";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const projectRecordSchema = z.object({
  slug: slugSchema,
  status: z.enum(["draft", "published", "deleted"]),
  data: z.unknown(),
  updated_at: z.string(),
});

export type StoredWorkProject = z.infer<typeof projectRecordSchema>;
export type AdminWorkProject = {
  slug: string;
  status: "draft" | "published";
  data: unknown;
  updated_at: string | null;
  source: "static" | "database";
};

function restHeaders(config: SupabaseServerConfig) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
  };
}

export async function readStoredWorkProjects(
  config: SupabaseServerConfig,
  revalidate?: number,
): Promise<StoredWorkProject[]> {
  const response = await fetch(
    `${config.url}/rest/v1/work_projects?select=slug,status,data,updated_at&order=updated_at.desc&limit=500`,
    {
      headers: restHeaders(config),
      ...(revalidate === undefined ? { cache: "no-store" as const } : { next: { revalidate } }),
    },
  );

  if (!response.ok) {
    console.error(`Supabase work project read failed with status ${response.status}.`);
    throw new Error("Work projects could not be read.");
  }

  const parsed = z.array(projectRecordSchema).safeParse(await response.json());
  if (!parsed.success) {
    console.error("Supabase returned invalid work project records.");
    throw new Error("Work projects could not be read.");
  }
  return parsed.data;
}

export async function upsertStoredWorkProject(
  config: SupabaseServerConfig,
  project: { slug: string; status: StoredWorkProject["status"]; data: unknown },
): Promise<StoredWorkProject> {
  const response = await fetch(
    `${config.url}/rest/v1/work_projects?on_conflict=slug`,
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({ ...project, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error(`Supabase work project save failed with status ${response.status}.`);
    throw new Error("Work project could not be saved.");
  }

  const parsed = z.array(projectRecordSchema).safeParse(await response.json());
  if (!parsed.success || parsed.data.length !== 1) {
    console.error("Supabase returned an invalid work project save response.");
    throw new Error("Work project could not be saved.");
  }
  return parsed.data[0];
}

export function mergeAdminWorkProjects(records: StoredWorkProject[]): AdminWorkProject[] {
  const projects = new Map<string, AdminWorkProject>();

  for (const project of featuredProjects) {
    projects.set(project.slug, {
      slug: project.slug,
      status: project.status,
      data: project,
      updated_at: null,
      source: "static",
    });
  }

  for (const record of records) {
    if (record.status === "deleted") {
      projects.delete(record.slug);
      continue;
    }
    projects.set(record.slug, {
      slug: record.slug,
      status: record.status,
      data: record.data,
      updated_at: record.updated_at,
      source: "database",
    });
  }

  return [...projects.values()].sort((left, right) =>
    left.slug.localeCompare(right.slug),
  );
}

export function mergePublicWorkProjects(records: StoredWorkProject[]): WorkProject[] {
  const projects = new Map(
    featuredProjects.map((project) => [project.slug, project] as const),
  );

  for (const record of records) {
    projects.delete(record.slug);
    if (record.status !== "published") continue;

    const parsed = workProjectSchema.safeParse(record.data);
    if (!parsed.success) {
      console.error(`Published work project "${record.slug}" has invalid content and was omitted.`);
      continue;
    }
    projects.set(record.slug, parsed.data);
  }

  return [...projects.values()]
    .filter((project) => project.status === "published")
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

export async function getPublishedWorkProjects(): Promise<WorkProject[]> {
  const staticProjects = featuredProjects
    .filter((project) => project.status === "published")
    .sort((left, right) => left.displayOrder - right.displayOrder);
  const config = getSupabaseServerConfig();
  if (!config) return staticProjects;

  try {
    return mergePublicWorkProjects(await readStoredWorkProjects(config, 60));
  } catch {
    console.error("Using the built-in portfolio because Supabase work project data is unavailable.");
    return staticProjects;
  }
}

export function validateWorkProjectDraft(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "published"
  ) {
    return workProjectSchema.safeParse(value);
  }

  const initial = workProjectDraftSchema.safeParse(value);
  return initial;
}

export { slugSchema };
