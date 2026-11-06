import "server-only";

import { z } from "zod";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  email_confirmed_at: z.string().nullable().optional(),
  confirmed_at: z.string().nullable().optional(),
});

const clientRecordSchema = z.object({
  id: z.string().uuid(),
  auth_user_id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  status: z.literal("active"),
});

const projectRecordSchema = z.object({ id: z.string().uuid() });
const childProjectRecordSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
});

export type AuthenticatedClient = {
  authUserId: string;
  clientId: string;
  email: string;
  name: string;
};

export type AuthenticatedSupabaseUser = z.infer<typeof authUserSchema> & {
  emailConfirmed: boolean;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] ?? null;
}

export async function getAuthenticatedSupabaseUser(
  request: Request,
): Promise<AuthenticatedSupabaseUser | null> {
  const accessToken = getBearerToken(request);
  if (!accessToken) return null;

  const config = getSupabaseServerConfig();
  if (!config) throw new Error("Supabase server configuration is unavailable.");

  let response: Response;
  try {
    response = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error("Supabase Auth user verification request failed.");
  }

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new Error(`Supabase Auth user verification failed with status ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Supabase Auth returned an invalid user response.");
  }

  const parsed = authUserSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Supabase Auth returned an invalid user response.");

  return {
    ...parsed.data,
    emailConfirmed: Boolean(parsed.data.email_confirmed_at || parsed.data.confirmed_at),
  };
}

async function readServiceRoleRows<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const config = getSupabaseServerConfig();
  if (!config) throw new Error("Supabase server configuration is unavailable.");

  let response: Response;
  try {
    response = await fetch(`${config.url}/rest/v1/${path}`, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error("Supabase client authorization request failed.");
  }

  if (!response.ok) {
    throw new Error(`Supabase client authorization failed with status ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Supabase client authorization returned an invalid response.");
  }

  if (!Array.isArray(payload)) throw new Error("Supabase client authorization returned an invalid response.");
  return payload.map((record) => {
    const parsed = schema.safeParse(record);
    if (!parsed.success) throw new Error("Supabase client authorization returned an invalid record.");
    return parsed.data;
  });
}

export async function getAuthenticatedClient(
  request: Request,
): Promise<AuthenticatedClient | null> {
  const user = await getAuthenticatedSupabaseUser(request);
  if (!user) return null;

  return getClientForAuthenticatedUser(user);
}

export async function getClientForAuthenticatedUser(
  user: AuthenticatedSupabaseUser,
): Promise<AuthenticatedClient | null> {
  const query = new URLSearchParams({
    select: "id,auth_user_id,name,email,status",
    auth_user_id: `eq.${user.id}`,
    status: "eq.active",
    limit: "1",
  });
  const [client] = await readServiceRoleRows(
    `clients?${query}`,
    clientRecordSchema,
  );
  if (!client) return null;

  return {
    authUserId: user.id,
    clientId: client.id,
    email: client.email,
    name: client.name,
  };
}

export async function canAccessClientProject(
  client: AuthenticatedClient,
  projectId: string,
): Promise<boolean> {
  if (!z.string().uuid().safeParse(projectId).success) return false;

  const query = new URLSearchParams({
    select: "id",
    id: `eq.${projectId}`,
    client_id: `eq.${client.clientId}`,
    limit: "1",
  });
  const projects = await readServiceRoleRows(
    `client_projects?${query}`,
    projectRecordSchema,
  );
  return projects.length === 1;
}

async function canAccessProjectChild(
  client: AuthenticatedClient,
  table: "project_milestones" | "project_deliverables",
  childId: string,
): Promise<boolean> {
  if (!z.string().uuid().safeParse(childId).success) return false;

  const query = new URLSearchParams({
    select: "id,project_id",
    id: `eq.${childId}`,
    limit: "1",
  });
  const [child] = await readServiceRoleRows(
    `${table}?${query}`,
    childProjectRecordSchema,
  );
  return child ? canAccessClientProject(client, child.project_id) : false;
}

export function canAccessClientMilestone(
  client: AuthenticatedClient,
  milestoneId: string,
): Promise<boolean> {
  return canAccessProjectChild(client, "project_milestones", milestoneId);
}

export function canAccessClientDeliverable(
  client: AuthenticatedClient,
  deliverableId: string,
): Promise<boolean> {
  return canAccessProjectChild(client, "project_deliverables", deliverableId);
}
