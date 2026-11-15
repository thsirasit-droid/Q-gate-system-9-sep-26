"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import type { JobPublic } from "@/lib/types";

export default function JobPage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<JobPublic | null>(null);
  const [script, setScript] = useState("");
  const [busy, setBusy] = useState<"regen" | "post" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/jobs/${params.id}`);
    const payload = (await response.json()) as { job?: JobPublic; error?: string };
    if (payload.job) {
      setJob(payload.job);
      setScript(payload.job.scriptText);
    } else {
      setError(payload.error ?? "ไม่พบงาน");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function regenerate() {
    setBusy("regen");
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${params.id}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ script }),
      });
      const payload = (await response.json()) as { job?: JobPublic; error?: string };
      if (!response.ok || !payload.job) {
        setError(payload.error ?? "ทำคลิปใหม่ไม่สำเร็จ");
        return;
      }
      setJob(payload.job);
      setScript(payload.job.scriptText);
    } finally {
      setBusy(null);
    }
  }

  async function postShopee() {
    setBusy("post");
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${params.id}/post`, { method: "POST" });
      const payload = (await response.json()) as { job?: JobPublic; error?: string };
      if (!response.ok || !payload.job) {
        setError(payload.error ?? "โพสต์ไม่สำเร็จ");
        return;
      }
      setJob(payload.job);
    } finally {
      setBusy(null);
    }
  }

  async function copyCaption() {
    if (!job) return;
    try {
      await navigator.clipboard.writeText(job.caption);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("คัดลอกไม่สำเร็จ กดค้างที่ข้อความแล้วคัดลอกเอง");
    }
  }

  if (!job) {
    return (
      <main className="mx-auto max-w-[430px] px-4 py-10">
        <p className="text-mute">{error ?? "กำลังเปิดงาน…"}</p>
      </main>
    );
  }

  const tone = STATUS_TONE[job.status];
  const statusColor =
    tone === "go" ? "text-moss" : tone === "warn" ? "text-amber-800" : tone === "bad" ? "text-brick" : "text-mute";
  const needsTap = job.status === "needs_tap";

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-4 pb-16 pt-5">
      <Link href="/" className="text-[14px] text-mute">
        ← คลิปของฉัน
      </Link>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-bold leading-7">{job.product?.name ?? "คลิป"}</h1>
        <span className={`shrink-0 text-[13px] ${statusColor}`}>{STATUS_LABEL[job.status]}</span>
      </div>
      <p className="mt-1 text-[13px] text-mute">
        {job.platform === "shopee" ? "Shopee" : "TikTok Shop"}
        {job.product?.priceText ? ` · ฿${job.product.priceText}` : ""}
        {job.sample ? " · ตัวอย่าง" : ""}
      </p>

      {job.hasVideo ? (
        <video
          className="mt-4 w-full rounded-xl bg-black"
          src={`/api/jobs/${job.id}/media?kind=video`}
          controls
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => {
            const el = event.currentTarget;
            el.muted = false;
            el.defaultMuted = false;
            el.volume = 1;
          }}
          poster={job.imageCount ? `/api/jobs/${job.id}/media?kind=image&n=0` : undefined}
        />
      ) : (
        <div className="mt-4 rounded-xl bg-sand px-4 py-16 text-center text-[14px] text-mute">
          ยังไม่มีคลิปพรีวิว
        </div>
      )}

      {job.errorMessage && job.status !== "needs_tap" ? (
        <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-[13px] leading-5">{job.errorMessage}</p>
      ) : null}

      <button
        type="button"
        disabled={busy !== null || !job.hasVideo}
        onClick={() => void postShopee()}
        className="mt-5 w-full rounded-xl bg-brick py-3.5 text-[18px] font-bold text-white disabled:opacity-60"
      >
        {busy === "post" ? "กำลังส่งไป Shopee…" : "โพสต์ไป Shopee"}
      </button>

      {job.hasVideo ? (
        <a
          href={`/api/jobs/${job.id}/media?kind=video&download=1`}
          className="mt-2 block w-full rounded-xl border border-sand bg-white py-3 text-center text-[16px] font-bold"
        >
          ดาวน์โหลดคลิป
        </a>
      ) : null}

      <button
        type="button"
        onClick={() => void copyCaption()}
        className="mt-2 w-full rounded-xl border border-sand bg-white py-3 text-[16px] font-bold"
      >
        {copied ? "คัดลอกแคปชันแล้ว" : "คัดลอกแคปชัน"}
      </button>

      {needsTap || job.postMessage ? (
        <div className="mt-4 rounded-xl bg-white px-3 py-3 text-[14px] leading-6">
          <p className="font-bold">ถ้า Shopee ยังไม่อัปโหลดให้เอง</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>กดดาวน์โหลดคลิป</li>
            <li>กดคัดลอกแคปชัน</li>
            <li>เปิดแอป Shopee → วิดีโอ → อัปโหลด → แปะแคปชัน</li>
          </ol>
        </div>
      ) : (
        <p className="mt-4 text-[13px] leading-6 text-mute">
          ปุ่มโพสต์จะอัปโหลดให้เมื่อเชื่อม Shopee Video แล้ว ถ้ายังไม่เชื่อม ให้ดาวน์โหลดแล้วเปิดแอป Shopee
        </p>
      )}

      <details className="mt-6">
        <summary className="cursor-pointer text-[14px] font-bold">แก้บทพากย์ถ้าไม่ชอบ</summary>
        <textarea
          id="script"
          value={script}
          onChange={(event) => setScript(event.target.value)}
          rows={5}
          className="mt-2 w-full resize-none rounded-xl border border-sand bg-white px-3 py-3 text-[16px] outline-none ring-brick focus:ring-2"
        />
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void regenerate()}
          className="mt-2 w-full rounded-xl border border-sand bg-white py-3 text-[15px] font-bold disabled:opacity-60"
        >
          {busy === "regen" ? "กำลังพากย์ใหม่…" : "ทำคลิปใหม่จากบทนี้"}
        </button>
      </details>

      {error ? <p className="mt-3 text-[14px] text-brick">{error}</p> : null}
    </main>
  );
}
