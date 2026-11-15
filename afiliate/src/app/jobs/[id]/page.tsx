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

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-4 pb-16 pt-5">
      <Link href="/" className="text-[14px] text-mute">
        ← งานทั้งหมด
      </Link>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-bold leading-7">{job.product?.name ?? "คลิป"}</h1>
        <span className={`shrink-0 text-[13px] ${statusColor}`}>{STATUS_LABEL[job.status]}</span>
      </div>
      <p className="mt-1 text-[13px] text-mute">
        {job.platform === "shopee" ? "Shopee" : "TikTok Shop"}
        {job.product?.priceText ? ` · ฿${job.product.priceText}` : ""}
        {job.sample ? " · ข้อมูลตัวอย่าง" : ""}
      </p>

      {job.hasVideo ? (
        <video
          className="mt-4 w-full rounded-xl bg-black"
          src={`/api/jobs/${job.id}/media?kind=video`}
          controls
          playsInline
          poster={job.imageCount ? `/api/jobs/${job.id}/media?kind=image&n=0` : undefined}
        />
      ) : (
        <div className="mt-4 rounded-xl bg-sand px-4 py-16 text-center text-[14px] text-mute">
          ยังไม่มีคลิปพรีวิว
        </div>
      )}

      {job.errorMessage ? (
        <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-[13px] leading-5">{job.errorMessage}</p>
      ) : null}

      <label className="mt-6 block text-[14px] font-bold" htmlFor="script">
        บทพากย์ไทย
      </label>
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
        {busy === "regen" ? "กำลังพากย์ใหม่…" : "แก้บทแล้วทำคลิปใหม่"}
      </button>

      <h2 className="mt-6 text-[14px] font-bold">แคปชันที่จะโพสต์</h2>
      <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-white px-3 py-3 text-[13px] leading-6 text-ink">
        {job.caption}
      </pre>

      <button
        type="button"
        disabled={busy !== null || !job.hasVideo}
        onClick={() => void postShopee()}
        className="mt-5 w-full rounded-xl bg-brick py-3.5 text-[17px] font-bold text-white disabled:opacity-60"
      >
        {busy === "post" ? "กำลังส่งไป Shopee…" : "โพสต์ไป Shopee"}
      </button>

      {job.hasVideo ? (
        <a
          href={`/api/jobs/${job.id}/media?kind=video&download=1`}
          className="mt-2 block w-full rounded-xl border border-sand bg-white py-3 text-center text-[15px] font-bold"
        >
          ดาวน์โหลดคลิป
        </a>
      ) : null}

      {job.postMessage ? (
        <p className="mt-4 rounded-xl bg-white px-3 py-3 text-[14px] leading-6">{job.postMessage}</p>
      ) : (
        <p className="mt-4 text-[13px] leading-6 text-mute">
          Shopee Affiliate สร้างลิงก์นายหน้าได้ แต่การอัปโหลดคลิปต้องใช้แอป Video บน Open Platform
          ถ้ายังไม่ได้เชื่อม ปุ่มนี้จะให้ดาวน์โหลดคลิป แล้วเปิดแอป Shopee อัปโหลดเอง
        </p>
      )}

      {error ? <p className="mt-3 text-[14px] text-brick">{error}</p> : null}
    </main>
  );
}
