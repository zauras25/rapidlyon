import "server-only";

export type SupabaseServerConfig = {
  url: string;
  serviceRoleKey: string;
  legacyServiceRoleKey: boolean;
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
  const legacyServiceRoleKey = hasLegacyServiceRoleJwtShape(serviceRoleKey);
  const modernServiceRoleKey = /^sb_secret_[A-Za-z0-9_-]{20,}$/.test(serviceRoleKey);
  if (!legacyServiceRoleKey && !modernServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a service_role JWT or an sb_secret_ key.");
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
      throw new Error("Supabase server URL must use HTTPS except for localhost.");
    }
  } catch {
    throw new Error("SUPABASE_URL must be a valid HTTPS Supabase URL.");
  }

  return { url: url.replace(/\/+$/, ""), serviceRoleKey, legacyServiceRoleKey };
}

export function supabaseServerHeaders(
  config: SupabaseServerConfig,
  additionalHeaders: Record<string, string> = {},
) {
  return {
    apikey: config.serviceRoleKey,
    ...(config.legacyServiceRoleKey ? { Authorization: `Bearer ${config.serviceRoleKey}` } : {}),
    ...additionalHeaders,
  };
}
