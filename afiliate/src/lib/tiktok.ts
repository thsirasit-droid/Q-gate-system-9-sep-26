import { createHmac } from "node:crypto";
import { fetchAllowed, resolveRedirects } from "./http";
import { parseTiktokProductId, TIKTOK_PAGE_HOSTS } from "./urls";
import { secrets } from "./env";
import type { ProductInfo } from "./types";

const API_HOSTS = ["open-api.tiktokglobalshop.com", "open-api.tiktokshop.com"];

type TiktokProduct = {
  id?: string;
  title?: string;
  main_image_url?: string;
  detail_link?: string;
  shop?: { name?: string };
  sales_price?: { minimum_amount?: string; currency?: string };
  original_price?: { minimum_amount?: string; currency?: string };
};

function sign(secret: string, path: string, query: Record<string, string>, body: string): string {
  const sorted = Object.keys(query)
    .sort()
    .map((key) => `${key}${query[key]}`)
    .join("");
  const base = `${path}${sorted}${body}`;
  return createHmac("sha256", secret).update(base).digest("hex");
}

export async function tiktokProductByUrl(rawUrl: string): Promise<ProductInfo> {
  const s = secrets();
  if (!s.tiktokAppKey || !s.tiktokAppSecret || !s.tiktokAccessToken) {
    throw new Error("ยังไม่มีคีย์ TikTok Shop");
  }
  let url = rawUrl.trim();
  try {
    url = (await resolveRedirects(url, TIKTOK_PAGE_HOSTS)).toString();
  } catch {
    // keep original
  }
  const productId = parseTiktokProductId(url);
  if (!productId) {
    throw new Error("อ่านรหัสสินค้า TikTok Shop จากลิงก์นี้ไม่ได้ ลองวางลิงก์หน้าร้านแบบเต็ม");
  }
  const path = "/affiliate_creator/202509/open_collaborations/products";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const query: Record<string, string> = {
    app_key: s.tiktokAppKey,
    timestamp,
    product_ids: productId,
  };
  const body = "";
  query.sign = sign(s.tiktokAppSecret, path, query, body);
  const search = new URLSearchParams(query).toString();
  const endpoint = `https://open-api.tiktokglobalshop.com${path}?${search}`;
  const got = await fetchAllowed(endpoint, API_HOSTS, {
    method: "GET",
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": s.tiktokAccessToken,
    },
    timeoutMs: 15_000,
    maxBytes: 800_000,
  });
  const payload = JSON.parse(got.buffer.toString("utf8")) as {
    code?: number;
    message?: string;
    data?: { products?: TiktokProduct[] };
  };
  if (payload.code && payload.code !== 0) {
    throw new Error(payload.message || "TikTok Shop API ส่งข้อผิดพลาด");
  }
  const node = payload.data?.products?.[0];
  if (!node) throw new Error("TikTok Shop หาสินค้านี้ไม่เจอ หรือสินค้าไม่อยู่ในรายการที่บัญชีคุณปักได้");
  const amount = node.sales_price?.minimum_amount ?? node.original_price?.minimum_amount ?? "";
  return {
    platform: "tiktok",
    name: (node.title ?? "สินค้า TikTok Shop").trim(),
    priceText: amount ? String(Math.round(Number(amount))) : "",
    priceValue: amount ? Number(amount) : null,
    currency: node.sales_price?.currency ?? "THB",
    imageUrls: node.main_image_url ? [node.main_image_url] : [],
    shopName: node.shop?.name ?? "",
    productUrl: node.detail_link ?? url,
    affiliateUrl: null,
    productId: node.id ?? productId,
    shopId: null,
    description: "",
    source: "api",
    sample: false,
  };
}
