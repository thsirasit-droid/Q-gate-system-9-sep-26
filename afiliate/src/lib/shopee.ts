import { createHash } from "node:crypto";
import { fetchAllowed, hostAllowed, resolveRedirects } from "./http";
import { digitsOnly, parseShopeeIds, SHOPEE_PAGE_HOSTS } from "./urls";
import { secrets } from "./env";
import type { ProductInfo } from "./types";

const GRAPHQL = "https://open-api.affiliate.shopee.co.th/graphql";
const SHOPEE_HOSTS = ["shopee.co.th", "shopee.com", "shopee.sg", "s.shopee.co.th", "shp.ee", "open-api.affiliate.shopee.co.th"];

function authHeader(appId: string, secret: string, timestamp: string): string {
  const signature = createHash("sha256").update(`${appId}${timestamp}${secret}`).digest("hex");
  return `SHA256 Credential=${appId}, Signature=${signature}, Timestamp=${timestamp}`;
}

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
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
    body: JSON.stringify(variables ? { query, variables } : { query }),
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
  const itemId = digitsOnly(ids?.itemId);
  const shopId = digitsOnly(ids?.shopId);
  const data = await graphql<{ productOfferV2?: { nodes?: OfferNode[] } }>(
    `query Product($itemId: Int64, $shopId: Int64, $keyword: String) {
      productOfferV2(itemId: $itemId, shopId: $shopId, keyword: $keyword, page: 1, limit: 5) {
        nodes { itemId productName imageUrl priceMin priceMax productLink offerLink shopName shopId }
      }
    }`,
    itemId && shopId
      ? { itemId, shopId, keyword: null }
      : { itemId: null, shopId: null, keyword: url.slice(0, 200) },
  );
  const node = data.productOfferV2?.nodes?.[0];
  if (!node) throw new Error("Shopee หาสินค้าจากลิงก์นี้ไม่เจอ ลองวางลิงก์หน้าร้านแบบเต็ม");
  return toProduct(node, url);
}

export async function shopeeShortLink(originUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(originUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || !hostAllowed(parsed.hostname, SHOPEE_PAGE_HOSTS)) {
    return null;
  }
  const data = await graphql<{ generateShortLink?: { shortLink?: string } }>(
    `mutation Short($originUrl: String!) {
      generateShortLink(input:{ originUrl: $originUrl, subIds: ["afiliate"] }) { shortLink }
    }`,
    { originUrl: parsed.toString().slice(0, 500) },
  );
  return data.generateShortLink?.shortLink ?? null;
}
