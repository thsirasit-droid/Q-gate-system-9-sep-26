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
  try {
    await execFileAsync(ffmpegBin(), ["-i", file, "-f", "null", "-"], {
      timeout: 20_000,
    });
  } catch (error) {
    const text = error instanceof Error ? `${error.message}\n${String((error as { stderr?: string }).stderr ?? "")}` : "";
    const match = text.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (match) {
      return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    }
  }
  return 0;
}

export async function renderVerticalClip(opts: {
  workDir: string;
  images: string[];
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

  const perImage = duration / Math.max(1, opts.images.length);
  const listPath = path.join(opts.workDir, "slides.txt");
  const lines: string[] = [];
  opts.images.forEach((image, index) => {
    const rel = path.basename(image);
    if (!/^[a-zA-Z0-9._-]+$/.test(rel)) throw new Error("ชื่อไฟล์รูปไม่ถูกต้อง");
    lines.push(`file '${rel}'`);
    lines.push(`duration ${perImage.toFixed(3)}`);
    if (index === opts.images.length - 1) lines.push(`file '${rel}'`);
  });
  await writeFile(listPath, `${lines.join("\n")}\n`, "utf8");
  await writeFile(
    path.join(opts.workDir, "captions.ass"),
    buildAssFile({ product: opts.product, sentences: opts.sentences, durationSec: duration }),
    "utf8",
  );

  const outPath = path.join(opts.workDir, "clip.mp4");
  const vf =
    "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,subtitles=captions.ass:fontsdir=fonts";
  const args = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "slides.txt",
  ];
  if (opts.audioPath) {
    const audioRel = path.basename(opts.audioPath);
    if (!/^[a-zA-Z0-9._-]+$/.test(audioRel)) throw new Error("ชื่อไฟล์เสียงไม่ถูกต้อง");
    args.push("-i", audioRel);
  } else {
    args.push("-f", "lavfi", "-t", duration.toFixed(2), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  }
  args.push(
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    "clip.mp4",
  );
  await execFileAsync(bin, args, { cwd: opts.workDir, timeout: 90_000, maxBuffer: 8_000_000 });
  const { readFile } = await import("node:fs/promises");
  const video = await readFile(outPath);
  if (video.length > 12_000_000) throw new Error("คลิปใหญ่เกินไป");
  return { video, durationSec: duration };
}
