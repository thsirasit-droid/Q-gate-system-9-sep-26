import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { asBuffer, sql } from "./db";
import { downloadProductImage, resolveProduct, sampleProduct } from "./product";
import { writeThaiCopy } from "./script";
import { sanitizeSpeech } from "./text";
import { speakThai } from "./tts";
import { ffmpegAvailable, renderVerticalClip } from "./video";
import { postToShopee } from "./post-shopee";
import type { JobPublic, JobStatus, Platform, ProductInfo, VoiceMode } from "./types";

type JobRow = {
  id: string;
  owner: string;
  created_at: Date | string;
  updated_at: Date | string;
  status: JobStatus;
  source_url: string;
  platform: Platform;
  product: ProductInfo | string;
  script_text: string;
  caption: string;
  error_message: string | null;
  voice_mode: VoiceMode;
  post_status: string | null;
  post_message: string | null;
  affiliate_url: string | null;
  video: unknown;
  audio: unknown;
  video_mime: string | null;
  audio_mime: string | null;
  duration_sec: number | null;
};

const SAMPLE_FILES = new Set(["serum.jpg", "serum-2.jpg", "earbuds.jpg"]);

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseProduct(value: ProductInfo | string | null): ProductInfo | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as ProductInfo;
    } catch {
      return null;
    }
  }
  return value;
}

export function toPublic(row: JobRow, imageCount = 0): JobPublic {
  const product = parseProduct(row.product);
  return {
    id: row.id,
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    sourceUrl: row.source_url,
    platform: row.platform,
    product,
    scriptText: row.script_text,
    caption: row.caption,
    errorMessage: row.error_message,
    voiceMode: row.voice_mode,
    postStatus: row.post_status,
    postMessage: row.post_message,
    affiliateUrl: row.affiliate_url,
    durationSec: row.duration_sec,
    hasVideo: asBuffer(row.video) != null,
    hasAudio: asBuffer(row.audio) != null,
    imageCount,
    sample: Boolean(product?.sample),
  };
}

export async function listJobs(owner: string): Promise<JobPublic[]> {
  const rows = await sql<JobRow>(
    "select * from jobs where owner = $1 order by created_at desc limit 30",
    [owner],
  );
  if (rows.length === 0) return [];
  const counts = await sql<{ job_id: string; n: string | number }>(
    "select job_id, count(*)::int as n from job_images group by job_id",
  );
  const map = new Map(counts.map((row) => [row.job_id, Number(row.n)]));
  return rows.map((row) => toPublic(row, map.get(row.id) ?? 0));
}

export async function getJob(id: string, owner: string): Promise<JobRow | null> {
  const rows = await sql<JobRow>("select * from jobs where id = $1 and owner = $2 limit 1", [id, owner]);
  return rows[0] ?? null;
}

export async function getJobImage(id: string, owner: string, index: number) {
  const job = await getJob(id, owner);
  if (!job) return null;
  const rows = await sql<{ mime: string; data: unknown }>(
    "select mime, data from job_images where job_id = $1 order by sort_order asc offset $2 limit 1",
    [id, index],
  );
  const row = rows[0];
  if (!row) return null;
  const data = asBuffer(row.data);
  if (!data) return null;
  return { mime: row.mime, data };
}

async function setJob(id: string, fields: Record<string, unknown>) {
  const keys = Object.keys(fields);
  const assignments = keys.map((key, index) => `${key} = $${index + 2}`).join(", ");
  await sql(`update jobs set ${assignments}, updated_at = now() where id = $1`, [
    id,
    ...keys.map((key) => fields[key]),
  ]);
}

async function loadLocalSample(url: string): Promise<{ mime: string; data: Buffer } | null> {
  if (!url.startsWith("/sample/")) return null;
  const name = path.basename(url);
  if (!SAMPLE_FILES.has(name)) return null;
  const data = await readFile(path.join(process.cwd(), "public", "sample", name));
  return { mime: "image/jpeg", data };
}

async function pruneOldJobs(owner: string) {
  const extra = await sql<{ id: string }>(
    `select id from jobs where owner = $1 order by created_at desc offset 20`,
    [owner],
  );
  for (const row of extra) {
    await sql("delete from job_images where job_id = $1", [row.id]);
    await sql("delete from jobs where id = $1", [row.id]);
  }
}

export async function createAndProcessJob(opts: {
  owner: string;
  url?: string;
  sample?: boolean;
  sampleKind?: "shopee" | "tiktok";
}): Promise<JobPublic> {
  const busy = await sql<{ n: string | number }>(
    "select count(*)::int as n from jobs where owner = $1 and status in ('queued','fetching','writing','speaking','rendering','posting')",
    [opts.owner],
  );
  if (Number(busy[0]?.n ?? 0) > 0) {
    throw new Error("กำลังทำคลิปให้อยู่ รอคลิปนี้เสร็จก่อนนะ");
  }
  const recent = await sql<{ n: string | number }>(
    "select count(*)::int as n from jobs where owner = $1 and created_at > now() - interval '60 minutes'",
    [opts.owner],
  );
  if (Number(recent[0]?.n ?? 0) >= 8) {
    throw new Error("ทำคลิปครบโควตาชั่วโมงนี้แล้ว ลองใหม่ภายหลัง");
  }

  const id = crypto.randomUUID();
  let product: ProductInfo;
  let sourceUrl: string;
  if (opts.sample) {
    product = sampleProduct(opts.sampleKind ?? "shopee");
    sourceUrl = product.productUrl;
  } else {
    product = await resolveProduct(opts.url ?? "");
    sourceUrl = opts.url!.trim();
  }

  await sql(
    `insert into jobs (id, owner, status, source_url, platform, product, script_text, caption)
     values ($1,$2,'queued',$3,$4,$5::jsonb,'','')`,
    [id, opts.owner, sourceUrl, product.platform, JSON.stringify(product)],
  );
  await pruneOldJobs(opts.owner);
  try {
    await processJob(id, opts.owner);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ทำคลิปไม่สำเร็จ";
    await setJob(id, { status: "failed", error_message: message });
  }
  const row = await getJob(id, opts.owner);
  if (!row) throw new Error("ไม่พบงาน");
  const images = await sql<{ n: string | number }>(
    "select count(*)::int as n from job_images where job_id = $1",
    [id],
  );
  return toPublic(row, Number(images[0]?.n ?? 0));
}

export async function processJob(id: string, owner: string): Promise<void> {
  const row = await getJob(id, owner);
  if (!row) throw new Error("ไม่พบงาน");
  const product = parseProduct(row.product);
  if (!product) throw new Error("ไม่มีข้อมูลสินค้า");

  await setJob(id, { status: "fetching", error_message: null });
  await sql("delete from job_images where job_id = $1", [id]);
  const images: { mime: string; data: Buffer; name: string }[] = [];
  for (const url of product.imageUrls.slice(0, 4)) {
    const local = await loadLocalSample(url);
    const downloaded = local ?? (await downloadProductImage(url));
    if (downloaded) {
      images.push({ ...downloaded, name: `img${images.length}.jpg` });
    }
  }
  if (images.length === 0) {
    const fallback = await loadLocalSample("/sample/serum.jpg");
    if (fallback) images.push({ ...fallback, name: "img0.jpg" });
  }
  if (images.length === 0) throw new Error("ไม่มีรูปสินค้าให้ทำคลิป");
  for (const [index, image] of images.entries()) {
    await sql(
      "insert into job_images (id, job_id, sort_order, mime, data) values ($1,$2,$3,$4,$5)",
      [crypto.randomUUID(), id, index, image.mime, image.data],
    );
  }

  await setJob(id, { status: "writing" });
  const copy = writeThaiCopy(product);
  await setJob(id, {
    script_text: copy.script,
    caption: copy.caption,
    affiliate_url: product.affiliateUrl,
  });

  if (!(await ffmpegAvailable())) {
    throw new Error("เครื่องนี้ยังไม่มี ffmpeg จึงตัดคลิปไม่ได้");
  }

  const workDir = await mkdtemp(path.join(os.tmpdir(), "afiliate-"));
  try {
    await mkdir(workDir, { recursive: true });
    const imagePaths: string[] = [];
    for (const image of images) {
      const file = path.join(workDir, image.name);
      await writeFile(file, image.data);
      imagePaths.push(file);
    }

    await setJob(id, { status: "speaking" });
    const wavPath = path.join(workDir, "voice.wav");
    const speech = await speakThai(copy.script, wavPath);
    let audioPath: string | null = null;
    if (speech.audio) {
      audioPath = wavPath;
      await writeFile(audioPath, speech.audio);
      await setJob(id, { audio: speech.audio, audio_mime: speech.mime ?? "audio/wav", voice_mode: speech.mode });
    } else {
      await setJob(id, { voice_mode: "captions" });
    }

    await setJob(id, { status: "rendering" });
    const clip = await renderVerticalClip({
      workDir,
      images: imagePaths,
      audioPath,
      product,
      sentences: copy.sentences,
    });
    await setJob(id, {
      status: "ready",
      video: clip.video,
      video_mime: "video/mp4",
      duration_sec: clip.durationSec,
      error_message: speech.mode === "captions" ? speech.note : null,
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function regenerateJob(id: string, owner: string, scriptText?: string): Promise<JobPublic> {
  const row = await getJob(id, owner);
  if (!row) throw new Error("ไม่พบงาน");
  const product = parseProduct(row.product);
  if (!product) throw new Error("ไม่มีข้อมูลสินค้า");
  const nextScript = sanitizeSpeech(scriptText ?? row.script_text);
  if (!nextScript) throw new Error("ใส่บทพากย์ก่อนนะ");
  const copy = writeThaiCopy(product);
  copy.script = nextScript;
  copy.sentences = nextScript.split(/(?<=[ค่ะคะครับ]\s+)|(?<=\s)/).reduce<string[]>((acc, part) => {
    const piece = part.trim();
    if (!piece) return acc;
    const last = acc[acc.length - 1];
    if (!last || last.length > 48) acc.push(piece);
    else acc[acc.length - 1] = `${last} ${piece}`.trim();
    return acc;
  }, []);
  if (copy.sentences.length === 0) copy.sentences = [nextScript];
  await setJob(id, { script_text: nextScript, caption: copy.caption, status: "queued", error_message: null });

  const workDir = await mkdtemp(path.join(os.tmpdir(), "afiliate-"));
  try {
    const stored = await sql<{ mime: string; data: unknown; sort_order: number }>(
      "select mime, data, sort_order from job_images where job_id = $1 order by sort_order asc",
      [id],
    );
    const imagePaths: string[] = [];
    for (const [index, image] of stored.entries()) {
      const data = asBuffer(image.data);
      if (!data) continue;
      const file = path.join(workDir, `img${index}.jpg`);
      await writeFile(file, data);
      imagePaths.push(file);
    }
    if (imagePaths.length === 0) throw new Error("ไม่มีรูปสินค้า");
    await setJob(id, { status: "speaking" });
    const wavPath = path.join(workDir, "voice.wav");
    const speech = await speakThai(nextScript, wavPath);
    let audioPath: string | null = null;
    if (speech.audio) {
      audioPath = wavPath;
      await writeFile(audioPath, speech.audio);
      await setJob(id, { audio: speech.audio, audio_mime: speech.mime ?? "audio/wav", voice_mode: speech.mode });
    }
    await setJob(id, { status: "rendering" });
    const clip = await renderVerticalClip({
      workDir,
      images: imagePaths,
      audioPath,
      product,
      sentences: copy.sentences,
    });
    await setJob(id, {
      status: "ready",
      video: clip.video,
      video_mime: "video/mp4",
      duration_sec: clip.durationSec,
      error_message: speech.mode === "captions" ? speech.note : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ทำคลิปใหม่ไม่สำเร็จ";
    await setJob(id, { status: "failed", error_message: message });
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
  const updated = await getJob(id, owner);
  if (!updated) throw new Error("ไม่พบงาน");
  return toPublic(updated, 1);
}

export async function requestShopeePost(id: string, owner: string): Promise<JobPublic> {
  const row = await getJob(id, owner);
  if (!row) throw new Error("ไม่พบงาน");
  if (row.status !== "ready" && row.status !== "needs_tap" && row.status !== "posted") {
    throw new Error("รอคลิปพร้อมก่อนแล้วค่อยโพสต์");
  }
  await setJob(id, { status: "posting" });
  const result = await postToShopee(toPublic(row), asBuffer(row.video));
  await setJob(id, {
    status: result.status === "posted" ? "posted" : result.status === "needs_tap" ? "needs_tap" : "failed",
    post_status: result.status,
    post_message: result.message,
    error_message: result.status === "failed" ? result.message : null,
  });
  const updated = await getJob(id, owner);
  if (!updated) throw new Error("ไม่พบงาน");
  const images = await sql<{ n: string | number }>(
    "select count(*)::int as n from job_images where job_id = $1",
    [id],
  );
  return toPublic(updated, Number(images[0]?.n ?? 0));
}
