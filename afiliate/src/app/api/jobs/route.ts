import { json, requireViewer } from "@/lib/http";
import { createAndProcessJob, listJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const jobs = await listJobs(viewer.sub);
  return json({ jobs });
}

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  let body: { url?: string; sample?: boolean; sampleKind?: "shopee" | "tiktok" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "ส่งข้อมูลไม่ถูกต้อง" }, 400);
  }
  try {
    const job = await createAndProcessJob({
      owner: viewer.sub,
      url: typeof body.url === "string" ? body.url : undefined,
      sample: Boolean(body.sample),
      sampleKind: body.sampleKind === "tiktok" ? "tiktok" : "shopee",
    });
    return json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "สร้างคลิปไม่สำเร็จ";
    return json({ error: message }, 400);
  }
}
