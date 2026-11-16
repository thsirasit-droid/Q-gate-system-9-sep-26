import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { secrets } from "./env";
import { sanitizeSpeech } from "./text";
import type { VoiceMode } from "./types";
import { ffmpegBin } from "./video";

const execFileAsync = promisify(execFile);

export type SpeechResult = {
  audio: Buffer | null;
  mime: string | null;
  mode: VoiceMode;
  note: string;
};

async function googleSpeak(text: string): Promise<Buffer> {
  const key = secrets().googleTtsKey;
  const voices = ["th-TH-Chirp3-HD-Aoede", "th-TH-Neural2-C"];
  let lastError = "Google TTS ไม่สำเร็จ";
  for (const voice of voices) {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: "th-TH", name: voice },
          audioConfig: { audioEncoding: "MP3", speakingRate: 1.02, volumeGainDb: 12 },
        }),
      },
    );
    const payload = (await response.json()) as { audioContent?: string; error?: { message?: string } };
    if (response.ok && payload.audioContent) {
      return Buffer.from(payload.audioContent, "base64");
    }
    lastError = payload.error?.message || lastError;
  }
  throw new Error(lastError);
}

function assertTempPath(filePath: string): void {
  const resolved = path.resolve(filePath);
  const tmp = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tmp}${path.sep}`)) {
    throw new Error("เส้นทางไฟล์เสียงไม่ถูกต้อง");
  }
}

function thaiTtsScript(): string {
  const resolved = path.resolve(process.cwd(), "scripts/thai-tts.py");
  const root = path.resolve(process.cwd(), "scripts");
  if (!resolved.startsWith(`${root}${path.sep}`) || path.basename(resolved) !== "thai-tts.py") {
    throw new Error("สคริปต์เสียงไทยไม่ถูกต้อง");
  }
  return resolved;
}

async function neuralSpeak(text: string, mp3Path: string): Promise<Buffer> {
  assertTempPath(mp3Path);
  const textPath = path.join(path.dirname(mp3Path), "speech.txt");
  assertTempPath(textPath);
  await writeFile(textPath, text, "utf8");
  try {
    await execFileAsync("python3", [thaiTtsScript(), "--text-file", textPath, "--out", mp3Path], {
      timeout: 60_000,
      maxBuffer: 4_000_000,
      env: {
        ...process.env,
        HOME: process.env.HOME ?? os.homedir(),
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
        PATH: process.env.PATH ?? "/usr/bin:/bin",
      },
    });
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string; message?: string };
    const detail = `${err.stderr ?? ""} ${err.stdout ?? ""} ${err.message ?? ""}`.trim().replace(/\s+/g, " ").slice(0, 400);
    throw new Error(detail || "พากย์เสียงไทยไม่สำเร็จ");
  }
  const mp3 = await readFile(mp3Path);
  if (mp3.length < 1000) {
    throw new Error("ระบบพากย์ไทยไม่ได้สร้างไฟล์เสียง");
  }
  return mp3;
}

/** Resample to 48 kHz stereo and raise speech so the file itself is loud. */
export async function loudifyVoiceover(inputPath: string, outputPath: string): Promise<void> {
  assertTempPath(inputPath);
  assertTempPath(outputPath);
  await execFileAsync(
    ffmpegBin(),
    [
      "-y",
      "-i",
      inputPath,
      "-af",
      "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,dynaudnorm=f=75:g=20:p=0.9,volume=3,alimiter=limit=0.97",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-c:a",
      "pcm_s16le",
      outputPath,
    ],
    { timeout: 30_000, maxBuffer: 8_000_000 },
  );
  const loud = await readFile(outputPath);
  if (loud.length < 2000) {
    throw new Error("ปรับเสียงพากย์ไม่สำเร็จ");
  }
}

async function finishLoud(
  rawPath: string,
  wavPath: string,
  mode: VoiceMode,
  note: string,
): Promise<SpeechResult> {
  await loudifyVoiceover(rawPath, wavPath);
  return {
    audio: await readFile(wavPath),
    mime: "audio/wav",
    mode,
    note,
  };
}

export async function speakThai(text: string, wavPath: string): Promise<SpeechResult> {
  const clipped = sanitizeSpeech(text);
  if (!clipped) {
    return {
      audio: null,
      mime: null,
      mode: "captions",
      note: "บทพากย์ว่าง จึงทำเฉพาะซับภาษาไทย",
    };
  }
  const dir = path.dirname(wavPath);
  if (secrets().googleTtsKey) {
    try {
      const audio = await googleSpeak(clipped);
      const rawPath = path.join(dir, "voice-raw.mp3");
      assertTempPath(rawPath);
      await writeFile(rawPath, audio);
      return await finishLoud(rawPath, wavPath, "google", "พากย์ด้วย Google เสียงไทย");
    } catch {
      // fall through to neural Thai (no key)
    }
  }
  try {
    const rawPath = path.join(dir, "voice-raw.mp3");
    await neuralSpeak(clipped, rawPath);
    return await finishLoud(
      rawPath,
      wavPath,
      "neural",
      "พากย์ไทยด้วยเสียง Neural (Microsoft Premwadee) ไม่ใช้ espeak",
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    throw new Error(`ทำเสียงพากย์ไทยไม่สำเร็จ (${detail})`);
  }
}
