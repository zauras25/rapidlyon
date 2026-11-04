import "server-only";

export type SupabaseServerConfig = {
  url: string;
  serviceRoleKey: string;
};

function hasLegacyServiceRoleJwtShape(key: string): boolean {
  const parts = key.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return false;

  try {
    const claims: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return (
      typeof claims === "object" &&
      claims !== null &&
      "role" in claims &&
      claims.role === "service_role"
    );
  } catch {
    return false;
  }
}

export function getSupabaseServerConfig(): SupabaseServerConfig | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url && !serviceRoleKey) {
    return null;
  }

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server configuration is incomplete.");
  }
  if (!hasLegacyServiceRoleJwtShape(serviceRoleKey)) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a legacy service_role JWT; new secret keys are not supported by this REST implementation.");
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
      throw new Error("Supabase server URL must use HTTPS except for localhost.");
    }
  } catch {
    throw new Error("SUPABASE_URL must be a valid HTTPS Supabase URL.");
  }

  return { url: url.replace(/\/+$/, ""), serviceRoleKey };
}
