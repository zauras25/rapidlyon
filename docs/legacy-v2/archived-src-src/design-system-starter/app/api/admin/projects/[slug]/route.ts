import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import {
  mergeAdminWorkProjects,
  readStoredWorkProjects,
  slugSchema,
  upsertStoredWorkProject,
  validateWorkProjectDraft,
} from "@/lib/work-project-storage";

type ProjectRouteContext = { params: Promise<{ slug: string }> };

function mediaPaths(value: unknown, config: { url: string }) {
  const urls: string[] = [];
  const visit = (item: unknown) => {
    if (Array.isArray(item)) {
      item.forEach(visit);
    } else if (typeof item === "object" && item !== null) {
      for (const [key, entry] of Object.entries(item)) {
        if (key === "src" && typeof entry === "string") urls.push(entry);
        else visit(entry);
      }
    }
  };
  visit(value);

  const paths = new Set<string>();
  for (const source of urls) {
    try {
      const url = new URL(source);
      const prefix = "/storage/v1/object/public/work-project-media/";
      if (url.origin !== config.url || !url.pathname.startsWith(prefix)) continue;
      const path = url.pathname.slice(prefix.length).split("/").map(decodeURIComponent);
      if (path.some((part) => !part || part === "." || part === "..")) continue;
      paths.add(path.join("/"));
    } catch {
      continue;
    }
  }
  return [...paths];
}

async function removeProjectMedia(config: { url: string; serviceRoleKey: string }, data: unknown) {
  const paths = mediaPaths(data, config);
  const results = await Promise.all(paths.map(async (path) => {
    try {
      const response = await fetch(
        `${config.url}/storage/v1/object/work-project-media/${path.split("/").map(encodeURIComponent).join("/")}`,
        {
          method: "DELETE",
          headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
          },
          cache: "no-store",
        },
      );
      return response.ok;
    } catch (error) {
      console.error("Supabase portfolio media deletion request failed.", error);
      return false;
    }
  }));

  if (results.some((success) => !success)) {
    console.error("One or more portfolio media files could not be removed from Supabase Storage.");
  }
}

export async function PATCH(request: Request, { params }: ProjectRouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to update projects." }, { status: 401 });
  }

  const { slug: currentSlug } = await params;
  if (!slugSchema.safeParse(currentSlug).success) {
    return NextResponse.json({ success: false, message: "Invalid project URL slug." }, { status: 400 });
  }
  const rateLimit = await checkRateLimit(request, "admin-work-projects-write", 30, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const requestBody = await readBoundedJson(request, 128 * 1024);
  if (!requestBody.ok) {
    return NextResponse.json({ success: false, message: "Submit a valid project update." }, { status: 400 });
  }
  const parsed = validateWorkProjectDraft(requestBody.value);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Project details are invalid." }, { status: 400 });
  }
  const nextSlug = slugSchema.safeParse(parsed.data.slug);
  if (!nextSlug.success) {
    return NextResponse.json({ success: false, message: "Add a lowercase project URL slug before saving." }, { status: 400 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  try {
    const records = await readStoredWorkProjects(config);
    const projects = mergeAdminWorkProjects(records);
    const existing = projects.find((project) => project.slug === currentSlug);
    if (!existing) {
      return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
    }
    if (nextSlug.data !== currentSlug && projects.some((project) => project.slug === nextSlug.data)) {
      return NextResponse.json({ success: false, message: "A project with this URL slug already exists." }, { status: 409 });
    }

    const previousData = typeof existing.data === "object" && existing.data !== null
      ? existing.data
      : {};
    const project = await upsertStoredWorkProject(config, {
      slug: nextSlug.data,
      status: parsed.data.status,
      data: { ...previousData, ...parsed.data, slug: nextSlug.data },
    });

    if (nextSlug.data !== currentSlug) {
      await upsertStoredWorkProject(config, { slug: currentSlug, status: "deleted", data: {} });
      revalidatePath(`/work/${currentSlug}`);
    }
    revalidatePath("/work");
    revalidatePath(`/work/${nextSlug.data}`);
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("Portfolio project update failed.", error);
    return NextResponse.json({ success: false, message: "Project could not be updated. Please try again." }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: ProjectRouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to delete projects." }, { status: 401 });
  }

  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) {
    return NextResponse.json({ success: false, message: "Invalid project URL slug." }, { status: 400 });
  }
  const rateLimit = await checkRateLimit(request, "admin-work-projects-write", 30, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  try {
    const project = mergeAdminWorkProjects(await readStoredWorkProjects(config))
      .find((item) => item.slug === slug);
    if (!project) {
      return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
    }

    await upsertStoredWorkProject(config, { slug, status: "deleted", data: {} });
    await removeProjectMedia(config, project.data);
    revalidatePath("/work");
    revalidatePath(`/work/${slug}`);
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Portfolio project deletion failed.", error);
    return NextResponse.json({ success: false, message: "Project could not be deleted. Please try again." }, { status: 502 });
  }
}
