import { json, requireViewer } from "@/lib/http";
import { getJob, toPublic } from "@/lib/jobs";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "งานไม่ถูกต้อง" }, 400);
  const row = await getJob(id, viewer.sub);
  if (!row) return json({ error: "ไม่พบงาน" }, 404);
  const images = await sql<{ n: string | number }>(
    "select count(*)::int as n from job_images where job_id = $1",
    [id],
  );
  return json({ job: toPublic(row, Number(images[0]?.n ?? 0)) });
}
