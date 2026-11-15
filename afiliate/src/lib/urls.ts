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

export function digitsOnly(value: string | null | undefined): string | null {
  if (!value || !/^\d{1,20}$/.test(value)) return null;
  return value;
}

export function parseShopeeIds(url: string): { shopId: string; itemId: string } | null {
  const shopItem = url.match(/\/product\/(\d{1,20})\/(\d{1,20})/);
  if (shopItem) return { shopId: shopItem[1], itemId: shopItem[2] };
  const dotted = url.match(/-i\.(\d{1,20})\.(\d{1,20})/);
  if (dotted) return { shopId: dotted[1], itemId: dotted[2] };
  try {
    const parsed = new URL(url);
    const queryItem = digitsOnly(parsed.searchParams.get("itemid") ?? parsed.searchParams.get("itemId"));
    const queryShop = digitsOnly(parsed.searchParams.get("shopid") ?? parsed.searchParams.get("shopId"));
    if (queryItem && queryShop) return { shopId: queryShop, itemId: queryItem };
  } catch {
    return null;
  }
  return null;
}

export function parseTiktokProductId(url: string): string | null {
  const view = url.match(/\/view\/product\/(\d{1,20})/);
  if (view) return view[1];
  const pdp = url.match(/\/pdp\/(\d{1,20})/);
  if (pdp) return pdp[1];
  try {
    return digitsOnly(new URL(url).searchParams.get("product_id"));
  } catch {
    return null;
  }
}
