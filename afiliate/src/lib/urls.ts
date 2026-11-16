import { hostAllowed } from "./http";
import type { Platform } from "./types";

export const SHOPEE_PAGE_HOSTS = [
  "shopee.co.th",
  "shopee.com",
  "shopee.sg",
  "s.shopee.co.th",
  "shp.ee",
  "shope.ee",
];
export const TIKTOK_PAGE_HOSTS = ["tiktok.com", "shop.tiktok.com", "vt.tiktok.com", "vm.tiktok.com"];

const SHOPEE_RESERVED_PATHS = new Set([
  "product",
  "shop",
  "buyer",
  "search",
  "mall",
  "verify",
  "cart",
  "checkout",
  "user",
  "me",
  "order",
  "blog",
  "api",
  "download",
  "m",
  "r",
  "universal-link",
  "from_same_shop",
  "top_products",
  "find_similar_products",
  "daily_discover",
  "addon-deal-selection",
  "bundle-deal",
  "opensource",
  "index.html",
  "help",
]);

export type ShopeeRef = {
  shopId: string | null;
  itemId: string | null;
  shopUsername: string | null;
};

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
  const ref = parseShopeeRef(url);
  if (ref.shopId && ref.itemId) return { shopId: ref.shopId, itemId: ref.itemId };
  return null;
}

export function parseShopeeRef(url: string): ShopeeRef {
  const shopItem = url.match(/\/product\/(\d{1,20})\/(\d{1,20})/);
  if (shopItem) return { shopId: shopItem[1], itemId: shopItem[2], shopUsername: null };
  const dotted = url.match(/-i\.(\d{1,20})\.(\d{1,20})/);
  if (dotted) return { shopId: dotted[1], itemId: dotted[2], shopUsername: null };
  try {
    const parsed = new URL(url);
    const queryItem = digitsOnly(parsed.searchParams.get("itemid") ?? parsed.searchParams.get("itemId"));
    const queryShop = digitsOnly(parsed.searchParams.get("shopid") ?? parsed.searchParams.get("shopId"));
    if (queryItem && queryShop) return { shopId: queryShop, itemId: queryItem, shopUsername: null };

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const prev = parts[parts.length - 2];
      const lastId = digitsOnly(last);
      const prevId = digitsOnly(prev);
      if (lastId && prevId) {
        return { shopId: prevId, itemId: lastId, shopUsername: null };
      }
      if (
        parts.length === 2 &&
        lastId &&
        !SHOPEE_RESERVED_PATHS.has(prev.toLowerCase()) &&
        /^[A-Za-z0-9._-]{3,64}$/.test(prev)
      ) {
        return { shopId: null, itemId: lastId, shopUsername: prev };
      }
    }
    if (queryItem) return { shopId: queryShop, itemId: queryItem, shopUsername: null };
  } catch {
    return { shopId: null, itemId: null, shopUsername: null };
  }
  return { shopId: null, itemId: null, shopUsername: null };
}

export function nameFromShopeeSlug(url: string): string | null {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const dotted = path.match(/\/([^/]+)-i\.\d+\.\d+/);
    if (!dotted) return null;
    const name = dotted[1].replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    return name.length >= 4 ? name.slice(0, 120) : null;
  } catch {
    return null;
  }
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
