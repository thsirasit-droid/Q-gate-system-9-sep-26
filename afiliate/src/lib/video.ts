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

function paletteFor(product: ProductInfo): { c0: string; c1: string; c2: string } {
  const hay = `${product.name} ${product.description}`.toLowerCase();
  if (/ที่นอน|หมอน|ยางพารา|mattress|bed|lotus/.test(hay)) {
    return { c0: "0x120E0A", c1: "0x3A2A14", c2: "0xD4AF37" };
  }
  if (/เซรั่ม|ครีม|ผิว|skin|serum|whitening|vitaminc|clearnose|สกิน/.test(hay)) {
    return { c0: "0x1A1014", c1: "0x4A2030", c2: "0xE8A0B4" };
  }
  return { c0: "0x101820", c1: "0x1C3048", c2: "0x4DA3FF" };
}

async function writeGradientStill(
  bin: string,
  workDir: string,
  outRel: string,
  c0: string,
  c1: string,
): Promise<void> {
  await execFileAsync(
    bin,
    ["-y", "-f", "lavfi", "-i", `gradients=s=720x1280:c0=${c0}:c1=${c1}:nb_colors=2`, "-frames:v", "1", outRel],
    { cwd: workDir, timeout: 20_000, maxBuffer: 2_000_000 },
  );
}

/** Original drama stills from product facts. Listing photos keep their shape/colors; never a square crop or slideshow. */
async function generateFactScenes(
  bin: string,
  workDir: string,
  product: ProductInfo,
  heroRel: string | null,
): Promise<string[]> {
  const pal = paletteFor(product);
  await writeGradientStill(bin, workDir, "scene0.png", pal.c0, pal.c1);
  await writeGradientStill(bin, workDir, "scene1.png", pal.c1, pal.c2);
  await writeGradientStill(bin, workDir, "scene2.png", pal.c2, pal.c0);
  if (heroRel) {
    await execFileAsync(
      bin,
      [
        "-y",
        "-i",
        heroRel,
        "-vf",
        "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,eq=saturation=1.05:contrast=1.04",
        "-frames:v",
        "1",
        "scene1p.png",
      ],
      { cwd: workDir, timeout: 20_000, maxBuffer: 4_000_000 },
    );
    await execFileAsync(
      bin,
      [
        "-y",
        "-i",
        "scene2.png",
        "-i",
        heroRel,
        "-filter_complex",
        "[1:v]scale=580:980:force_original_aspect_ratio=decrease,setsar=1[h];[0:v][h]overlay=(W-w)/2:(H-h)/2-24",
        "-frames:v",
        "1",
        "scene2h.png",
      ],
      { cwd: workDir, timeout: 20_000, maxBuffer: 4_000_000 },
    );
    return ["scene0.png", "scene1p.png", "scene2h.png"];
  }
  return ["scene0.png", "scene1.png", "scene2.png"];
}

async function imageToVideo(
  bin: string,
  workDir: string,
  stills: string[],
  duration: number,
): Promise<string> {
  const count = Math.max(1, stills.length);
  const per = duration / count;
  const parts: string[] = [];
  for (const [index, still] of stills.entries()) {
    const rel = assertRel(still, "ชื่อไฟล์ฉาก");
    const frames = Math.max(48, Math.round(per * 30));
    const zoom =
      index % 2 === 0 ? `min(1.04+0.001*on,1.14)` : `min(1.14-0.0007*on,1.14)`;
    const outRel = `beat${index}.mp4`;
    await execFileAsync(
      bin,
      [
        "-y",
        "-loop",
        "1",
        "-i",
        rel,
        "-vf",
        `scale=960:1708:force_original_aspect_ratio=increase,crop=960:1708,zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=720x1280:fps=30,setsar=1,format=yuv420p`,
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
  await writeFile(path.join(workDir, "beats.txt"), `${parts.map((rel) => `file '${rel}'`).join("\n")}\n`, "utf8");
  if (parts.length === 1) return parts[0];
  await execFileAsync(bin, ["-y", "-f", "concat", "-safe", "0", "-i", "beats.txt", "-c", "copy", "beats.mp4"], {
    cwd: workDir,
    timeout: 30_000,
    maxBuffer: 4_000_000,
  });
  return "beats.mp4";
}

export async function renderVerticalClip(opts: {
  workDir: string;
  images?: string[];
  videos?: string[];
  sceneStills?: string[];
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
  const sceneStills = (opts.sceneStills ?? []).map((file) => assertRel(file, "ชื่อไฟล์ฉาก"));
  const hero = (opts.images ?? []).slice(0, 1).map((file) => assertRel(file, "ชื่อไฟล์รูป"))[0] ?? null;
  const stills =
    sceneStills.length > 0 ? sceneStills : await generateFactScenes(bin, opts.workDir, opts.product, hero);
  const stackRel = await imageToVideo(bin, opts.workDir, stills, duration);

  const pal = paletteFor(opts.product);
  const args = ["-y", "-i", stackRel];
  if (audioRel) args.push("-i", audioRel);
  else args.push("-f", "lavfi", "-t", duration.toFixed(2), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  args.push(
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-vf",
    `drawbox=x=0:y=0:w=720:h=14:color=${pal.c2}@1:t=fill,drawbox=x=0:y=1266:w=720:h=14:color=${pal.c2}@1:t=fill,setsar=1,fps=30,format=yuv420p,subtitles=captions.ass:fontsdir=fonts`,
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
