import { hostAllowed } from "./http";
import type { Platform } from "./types";

export const SHOPEE_PAGE_HOSTS = [
  "shopee.co.th",
  "shopee.com",
  "shopee.sg",
  "s.shopee.co.th",
  "shp.ee",
];
export const TIKTOK_PAGE_HOSTS = ["tiktok.com", "shop.tiktok.com", "vt.tiktok.com", "vm.tiktok.com"];

export function detectPlatform(raw: string): Platform | "rejected" | "empty" {
  const text = raw.trim();
  if (!text) return "empty";
  if (/lazada\./i.test(text)) return "rejected";
  try {
    const url = new URL(text);
    if (hostAllowed(url.hostname, SHOPEE_PAGE_HOSTS)) return "shopee";
    if (hostAllowed(url.hostname, TIKTOK_PAGE_HOSTS)) return "tiktok";
    return "rejected";
  } catch {
    return "rejected";
  }
}

export function parseShopeeIds(url: string): { shopId: string; itemId: string } | null {
  const shopItem = url.match(/\/product\/(\d+)\/(\d+)/);
  if (shopItem) return { shopId: shopItem[1], itemId: shopItem[2] };
  const dotted = url.match(/-i\.(\d+)\.(\d+)/);
  if (dotted) return { shopId: dotted[1], itemId: dotted[2] };
  try {
    const parsed = new URL(url);
    const queryItem = parsed.searchParams.get("itemid") ?? parsed.searchParams.get("itemId");
    const queryShop = parsed.searchParams.get("shopid") ?? parsed.searchParams.get("shopId");
    if (queryItem && queryShop) return { shopId: queryShop, itemId: queryItem };
  } catch {
    return null;
  }
  return null;
}

export function parseTiktokProductId(url: string): string | null {
  const view = url.match(/\/view\/product\/(\d+)/);
  if (view) return view[1];
  const pdp = url.match(/\/pdp\/(\d+)/);
  if (pdp) return pdp[1];
  try {
    return new URL(url).searchParams.get("product_id");
  } catch {
    return null;
  }
}
