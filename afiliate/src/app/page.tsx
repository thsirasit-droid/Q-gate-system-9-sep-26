"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import type { JobPublic, JobStatus } from "@/lib/types";

type StatusPayload = {
  viewer: { name: string; simulated: boolean } | null;
  connections: {
    shopeeAffiliate: boolean;
    shopeeVideo: boolean;
    tiktokShop: boolean;
    googleTts: boolean;
    ffmpeg: boolean;
    sampleMode: boolean;
  };
};

function toneClass(status: JobStatus): string {
  const tone = STATUS_TONE[status];
  if (tone === "go") return "text-moss";
  if (tone === "warn") return "text-amber-800";
  if (tone === "bad") return "text-brick";
  return "text-mute";
}

function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-mute">
      <span className={`h-2 w-2 rounded-full ${on ? "bg-moss" : "bg-sand"}`} />
      {label}
    </span>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [jobs, setJobs] = useState<JobPublic[]>([]);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [jobsRes, statusRes] = await Promise.all([fetch("/api/jobs"), fetch("/api/status")]);
    if (jobsRes.ok) {
      const payload = (await jobsRes.json()) as { jobs: JobPublic[] };
      setJobs(payload.jobs);
    }
    if (statusRes.ok) setStatus((await statusRes.json()) as StatusPayload);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createJob(body: { url?: string; sample?: boolean; sampleKind?: "shopee" | "tiktok" }) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { job?: JobPublic; error?: string };
      if (!response.ok || !payload.job) {
        setError(payload.error ?? "สร้างคลิปไม่สำเร็จ");
        return;
      }
      router.push(`/jobs/${payload.job.id}`);
    } catch {
      setError("เน็ตหลุด ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-4 pb-16 pt-6">
      <header className="mb-6">
        <p className="text-[13px] tracking-wide text-mute">แอปมือถือ · คลิปนายหน้า</p>
        <h1 className="mt-1 text-[32px] font-bold leading-none">อะฟิลิเอต</h1>
        <p className="mt-2 text-[15px] leading-6 text-mute">
          วางลิงก์ Shopee หรือ TikTok Shop แล้วได้คลิปแนวตั้ง พากย์ไทย มีซับ
        </p>
      </header>

      <section className="mb-5 flex flex-wrap gap-x-4 gap-y-2">
        <Dot on={Boolean(status?.connections.shopeeAffiliate)} label="Shopee สินค้า" />
        <Dot on={Boolean(status?.connections.shopeeVideo)} label="Shopee คลิป" />
        <Dot on={Boolean(status?.connections.tiktokShop)} label="TikTok Shop" />
        <Dot on={Boolean(status?.connections.googleTts)} label="เสียง Google" />
      </section>

      {status?.viewer?.simulated ? (
        <p className="mb-4 rounded-lg bg-sand px-3 py-2 text-[13px] leading-5 text-mute">
          ตอนนี้เปิดบนเครื่องพัฒนา ผู้ชมเป็นตัวจำลอง ไม่ใช่การล็อกอินจริง
        </p>
      ) : null}

      <form
        className="mb-3"
        onSubmit={(event) => {
          event.preventDefault();
          void createJob({ url });
        }}
      >
        <label className="mb-2 block text-[14px] font-bold" htmlFor="product-url">
          วางลิงก์สินค้า
        </label>
        <textarea
          id="product-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          rows={3}
          placeholder="https://shopee.co.th/..."
          className="w-full resize-none rounded-xl border border-sand bg-white px-3 py-3 text-[16px] outline-none ring-brick focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-brick py-3.5 text-[17px] font-bold text-white disabled:opacity-60"
        >
          {busy ? "กำลังทำคลิป… รอสักครู่" : "สร้างคลิป"}
        </button>
      </form>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void createJob({ sample: true, sampleKind: "shopee" })}
          className="flex-1 rounded-xl border border-sand bg-white py-3 text-[14px] font-bold disabled:opacity-60"
        >
          ลองสินค้าตัวอย่าง
        </button>
      </div>

      {error ? <p className="mb-4 text-[14px] leading-5 text-brick">{error}</p> : null}

      <section>
        <h2 className="mb-3 text-[16px] font-bold">งานของฉัน</h2>
        {jobs.length === 0 ? (
          <p className="text-[14px] leading-6 text-mute">ยังไม่มีคลิป กดสร้างจากลิงก์หรือสินค้าตัวอย่างได้เลย</p>
        ) : (
          <ul className="divide-y divide-sand overflow-hidden rounded-xl border border-sand bg-white">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link href={`/jobs/${job.id}`} className="block px-3 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[15px] font-bold">
                      {job.product?.name ?? "กำลังอ่านสินค้า"}
                    </p>
                    <span className={`shrink-0 text-[12px] ${toneClass(job.status)}`}>
                      {STATUS_LABEL[job.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-mute">
                    {job.platform === "shopee" ? "Shopee" : "TikTok Shop"}
                    {job.sample ? " · ข้อมูลตัวอย่าง" : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-[12px] leading-5 text-mute">
        ปักไอคอนไว้หน้าจอ: iPhone เปิดใน Safari กดแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม” · Android เปิดใน Chrome กดเมนู
        แล้วเลือก “เพิ่มไปยังหน้าจอหลัก”
      </p>
    </main>
  );
}
