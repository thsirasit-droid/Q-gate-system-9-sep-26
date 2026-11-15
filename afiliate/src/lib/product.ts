import { fetchAllowed } from "./http";
import { SAMPLE_SHOPEE, SAMPLE_TIKTOK } from "./sample-data";
import { secrets } from "./env";
import { shopeeProductByUrl, shopeeProductFromPublicPage, shopeeShortLink } from "./shopee";
import { tiktokProductByUrl } from "./tiktok";
import { detectPlatform, SHOPEE_PAGE_HOSTS, TIKTOK_PAGE_HOSTS } from "./urls";
import type { ProductInfo } from "./types";

export { detectPlatform } from "./urls";

const IMAGE_HOSTS = [
  ...SHOPEE_PAGE_HOSTS,
  ...TIKTOK_PAGE_HOSTS,
  "susercontent.com",
  "cf.shopee.co.th",
  "cf.shopee.com",
  "down-th.img.susercontent.com",
  "down-bs.img.susercontent.com",
  "ibyteimg.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
];

async function maybeAffiliateLink(product: ProductInfo): Promise<ProductInfo> {
  const s = secrets();
  if (!s.shopeeAppId || !s.shopeeSecret) return product;
  try {
    product.affiliateUrl = (await shopeeShortLink(product.productUrl)) ?? product.affiliateUrl ?? null;
  } catch {
    product.affiliateUrl = product.affiliateUrl ?? null;
  }
  return product;
}

export async function resolveProduct(rawUrl: string): Promise<ProductInfo> {
  const platform = detectPlatform(rawUrl);
  if (platform === "empty") throw new Error("วางลิงก์สินค้าก่อนนะ");
  if (platform === "rejected") {
    throw new Error("ตอนนี้รับเฉพาะลิงก์ Shopee และ TikTok Shop ไม่รับ Lazada หรือเว็บอื่น");
  }
  if (platform === "shopee") {
    const s = secrets();
    if (s.shopeeAppId && s.shopeeSecret) {
      try {
        return await maybeAffiliateLink(await shopeeProductByUrl(rawUrl));
      } catch {
        // Affiliate API is optional; public page fetch still makes the clip.
      }
    }
    return maybeAffiliateLink(await shopeeProductFromPublicPage(rawUrl));
  }
  const s = secrets();
  if (s.tiktokAppKey && s.tiktokAppSecret && s.tiktokAccessToken) {
    return tiktokProductByUrl(rawUrl);
  }
  throw new Error(
    "ยังไม่ได้ใส่คีย์ TikTok Shop จึงดึงสินค้าจริงไม่ได้ กด “ลองสินค้าตัวอย่าง” ได้เลย หรือใส่คีย์ในที่เก็บความลับของ Cursor",
  );
}

export function sampleProduct(kind: "shopee" | "tiktok" = "shopee"): ProductInfo {
  return kind === "tiktok" ? { ...SAMPLE_TIKTOK } : { ...SAMPLE_SHOPEE };
}

export async function downloadProductImage(url: string): Promise<{ mime: string; data: Buffer } | null> {
  if (url.startsWith("/sample/")) return null;
  try {
    const got = await fetchAllowed(url, IMAGE_HOSTS, { maxBytes: 1_500_000, timeoutMs: 10_000 });
    const mime = got.contentType.split(";")[0] || "image/jpeg";
    if (!mime.startsWith("image/")) return null;
    return { mime, data: got.buffer };
  } catch {
    return null;
  }
}
