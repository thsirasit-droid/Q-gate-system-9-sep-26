import { createHash } from "node:crypto";
import { fetchAllowed, hostAllowed, resolveRedirects } from "./http";
import { digitsOnly, nameFromShopeeSlug, parseShopeeRef, SHOPEE_PAGE_HOSTS } from "./urls";
import { secrets } from "./env";
import type { ProductInfo } from "./types";

const GRAPHQL = "https://open-api.affiliate.shopee.co.th/graphql";
const SHOPEE_HOSTS = [
  "shopee.co.th",
  "shopee.com",
  "shopee.sg",
  "s.shopee.co.th",
  "shp.ee",
  "shope.ee",
  "open-api.affiliate.shopee.co.th",
];
const PAGE_HOSTS = [...SHOPEE_PAGE_HOSTS];
const MIRROR_HOSTS = ["taladhouse.com"];
const PAGE_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  referer: "https://shopee.co.th/",
};

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
    videoUrls: [],
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
    url = (await resolveRedirects(url, PAGE_HOSTS)).toString();
  } catch {
    // keep original if resolve fails; GraphQL may still accept it
  }
  const ref = parseShopeeRef(url);
  const itemId = digitsOnly(ref.itemId);
  const shopId = digitsOnly(ref.shopId);
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

const GENERIC_TITLE = /^(shopee(\s+thailand)?|ซื้อขายผ่านมือถือ|ช้อปปิ้งออนไลน์|check out my video)/i;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const named = html.match(
      new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i"),
    );
    if (named?.[1]) return decodeEntities(named[1]);
    const reversed = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
    );
    if (reversed?.[1]) return decodeEntities(reversed[1]);
  }
  return null;
}

function jsonLdProducts(html: string): Record<string, unknown>[] {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const found: Record<string, unknown>[] = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]) as unknown;
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of list) {
        if (!entry || typeof entry !== "object") continue;
        const rec = entry as Record<string, unknown>;
        if (rec["@type"] === "Product") found.push(rec);
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return found;
}

function asText(value: unknown): string {
  if (typeof value === "string") return decodeEntities(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value === "object" && "name" in value) return asText((value as { name?: unknown }).name);
  return "";
}

function asVideos(html: string, ld: Record<string, unknown> | undefined): string[] {
  const urls: string[] = [];
  const og =
    metaContent(html, ["og:video", "og:video:url", "og:video:secure_url", "twitter:player:stream"]) ?? "";
  if (og) urls.push(og);
  const ldVideo = ld?.video;
  if (typeof ldVideo === "string") urls.push(ldVideo);
  if (ldVideo && typeof ldVideo === "object") {
    const rec = ldVideo as { contentUrl?: unknown; url?: unknown };
    urls.push(asText(rec.contentUrl), asText(rec.url));
  }
  for (const match of html.matchAll(/https:\/\/[a-zA-Z0-9._/-]+\.mp4(?:\?[a-zA-Z0-9._=&-]*)?/gi)) {
    urls.push(match[0]);
  }
  const unique: string[] = [];
  for (const raw of urls) {
    const url = raw.trim();
    if (!url.startsWith("https://")) continue;
    if (!/\.mp4(\?|$)/i.test(url) && !/og:video/.test(url) && !/susercontent|shopee|tiktokcdn/.test(url)) {
      continue;
    }
    if (!unique.includes(url)) unique.push(url);
  }
  return unique.slice(0, 2);
}

function asImages(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const urls: string[] = [];
  for (const item of raw) {
    const url = typeof item === "string" ? item : asText((item as { url?: unknown } | null)?.url);
    if (!url) continue;
    try {
      const parsed = new URL(url, "https://cf.shopee.co.th/");
      if (parsed.protocol === "https:") urls.push(parsed.toString());
    } catch {
      // skip
    }
  }
  return [...new Set(urls)];
}

function formatPrice(value: number | null, text: string): { priceText: string; priceValue: number | null } {
  const fromText = Number(text.replace(/[^\d.]/g, ""));
  const amount = value && value > 0 ? value : fromText > 0 ? fromText : null;
  if (!amount) return { priceText: text.replace(/[^\d.,]/g, "").replace(/\.00$/, ""), priceValue: null };
  const rounded = Math.round(amount);
  return { priceText: String(rounded), priceValue: rounded };
}

function prettyShopName(username: string | null): string {
  if (!username) return "";
  return username
    .replace(/[._]+/g, " ")
    .replace(/officialshop/i, "Official Shop")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

function nameFromVideoCaption(caption: string): string {
  const tags = [...caption.matchAll(/#([A-Za-z0-9_\u0E00-\u0E7F]+)/g)].map((match) => match[1]);
  const labels: Record<string, string> = {
    clearnose: "Clearnose",
    vitaminc: "วิตามินซี",
    whitening: "ไวท์เทนนิ่ง",
    skincare: "สกินแคร์",
    serum: "เซรั่ม",
  };
  const lower = tags.map((tag) => tag.toLowerCase()).filter((tag) => !/^shopee/i.test(tag));
  const preferred = ["clearnose", "vitaminc", "whitening", "skincare", "serum"];
  const ordered = [...preferred.filter((tag) => lower.includes(tag)), ...lower.filter((tag) => !preferred.includes(tag))];
  const parts = ordered.map((tag) => labels[tag] ?? tag);
  if (parts.length) return parts.join(" ").slice(0, 80);
  const plain = caption.replace(/#\S+/g, " ").replace(/\s+/g, " ").trim();
  return (plain || "สินค้าจาก Shopee Video").slice(0, 80);
}

function productFromShopeeVideo(html: string, fallbackUrl: string): ProductInfo | null {
  const block = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!block) return null;
  try {
    const parsed = JSON.parse(block) as {
      props?: {
        pageProps?: {
          mediaInfo?: {
            video?: {
              watermarkVideoUrl?: string;
              watermarkCoverUrl?: string;
              caption?: string;
            };
            userInfo?: { videoUserName?: string };
          };
        };
      };
    };
    const video = parsed.props?.pageProps?.mediaInfo?.video;
    const user = parsed.props?.pageProps?.mediaInfo?.userInfo;
    const videoUrl = typeof video?.watermarkVideoUrl === "string" ? video.watermarkVideoUrl : "";
    const cover = typeof video?.watermarkCoverUrl === "string" ? video.watermarkCoverUrl : "";
    const caption = typeof video?.caption === "string" ? video.caption : "";
    if (!videoUrl && !cover && !caption) return null;
    const ogImage = metaContent(html, ["og:image"]) ?? "";
    const imageUrls = [cover, ogImage].filter((url) => url.startsWith("https://"));
    return {
      platform: "shopee",
      name: nameFromVideoCaption(caption || ogImage),
      priceText: "",
      priceValue: null,
      currency: "THB",
      imageUrls: [...new Set(imageUrls)].slice(0, 4),
      videoUrls: videoUrl.startsWith("https://") ? [videoUrl] : [],
      shopName: prettyShopName(user?.videoUserName ?? "") || "Shopee Video",
      productUrl: fallbackUrl,
      affiliateUrl: null,
      productId: null,
      shopId: null,
      description: caption.slice(0, 400),
      source: "page",
      sample: false,
    };
  } catch {
    return null;
  }
}

function productFromHtml(
  html: string,
  fallbackUrl: string,
  ref: { shopId: string | null; itemId: string | null; shopUsername: string | null },
): ProductInfo | null {
  const ld = jsonLdProducts(html)[0];
  const ldName = asText(ld?.name);
  const ogTitle = metaContent(html, ["og:title", "twitter:title"]);
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? "";
  const name = [ldName, decodeEntities(heading), ogTitle, nameFromShopeeSlug(fallbackUrl)]
    .map((value) => (value ?? "").replace(/\|.*$/, "").trim())
    .find((value) => value.length >= 4 && !GENERIC_TITLE.test(value));
  if (!name) return null;

  const offer =
    ld && typeof ld.offers === "object" && ld.offers && !Array.isArray(ld.offers)
      ? (ld.offers as Record<string, unknown>)
      : Array.isArray(ld?.offers)
        ? (ld?.offers[0] as Record<string, unknown> | undefined)
        : undefined;
  const priceRaw = asText(offer?.price) || asText(ld?.price) || "";
  const priceMatch = html.match(/฿\s*([\d,]+(?:\.\d+)?)/);
  const { priceText, priceValue } = formatPrice(priceRaw ? Number(priceRaw) : null, priceRaw || priceMatch?.[1] || "");

  const images = [
    ...asImages(ld?.image),
    ...asImages(metaContent(html, ["og:image", "twitter:image"])),
  ].filter((url) => /susercontent\.com|cf\.shopee|img\.susercontent/.test(url) || url.includes("/file/"));

  const brand = asText(ld?.brand);
  const shopName = brand || prettyShopName(ref.shopUsername) || asText(ld?.seller) || "Shopee";
  const sku = asText(ld?.sku);
  const mpn = asText(ld?.mpn);
  const mpnParts = mpn.match(/^(\d{3,20})-(\d{3,20})$/);
  const itemId = ref.itemId || digitsOnly(sku) || mpnParts?.[2] || null;
  const shopId = ref.shopId || mpnParts?.[1] || null;

  return {
    platform: "shopee",
    name: name.slice(0, 160),
    priceText,
    priceValue,
    currency: asText(offer?.priceCurrency) || "THB",
    imageUrls: images.slice(0, 6),
    videoUrls: asVideos(html, ld),
    shopName,
    productUrl: fallbackUrl,
    affiliateUrl: null,
    productId: itemId,
    shopId,
    description: asText(ld?.description).slice(0, 400),
    source: "page",
    sample: false,
  };
}

let sitemapCache: { at: number; text: string } | null = null;

async function taladhouseUrlForItem(itemId: string): Promise<string | null> {
  const now = Date.now();
  if (!sitemapCache || now - sitemapCache.at > 30 * 60_000) {
    const got = await fetchAllowed("https://taladhouse.com/sitemap-products.xml", MIRROR_HOSTS, {
      timeoutMs: 20_000,
      maxBytes: 4_000_000,
      headers: { accept: "application/xml,text/xml,*/*" },
    });
    sitemapCache = { at: now, text: got.buffer.toString("utf8") };
  }
  const escaped = itemId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sitemapCache.text.match(
    new RegExp(`https://taladhouse\\.com/product/[^<\\s]+-${escaped}/`, "i"),
  );
  return match?.[0] ?? null;
}

async function productFromTaladhouse(
  itemId: string,
  fallbackUrl: string,
  ref: { shopId: string | null; itemId: string | null; shopUsername: string | null },
): Promise<ProductInfo | null> {
  const pageUrl = await taladhouseUrlForItem(itemId);
  if (!pageUrl) return null;
  const got = await fetchAllowed(pageUrl, MIRROR_HOSTS, {
    timeoutMs: 15_000,
    maxBytes: 800_000,
    headers: PAGE_HEADERS,
  });
  const html = got.buffer.toString("utf8");
  const product = productFromHtml(html, fallbackUrl, { ...ref, itemId });
  if (!product) return null;
  if (product.shopName === "Shopee" && ref.shopUsername) {
    product.shopName = prettyShopName(ref.shopUsername);
  }
  return product;
}

async function productFromShopeeHtml(
  url: string,
  ref: { shopId: string | null; itemId: string | null; shopUsername: string | null },
): Promise<ProductInfo | null> {
  try {
    const got = await fetchAllowed(url, PAGE_HOSTS, {
      timeoutMs: 12_000,
      maxBytes: 1_500_000,
      headers: PAGE_HEADERS,
    });
    const html = got.buffer.toString("utf8");
    const fromVideo = productFromShopeeVideo(html, got.url.toString());
    if (fromVideo?.name) return fromVideo;
    return productFromHtml(html, got.url.toString(), ref);
  } catch {
    return null;
  }
}

export async function shopeeProductFromPublicPage(rawUrl: string): Promise<ProductInfo> {
  let url = rawUrl.trim();
  try {
    url = (await resolveRedirects(url, PAGE_HOSTS)).toString();
  } catch {
    // keep the pasted link
  }
  const ref = parseShopeeRef(url);
  const fromPage = await productFromShopeeHtml(url, ref);
  if (fromPage?.name) return fromPage;
  if (ref.itemId) {
    try {
      const mirrored = await productFromTaladhouse(ref.itemId, url, ref);
      if (mirrored?.name) return mirrored;
    } catch {
      // fall through to a clear error
    }
  }
  throw new Error("ดึงข้อมูลสินค้าจากลิงก์นี้ไม่ได้ ลองวางลิงก์หน้าร้านแบบเต็ม หรือกดลองสินค้าตัวอย่าง");
}
