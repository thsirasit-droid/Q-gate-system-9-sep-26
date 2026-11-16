import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { buildAssFile } from "./script";
import type { ProductInfo } from "./types";

const execFileAsync = promisify(execFile);

export function ffmpegBin(): string {
  return process.env.FFMPEG_PATH?.trim() || ffmpegStatic || "ffmpeg";
}

export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync(ffmpegBin(), ["-version"], { timeout: 8_000 });
    return true;
  } catch {
    return false;
  }
}

async function durationOf(file: string): Promise<number> {
  let text = "";
  try {
    const result = await execFileAsync(ffmpegBin(), ["-hide_banner", "-i", file, "-f", "null", "-"], {
      timeout: 20_000,
    });
    text = `${result.stderr ?? ""}`;
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    text = `${err.message ?? ""}\n${err.stderr ?? ""}`;
  }
  const match = text.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (match) {
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  return 0;
}

function assertRel(file: string, kind: string): string {
  const rel = path.basename(file);
  if (!/^[a-zA-Z0-9._-]+$/.test(rel)) throw new Error(`${kind}ไม่ถูกต้อง`);
  return rel;
}

function paletteFor(product: ProductInfo): { c0: string; c1: string; card: string; accent: string } {
  const hay = `${product.name} ${product.description}`.toLowerCase();
  if (/ที่นอน|หมอน|ยางพารา|mattress|bed|lotus/.test(hay)) {
    return { c0: "0x16110C", c1: "0xD4AF37", card: "0x2A2118", accent: "0xD4AF37" };
  }
  if (/เซรั่ม|ครีม|ผิว|serum|skin/.test(hay)) {
    return { c0: "0x1A1014", c1: "0xE8A0B4", card: "0x2C1A22", accent: "0xE8A0B4" };
  }
  return { c0: "0x101820", c1: "0x4DA3FF", card: "0x182430", accent: "0x4DA3FF" };
}

function productMotion(label: string, index: number): string {
  const xShift = index % 2 === 0 ? "28*sin(2*PI*t/5)" : "28*cos(2*PI*t/6)";
  const yShift = index % 2 === 0 ? "18*cos(2*PI*t/7)" : "18*sin(2*PI*t/4)";
  return `[${label}]scale=900:900:force_original_aspect_ratio=increase,crop=640:640:x='(in_w-640)/2+${xShift}':y='(in_h-640)/2+${yShift}',setsar=1[p${index}]`;
}

function buildFilter(opts: { product: ProductInfo; duration: number; imageCount: number }): string {
  const p = paletteFor(opts.product);
  const a = (opts.duration * 0.34).toFixed(2);
  const b = (opts.duration * 0.68).toFixed(2);
  const chains: string[] = [
    `[0:v]hue=h='12*sin(2*PI*t/5)':s=1.04,drawbox=x=0:y=0:w=720:h=16:color=${p.accent}@1:t=fill,drawbox=x=0:y=1264:w=720:h=16:color=${p.accent}@1:t=fill,drawbox=x=36:y=196:w=648:h=648:color=${p.accent}@1:t=6[bg]`,
  ];
  if (opts.imageCount === 0) {
    chains.push(
      `[bg]drawbox=x=90:y=880:w=540:h=100:color=${p.accent}@0.94:t=fill,fps=30,format=yuv420p,subtitles=captions.ass:fontsdir=fonts[vout]`,
    );
    return chains.join(";");
  }
  for (let i = 0; i < opts.imageCount; i += 1) {
    chains.push(productMotion(`${i + 1}:v`, i));
  }
  const windows =
    opts.imageCount === 1
      ? ["gte(t\\,0)"]
      : opts.imageCount === 2
        ? [`lt(t\\,${((opts.duration * 0.5).toFixed(2))})`, `gte(t\\,${((opts.duration * 0.5).toFixed(2))})`]
        : [`between(t\\,0\\,${a})`, `between(t\\,${a}\\,${b})`, `gte(t\\,${b})`];
  let prev = "bg";
  for (let i = 0; i < opts.imageCount; i += 1) {
    const next = i === opts.imageCount - 1 ? "over" : `s${i}`;
    chains.push(`[${prev}][p${i}]overlay=40:200:enable='${windows[i]}'[${next}]`);
    prev = next;
  }
  chains.push(
    `[over]drawbox=x=140:y=860:w=440:h=96:color=${p.accent}@0.94:t=fill:enable='between(t\\,${a}\\,${b})',drawbox=x=90:y=860:w=540:h=96:color=${p.card}@0.92:t=fill:enable='gte(t\\,${b})',fps=30,format=yuv420p,subtitles=captions.ass:fontsdir=fonts[vout]`,
  );
  return chains.join(";");
}

export async function renderVerticalClip(opts: {
  workDir: string;
  images?: string[];
  videos?: string[];
  audioPath: string | null;
  product: ProductInfo;
  sentences: string[];
}): Promise<{ video: Buffer; durationSec: number }> {
  const bin = ffmpegBin();
  const fontsSrc = path.resolve(process.cwd(), "assets/fonts");
  const fontsDir = path.join(opts.workDir, "fonts");
  await mkdir(fontsDir, { recursive: true });
  await copyFile(path.join(fontsSrc, "NotoSansThai-Regular.ttf"), path.join(fontsDir, "NotoSansThai-Regular.ttf"));
  await copyFile(path.join(fontsSrc, "NotoSansThai-Bold.ttf"), path.join(fontsDir, "NotoSansThai-Bold.ttf"));

  let duration = opts.audioPath ? await durationOf(opts.audioPath) : 0;
  if (!duration || duration < 8) duration = 12;
  duration = Math.min(28, Math.max(10, duration));

  await writeFile(
    path.join(opts.workDir, "captions.ass"),
    buildAssFile({ product: opts.product, sentences: opts.sentences, durationSec: duration }),
    "utf8",
  );

  const imageRels = (opts.images ?? []).slice(0, 3).map((file) => assertRel(file, "ชื่อไฟล์รูป"));
  const audioRel = opts.audioPath ? assertRel(opts.audioPath, "ชื่อไฟล์เสียง") : null;
  const pal = paletteFor(opts.product);
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-t",
    duration.toFixed(2),
    "-i",
    `gradients=s=720x1280:c0=${pal.c0}:c1=${pal.c1}:speed=0.07:nb_colors=2`,
  ];
  for (const rel of imageRels) {
    args.push("-loop", "1", "-t", duration.toFixed(2), "-i", rel);
  }
  if (audioRel) {
    args.push("-i", audioRel);
  } else {
    args.push("-f", "lavfi", "-t", duration.toFixed(2), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  }
  const audioIndex = 1 + imageRels.length;
  args.push(
    "-filter_complex",
    buildFilter({ product: opts.product, duration, imageCount: imageRels.length }),
    "-map",
    "[vout]",
    "-map",
    `${audioIndex}:a:0`,
    "-af",
    "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=2.5,apad",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-profile:a",
    "aac_low",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-b:a",
    "192k",
    "-t",
    duration.toFixed(2),
    "-movflags",
    "+faststart",
    "clip.mp4",
  );
  await execFileAsync(bin, args, { cwd: opts.workDir, timeout: 90_000, maxBuffer: 8_000_000 });

  const { readFile } = await import("node:fs/promises");
  const video = await readFile(path.join(opts.workDir, "clip.mp4"));
  if (video.length > 12_000_000) throw new Error("คลิปใหญ่เกินไป");
  return { video, durationSec: duration };
}
