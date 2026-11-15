import type { JobStatus } from "./types";

export const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "รอคิว",
  fetching: "กำลังอ่านสินค้า",
  writing: "กำลังเขียนบท",
  speaking: "กำลังพากย์ไทย",
  rendering: "กำลังตัดคลิป",
  ready: "พร้อมพรีวิว",
  posting: "กำลังส่งไป Shopee",
  posted: "ส่งไป Shopee แล้ว",
  needs_tap: "ต้องแตะในแอป Shopee",
  failed: "ไม่สำเร็จ",
};

export const STATUS_TONE: Record<JobStatus, "wait" | "go" | "warn" | "bad"> = {
  queued: "wait",
  fetching: "wait",
  writing: "wait",
  speaking: "wait",
  rendering: "wait",
  ready: "go",
  posting: "wait",
  posted: "go",
  needs_tap: "warn",
  failed: "bad",
};
