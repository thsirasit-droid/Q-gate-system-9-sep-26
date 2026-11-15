import { json, requireViewer } from "@/lib/http";
import { regenerateJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "งานไม่ถูกต้อง" }, 400);
  let script: string | undefined;
  try {
    const body = (await request.json()) as { script?: string };
    if (typeof body.script === "string") script = body.script;
  } catch {
    script = undefined;
  }
  try {
    const job = await regenerateJob(id, viewer.sub, script);
    return json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ทำคลิปใหม่ไม่สำเร็จ";
    return json({ error: message }, 400);
  }
}
