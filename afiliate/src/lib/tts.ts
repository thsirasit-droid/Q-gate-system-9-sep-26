import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { secrets } from "./env";
import { sanitizeSpeech } from "./text";
import type { VoiceMode } from "./types";

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
          audioConfig: { audioEncoding: "MP3", speakingRate: 1.02 },
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

async function espeakSpeak(text: string, wavPath: string): Promise<Buffer> {
  assertTempPath(wavPath);
  const textPath = path.join(path.dirname(wavPath), "speech.txt");
  assertTempPath(textPath);
  await writeFile(textPath, text, "utf8");
  await execFileAsync("espeak-ng", ["-v", "th", "-s", "145", "-w", wavPath, "-f", textPath], {
    timeout: 20_000,
    maxBuffer: 2_000_000,
  });
  return readFile(wavPath);
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
  if (secrets().googleTtsKey) {
    try {
      const audio = await googleSpeak(clipped);
      return {
        audio,
        mime: "audio/mpeg",
        mode: "google",
        note: "พากย์ด้วย Google เสียงไทย",
      };
    } catch {
      // fall through to espeak
    }
  }
  try {
    const audio = await espeakSpeak(clipped, wavPath);
    return {
      audio,
      mime: "audio/wav",
      mode: "espeak",
      note: "พากย์สำรองด้วย espeak-ng (เสียงหุ่นยนต์กว่า Google) เพราะยังไม่มีคีย์ Google TTS",
    };
  } catch {
    await writeFile(wavPath, "");
    return {
      audio: null,
      mime: null,
      mode: "captions",
      note: "ยังไม่มีเสียงพากย์ — คลิปนี้มีแต่ซับภาษาไทย จนกว่าจะใส่คีย์ Google TTS",
    };
  }
}
