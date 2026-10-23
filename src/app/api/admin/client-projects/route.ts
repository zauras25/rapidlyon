import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const projectSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  name: z.string().min(1),
  status: z.enum([
    "draft",
    "invited",
    "active",
    "paused",
    "completed",
    "cancelled",
  ]),
});

const clientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  status: z.enum(["active", "inactive", "archived"]),
});

const milestoneSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  title: z.string().min(1),
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
});

export async function GET() {
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json(
      {
        success: false,
        message: "Sign in as an administrator.",
      },
      { status: 401 },
    );
  }

  const config = getSupabaseServerConfig();

  if (!config) {
    return NextResponse.json(
      {
        success: false,
        message: "Supabase storage is not configured.",
      },
      { status: 503 },
    );
  }

  try {
    const clientsQuery = new URLSearchParams({
      status: "eq.active",
      select: "id,name,email,status",
      order: "created_at.desc",
    });

    const clientsResponse = await fetch(
      `${config.url}/rest/v1/clients?${clientsQuery}`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );

    if (!clientsResponse.ok) {
      console.error(
        `Supabase client lookup failed with status ${clientsResponse.status}.`,
      );

      return NextResponse.json(
        {
          success: false,
          message: "Client projects could not be loaded.",
        },
        { status: 502 },
      );
    }

    const clientsResult = clientSchema.array().safeParse(
      await clientsResponse.json(),
    );

    if (!clientsResult.success) {
      console.error("Stored client data did not match the expected format.");

      return NextResponse.json(
        {
          success: false,
          message: "Client data could not be processed.",
        },
        { status: 502 },
      );
    }

    const clients = clientsResult.data;

    if (clients.length === 0) {
      return NextResponse.json({
        success: true,
        projects: [],
      });
    }

    const clientIds = clients.map((client) => client.id);

    const projectsQuery = new URLSearchParams({
      client_id: `in.(${clientIds.join(",")})`,
      select: "id,client_id,name,status",
      order: "created_at.desc",
    });

    const projectsResponse = await fetch(
      `${config.url}/rest/v1/client_projects?${projectsQuery}`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );

    if (!projectsResponse.ok) {
      console.error(
        `Supabase client project lookup failed with status ${projectsResponse.status}.`,
      );

      return NextResponse.json(
        {
          success: false,
          message: "Client projects could not be loaded.",
        },
        { status: 502 },
      );
    }

    const projectsResult = projectSchema.array().safeParse(
      await projectsResponse.json(),
    );

    if (!projectsResult.success) {
      console.error(
        "Stored client project data did not match the expected format.",
      );

      return NextResponse.json(
        {
          success: false,
          message: "Client project data could not be processed.",
        },
        { status: 502 },
      );
    }

    const projects = projectsResult.data;

    if (projects.length === 0) {
      return NextResponse.json({
        success: true,
        projects: [],
      });
    }

    const projectIds = projects.map((project) => project.id);

    const milestonesQuery = new URLSearchParams({
      project_id: `in.(${projectIds.join(",")})`,
      select: "id,project_id,title,description,position,status,client_approved_at,admin_approved_at,start_date,due_date",
      order: "due_date.asc.nullslast",
    });

    const milestonesResponse = await fetch(
      `${config.url}/rest/v1/project_milestones?${milestonesQuery}`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );

    if (!milestonesResponse.ok) {
      console.error(
        `Supabase milestone lookup failed with status ${milestonesResponse.status}.`,
      );

      return NextResponse.json(
        {
          success: false,
          message: "Project milestones could not be loaded.",
        },
        { status: 502 },
      );
    }

    const milestonesResult = milestoneSchema.array().safeParse(
      await milestonesResponse.json(),
    );

    if (!milestonesResult.success) {
      console.error(
        "Stored milestone data did not match the expected format.",
      );

      return NextResponse.json(
        {
          success: false,
          message: "Project milestone data could not be processed.",
        },
        { status: 502 },
      );
    }

    const clientMap = new Map(
      clients.map((client) => [client.id, client]),
    );

    const milestonesByProject = new Map<
      string,
      z.infer<typeof milestoneSchema>[]
    >();

    for (const milestone of milestonesResult.data) {
      const existing = milestonesByProject.get(milestone.project_id);

      if (existing) {
        existing.push(milestone);
      } else {
        milestonesByProject.set(milestone.project_id, [milestone]);
      }
    }

    return NextResponse.json({
      success: true,
      projects: projects.map((project) => ({
        ...project,
        client: clientMap.get(project.client_id) ?? null,
        milestones: milestonesByProject.get(project.id) ?? [],
      })),
    });
  } catch {
    console.error("Client projects request failed.");

    return NextResponse.json(
      {
        success: false,
        message: "Client projects could not be loaded.",
      },
      { status: 502 },
    );
  }
}

