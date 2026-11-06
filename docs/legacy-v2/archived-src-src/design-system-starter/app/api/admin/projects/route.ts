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

export async function GET() {
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to manage projects." }, { status: 401 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  try {
    const records = await readStoredWorkProjects(config);
    return NextResponse.json({
      success: true,
      projects: mergeAdminWorkProjects(records),
    });
  } catch (error) {
    console.error("Portfolio project admin list failed.", error);
    return NextResponse.json({ success: false, message: "Projects could not be loaded. Check that the portfolio migration has been applied." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to create projects." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(request, "admin-work-projects-write", 30, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const requestBody = await readBoundedJson(request, 128 * 1024);
  if (!requestBody.ok) {
    return NextResponse.json({ success: false, message: "Submit a valid project." }, { status: 400 });
  }

  const parsed = validateWorkProjectDraft(requestBody.value);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Project details are invalid." }, { status: 400 });
  }
  const slug = slugSchema.safeParse(parsed.data.slug);
  if (!slug.success) {
    return NextResponse.json({ success: false, message: "Add a lowercase project URL slug before saving." }, { status: 400 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  try {
    const existing = mergeAdminWorkProjects(await readStoredWorkProjects(config))
      .some((project) => project.slug === slug.data);
    if (existing) {
      return NextResponse.json({ success: false, message: "A project with this URL slug already exists." }, { status: 409 });
    }

    const project = await upsertStoredWorkProject(config, {
      slug: slug.data,
      status: parsed.data.status,
      data: { ...parsed.data, slug: slug.data },
    });
    revalidatePath("/work");
    revalidatePath(`/work/${slug.data}`);
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error) {
    console.error("Portfolio project creation failed.", error);
    return NextResponse.json({ success: false, message: "Project could not be saved. Please try again." }, { status: 502 });
  }
}
