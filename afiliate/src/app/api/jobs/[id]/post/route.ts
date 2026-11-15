import { json, requireViewer } from "@/lib/http";
import { requestShopeePost } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "งานไม่ถูกต้อง" }, 400);
  try {
    const job = await requestShopeePost(id, viewer.sub);
    return json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "โพสต์ไม่สำเร็จ";
    return json({ error: message }, 400);
  }
}
