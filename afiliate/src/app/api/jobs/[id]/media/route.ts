import { asBuffer } from "@/lib/db";
import { json, requireViewer } from "@/lib/http";
import { getJob, getJobImage } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "งานไม่ถูกต้อง" }, 400);
  const kind = new URL(request.url).searchParams.get("kind") ?? "video";
  const download = new URL(request.url).searchParams.get("download") === "1";
  const index = Number(new URL(request.url).searchParams.get("n") ?? "0");
  if (kind === "image") {
    if (!Number.isInteger(index) || index < 0 || index > 7) return json({ error: "รูปไม่ถูกต้อง" }, 400);
    const image = await getJobImage(id, viewer.sub, index);
    if (!image) return json({ error: "ไม่พบรูป" }, 404);
    return new Response(new Uint8Array(image.data), {
      headers: {
        "content-type": image.mime,
        "cache-control": "private, no-store",
      },
    });
  }
  const row = await getJob(id, viewer.sub);
  if (!row) return json({ error: "ไม่พบงาน" }, 404);
  const data = kind === "audio" ? asBuffer(row.audio) : asBuffer(row.video);
  const mime =
    kind === "audio" ? (row.audio_mime ?? "audio/mpeg") : (row.video_mime ?? "video/mp4");
  if (!data) return json({ error: "ยังไม่มีไฟล์" }, 404);
  const filename = kind === "audio" ? `afiliate-${id}.mp3` : `afiliate-${id}.mp4`;
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": mime,
      "cache-control": "private, no-store",
      ...(download
        ? { "content-disposition": `attachment; filename="${filename}"` }
        : {}),
    },
  });
}
