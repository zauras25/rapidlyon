export type BoundedBodyResult =
  | { ok: true; body: ArrayBuffer }
  | { ok: false; reason: "invalid" | "too_large" };

export async function readBoundedBody(request: Request, maxBytes: number): Promise<BoundedBodyResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) return { ok: false, reason: "too_large" };
  if (!request.body) return { ok: false, reason: "invalid" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, body: body.buffer };
}

export async function readBoundedJson(request: Request, maxBytes: number) {
  const bounded = await readBoundedBody(request, maxBytes);
  if (!bounded.ok) return bounded;

  try {
    return { ok: true as const, value: JSON.parse(new TextDecoder().decode(bounded.body)) as unknown };
  } catch {
    return { ok: false as const, reason: "invalid" as const };
  }
}