import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { readBoundedBody } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import { slugSchema } from "@/lib/work-project-storage";

const maxImageBytes = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to upload project media." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(request, "admin-work-project-media", 30, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const { searchParams } = new URL(request.url);
  const slug = slugSchema.safeParse(searchParams.get("slug"));
  if (!slug.success) {
    return NextResponse.json({ success: false, message: "Save a valid project URL slug before uploading media." }, { status: 400 });
  }

  const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = allowedTypes.get(mediaType);
  if (!extension) {
    return NextResponse.json({ success: false, message: "Upload a JPG, PNG, WebP, or AVIF image." }, { status: 415 });
  }

  const bounded = await readBoundedBody(request, maxImageBytes);
  if (!bounded.ok) {
    const status = bounded.reason === "too_large" ? 413 : 400;
    return NextResponse.json({ success: false, message: status === 413 ? "Images must be 5 MB or smaller." : "The image upload could not be read." }, { status });
  }
  if (bounded.body.byteLength === 0) {
    return NextResponse.json({ success: false, message: "Choose an image to upload." }, { status: 400 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  const path = `${slug.data}/${randomUUID()}.${extension}`;
  try {
    const response = await fetch(
      `${config.url}/storage/v1/object/work-project-media/${path.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "POST",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": mediaType,
          "x-upsert": "false",
        },
        body: bounded.body,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(`Supabase portfolio media upload failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Image could not be uploaded. Check the portfolio storage migration and try again." }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      url: `${config.url}/storage/v1/object/public/work-project-media/${path.split("/").map(encodeURIComponent).join("/")}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Supabase portfolio media upload request failed.", error);
    return NextResponse.json({ success: false, message: "Image could not be uploaded. Please try again." }, { status: 502 });
  }
}
