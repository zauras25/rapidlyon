import "server-only";

// Never include response bodies, credentials or client records in diagnostics.
export async function readSupabaseJson(response: Response, resource: string): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  const context = `Supabase ${resource}: HTTP ${response.status}, content type ${mediaType || "missing"}, redirected=${response.redirected}`;
  if (mediaType !== "application/json" && !mediaType.endsWith("+json")) {
    throw new Error(`${context}. Expected JSON. Check SUPABASE_URL and any proxy or redirect returning an HTML page.`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${context}. Response contains invalid JSON.`);
  }
  if (!response.ok) {
    const code = typeof payload === "object" && payload !== null && "code" in payload
      && typeof payload.code === "string" && /^[A-Z0-9_]{1,32}$/.test(payload.code)
      ? `, database code ${payload.code}` : "";
    throw new Error(`${context}${code}. Check database configuration, permissions and migrations.`);
  }
  return payload;
}
