import "server-only";

export type SupabaseServerConfig = {
  url: string;
  serviceRoleKey: string;
};

function isServiceRoleKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;

  const payload = key.split(".")[1];
  if (!payload) return false;

  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
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

  if (!url || !serviceRoleKey || !isServiceRoleKey(serviceRoleKey)) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
      return null;
    }
  } catch {
    return null;
  }

  return { url: url.replace(/\/+$/, ""), serviceRoleKey };
}
