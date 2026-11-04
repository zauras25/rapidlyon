export function GET() {
  return Response.json(
    { status: "ok", checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
