import { createHash } from "node:crypto";
import { fetchAllowed, resolveRedirects } from "./http";
import { parseShopeeIds } from "./urls";
import { secrets } from "./env";
import type { ProductInfo } from "./types";

const GRAPHQL = "https://open-api.affiliate.shopee.co.th/graphql";
const SHOPEE_HOSTS = ["shopee.co.th", "shopee.com", "shopee.sg", "s.shopee.co.th", "shp.ee", "open-api.affiliate.shopee.co.th"];

function authHeader(appId: string, secret: string, timestamp: string): string {
  const signature = createHash("sha256").update(`${appId}${timestamp}${secret}`).digest("hex");
  return `SHA256 Credential=${appId}, Signature=${signature}, Timestamp=${timestamp}`;
}

async function graphql<T>(query: string): Promise<T> {
  const s = secrets();
  if (!s.shopeeAppId || !s.shopeeSecret) {
    throw new Error("ยังไม่มีคีย์ Shopee Affiliate");
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const got = await fetchAllowed(GRAPHQL, SHOPEE_HOSTS, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: authHeader(s.shopeeAppId, s.shopeeSecret, timestamp),
    },
    body: JSON.stringify({ query }),
    timeoutMs: 15_000,
    maxBytes: 800_000,
  });
  const payload = JSON.parse(got.buffer.toString("utf8")) as {
    data?: T;
    errors?: { message?: string }[];
  };
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || "Shopee API ส่งข้อผิดพลาด");
  }
  if (!payload.data) throw new Error("Shopee API ไม่ส่งข้อมูลกลับ");
  return payload.data;
}

type OfferNode = {
  itemId?: string | number;
  productName?: string;
  imageUrl?: string;
  priceMin?: string | number;
  priceMax?: string | number;
  productLink?: string;
  offerLink?: string;
  shopName?: string;
  shopId?: string | number;
};

function priceText(node: OfferNode): string {
  const min = Number(node.priceMin ?? 0);
  const max = Number(node.priceMax ?? min);
  if (!min && !max) return "";
  if (min && max && min !== max) return `${Math.round(min)}–${Math.round(max)}`;
  return String(Math.round(min || max));
}

function toProduct(node: OfferNode, fallbackUrl: string): ProductInfo {
  return {
    platform: "shopee",
    name: (node.productName ?? "สินค้า Shopee").trim(),
    priceText: priceText(node),
    priceValue: Number(node.priceMin ?? node.priceMax ?? 0) || null,
    currency: "THB",
    imageUrls: node.imageUrl ? [String(node.imageUrl)] : [],
    shopName: String(node.shopName ?? ""),
    productUrl: String(node.productLink ?? fallbackUrl),
    affiliateUrl: node.offerLink ? String(node.offerLink) : null,
    productId: node.itemId != null ? String(node.itemId) : null,
    shopId: node.shopId != null ? String(node.shopId) : null,
    description: "",
    source: "api",
    sample: false,
  };
}

export async function shopeeProductByUrl(rawUrl: string): Promise<ProductInfo> {
  let url = rawUrl.trim();
  try {
    url = (await resolveRedirects(url, ["shopee.co.th", "shopee.com", "s.shopee.co.th", "shp.ee"])).toString();
  } catch {
    // keep original if resolve fails; GraphQL may still accept it
  }
  const ids = parseShopeeIds(url);
  const args = ids
    ? `itemId: ${ids.itemId}, shopId: ${ids.shopId}, page: 1, limit: 5`
    : `keyword: ${JSON.stringify(url)}, page: 1, limit: 5`;
  const data = await graphql<{ productOfferV2?: { nodes?: OfferNode[] } }>(
    `{ productOfferV2(${args}) { nodes { itemId productName imageUrl priceMin priceMax productLink offerLink shopName shopId } } }`,
  );
  const node = data.productOfferV2?.nodes?.[0];
  if (!node) throw new Error("Shopee หาสินค้าจากลิงก์นี้ไม่เจอ ลองวางลิงก์หน้าร้านแบบเต็ม");
  return toProduct(node, url);
}

export async function shopeeShortLink(originUrl: string): Promise<string | null> {
  const data = await graphql<{ generateShortLink?: { shortLink?: string } }>(
    `mutation { generateShortLink(input:{ originUrl: ${JSON.stringify(originUrl)}, subIds: ["afiliate"] }) { shortLink } }`,
  );
  return data.generateShortLink?.shortLink ?? null;
}
