import { createHmac } from "node:crypto";
import { fetchAllowed } from "./http";
import { secrets } from "./env";
import type { JobPublic, PostResult } from "./types";

const PARTNER_HOSTS = ["partner.shopeemobile.com", "partner.test-stable.shopeemobile.com"];
const PARTNER_BASE = "https://partner.shopeemobile.com";

function tapResult(job: JobPublic, extra: string): PostResult {
  return {
    ok: true,
    status: "needs_tap",
    downloadHint: true,
    message: extra,
  };
}

function partnerSign(path: string, timestamp: number, body: string): string {
  const s = secrets();
  const base = `${s.shopeePartnerId}${path}${timestamp}${s.shopeeAccessToken}${body}`;
  return createHmac("sha256", s.shopeePartnerKey).update(base).digest("hex");
}

async function partnerPost(path: string, payload: unknown): Promise<Record<string, unknown>> {
  const s = secrets();
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(payload);
  const sign = partnerSign(path, timestamp, body);
  const url =
    `${PARTNER_BASE}${path}?partner_id=${encodeURIComponent(s.shopeePartnerId)}` +
    `&timestamp=${timestamp}&sign=${sign}&access_token=${encodeURIComponent(s.shopeeAccessToken)}` +
    `&user_id=${encodeURIComponent(s.shopeeUserId)}`;
  const got = await fetchAllowed(url, PARTNER_HOSTS, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    timeoutMs: 20_000,
    maxBytes: 1_000_000,
  });
  return JSON.parse(got.buffer.toString("utf8")) as Record<string, unknown>;
}

function splitParts(video: Buffer, size = 4_000_000): Buffer[] {
  const parts: Buffer[] = [];
  for (let i = 0; i < video.length; i += size) parts.push(video.subarray(i, i + size));
  return parts;
}

export async function postToShopee(job: JobPublic, video: Buffer | null): Promise<PostResult> {
  const s = secrets();
  const hasVideoApi = Boolean(
    s.shopeePartnerId && s.shopeePartnerKey && s.shopeeAccessToken && s.shopeeUserId,
  );

  if (!hasVideoApi) {
    return tapResult(
      job,
      "Shopee Affiliate API สร้างลิงก์นายหน้าได้ แต่ไม่มีช่องอัปโหลดคลิปวิดีโอ " +
        "ให้ดาวน์โหลดคลิปนี้ แล้วเปิดแอป Shopee → วิดีโอ → อัปโหลด → แปะแคปชัน (มีลิงก์นายหน้าถ้าใส่คีย์ Affiliate แล้ว) " +
        "ถ้าต้องการให้ระบบอัปโหลดแทน ต้องสร้างแอปประเภท Video บน Shopee Open Platform แล้วใส่ Partner ID, Partner Key, Access Token และ User ID",
    );
  }

  if (!video) {
    return { ok: false, status: "failed", downloadHint: false, message: "ยังไม่มีไฟล์คลิปให้อัปโหลด" };
  }

  try {
    const fileMd5 = (await import("node:crypto")).createHash("md5").update(video).digest("hex");
    const init = await partnerPost("/api/v2/media/init_video_upload", {
      file_md5: fileMd5,
      file_size: video.length,
    });
    const videoUploadId = String(
      (init.response as { video_upload_id?: string } | undefined)?.video_upload_id ??
        (init.video_upload_id as string | undefined) ??
        "",
    );
    if (!videoUploadId) {
      const err = String(init.message ?? init.error ?? "init_video_upload ไม่คืนรหัสอัปโหลด");
      return tapResult(
        job,
        `Shopee ยังไม่อนุญาตให้อัปโหลดคลิปผ่าน API (${err}) — ดาวน์โหลดคลิปแล้วเปิดแอป Shopee อัปโหลดเอง`,
      );
    }
    const parts = splitParts(video);
    for (let i = 0; i < parts.length; i += 1) {
      await partnerPost("/api/v2/media/upload_video_part", {
        video_upload_id: videoUploadId,
        part_seq: i,
        content_md5: (await import("node:crypto")).createHash("md5").update(parts[i]).digest("hex"),
      });
    }
    await partnerPost("/api/v2/media/complete_video_upload", {
      video_upload_id: videoUploadId,
      part_seq_list: parts.map((_, i) => i),
      upload_cost: 1,
    });
    await partnerPost("/api/v2/video/edit_video_info", {
      video_upload_list: [
        {
          video_upload_id: videoUploadId,
          title: job.product?.name?.slice(0, 32) ?? "คลิปนายหน้า",
          desc: job.caption.slice(0, 200),
          item_id: job.product?.productId ? Number(job.product.productId) : undefined,
        },
      ],
    });
    const posted = await partnerPost("/api/v2/video/post_video", {
      video_upload_id_list: [videoUploadId],
    });
    const success = Array.isArray((posted.response as { success_list?: unknown[] } | undefined)?.success_list)
      ? ((posted.response as { success_list: unknown[] }).success_list.length > 0)
      : posted.error == null || posted.error === "";
    if (success) {
      return {
        ok: true,
        status: "posted",
        downloadHint: false,
        message: "อัปโหลดและส่งโพสต์ไป Shopee Video แล้ว เปิดแอป Shopee ตรวจว่าคลิปขึ้นหรือยังถูกเก็บเป็นฉบับร่าง",
      };
    }
    return tapResult(
      job,
      "อัปโหลดคลิปเข้า Shopee ได้แล้ว แต่การเผยแพร่ยังไม่ผ่าน — เปิดแอป Shopee ที่แท็บวิดีโอ/ฉบับร่าง แล้วกดโพสต์เอง",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ";
    return tapResult(
      job,
      `เรียก Shopee Video API ไม่สำเร็จ (${message}) — ดาวน์โหลดคลิปแล้วเปิดแอป Shopee อัปโหลดเอง อย่าใช้โปรแกรมแอบกดแอปแทน`,
    );
  }
}
