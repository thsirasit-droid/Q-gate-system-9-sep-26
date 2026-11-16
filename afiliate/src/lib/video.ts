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

function zoompanFilter(index: number, frames: number): string {
  const n = Math.max(30, frames);
  const modes = [
    `z='min(1.05+0.0012*on,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
    `z='1.14':x='(iw-iw/zoom)*on/${n}':y='ih/2-(ih/zoom/2)'`,
    `z='min(1.18-0.0009*on,1.18)':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*on/${n}'`,
    `z='1.12':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(1-on/${n})'`,
  ];
  return `scale=960:1708:force_original_aspect_ratio=increase,crop=960:1708,zoompan=${modes[index % modes.length]}:d=${n}:s=720x1280:fps=30,setsar=1,format=yuv420p`;
}

async function renderKenBurnsStack(
  bin: string,
  workDir: string,
  images: string[],
  duration: number,
): Promise<string> {
  const count = Math.max(1, images.length);
  const per = duration / count;
  const parts: string[] = [];
  for (const [index, image] of images.entries()) {
    const rel = assertRel(image, "ชื่อไฟล์รูป");
    const frames = Math.max(45, Math.round(per * 30));
    const outRel = `motion${index}.mp4`;
    await execFileAsync(
      bin,
      [
        "-y",
        "-loop",
        "1",
        "-i",
        rel,
        "-vf",
        zoompanFilter(index, frames),
        "-t",
        per.toFixed(3),
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        outRel,
      ],
      { cwd: workDir, timeout: 60_000, maxBuffer: 4_000_000 },
    );
    parts.push(outRel);
  }
  const listPath = path.join(workDir, "motion.txt");
  await writeFile(listPath, `${parts.map((rel) => `file '${rel}'`).join("\n")}\n`, "utf8");
  if (parts.length === 1) return parts[0];
  await execFileAsync(
    bin,
    ["-y", "-f", "concat", "-safe", "0", "-i", "motion.txt", "-c", "copy", "motion-stack.mp4"],
    { cwd: workDir, timeout: 30_000, maxBuffer: 4_000_000 },
  );
  return "motion-stack.mp4";
}

async function mixVoiceAndSubs(opts: {
  bin: string;
  workDir: string;
  videoRel: string;
  audioRel: string | null;
  duration: number;
  loopVideo: boolean;
}): Promise<void> {
  const vf =
    "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30,subtitles=captions.ass:fontsdir=fonts";
  const args = ["-y"];
  if (opts.loopVideo) args.push("-stream_loop", "-1");
  args.push("-i", opts.videoRel);
  if (opts.audioRel) {
    args.push("-i", opts.audioRel);
  } else {
    args.push("-f", "lavfi", "-t", opts.duration.toFixed(2), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  }
  args.push(
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-vf",
    vf,
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
    opts.duration.toFixed(2),
    "-movflags",
    "+faststart",
    "clip.mp4",
  );
  await execFileAsync(opts.bin, args, { cwd: opts.workDir, timeout: 90_000, maxBuffer: 8_000_000 });
}

export async function renderVerticalClip(opts: {
  workDir: string;
  images: string[];
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

  const audioRel = opts.audioPath ? assertRel(opts.audioPath, "ชื่อไฟล์เสียง") : null;
  const seller = (opts.videos ?? []).find((file) => /^[a-zA-Z0-9._-]+$/.test(path.basename(file)));
  let made = false;
  if (seller) {
    try {
      await mixVoiceAndSubs({
        bin,
        workDir: opts.workDir,
        videoRel: path.basename(seller),
        audioRel,
        duration,
        loopVideo: true,
      });
      made = true;
    } catch {
      // Ken Burns stills if the seller file will not decode
    }
  }
  if (!made) {
    if (opts.images.length === 0) throw new Error("ไม่มีรูปสินค้าให้ทำคลิป");
    const stackRel = await renderKenBurnsStack(bin, opts.workDir, opts.images, duration);
    await mixVoiceAndSubs({
      bin,
      workDir: opts.workDir,
      videoRel: stackRel,
      audioRel,
      duration,
      loopVideo: false,
    });
  }

  const { readFile } = await import("node:fs/promises");
  const outPath = path.join(opts.workDir, "clip.mp4");

  const video = await readFile(outPath);
  if (video.length > 12_000_000) throw new Error("คลิปใหญ่เกินไป");
  return { video, durationSec: duration };
}
