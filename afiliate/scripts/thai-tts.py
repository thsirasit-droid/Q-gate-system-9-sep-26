#!/usr/bin/env python3
"""Neural Thai TTS via Microsoft Edge. No API key. Not espeak."""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path

VOICE = "th-TH-PremwadeeNeural"


def clean_text(text: str) -> str:
    text = text.replace("…", " ").replace("...", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


async def synthesize(text: str, voice: str, out: Path, attempts: int = 6) -> None:
    import edge_tts

    last: Exception | None = None
    for attempt in range(attempts):
        try:
            await edge_tts.Communicate(text, voice, rate="-5%").save(str(out))
            if out.is_file() and out.stat().st_size >= 1000:
                return
            last = RuntimeError("ไฟล์เสียงสั้นเกินไป")
        except Exception as exc:  # noqa: BLE001 — retry Microsoft empty responses
            last = exc
        await asyncio.sleep(0.7 * (attempt + 1))
    raise last or RuntimeError("edge-tts ไม่ได้สร้างไฟล์เสียง")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text-file", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--voice", default=VOICE)
    args = parser.parse_args()
    text = clean_text(Path(args.text_file).read_text(encoding="utf-8"))
    if not text:
        print("บทพากย์ว่าง", file=sys.stderr)
        sys.exit(2)
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        print("ติดตั้ง edge-tts ไม่พบ (pip install edge-tts)", file=sys.stderr)
        sys.exit(3)

    try:
        asyncio.run(synthesize(text, args.voice, Path(args.out)))
    except Exception as exc:
        print(f"edge-tts ล้มเหลว: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(5)


if __name__ == "__main__":
    main()
