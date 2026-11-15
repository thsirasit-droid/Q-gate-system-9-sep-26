export type Platform = "shopee" | "tiktok";

export type JobStatus =
  | "queued"
  | "fetching"
  | "writing"
  | "speaking"
  | "rendering"
  | "ready"
  | "posting"
  | "posted"
  | "needs_tap"
  | "failed";

export type VoiceMode = "google" | "espeak" | "captions" | "none";

export type ProductInfo = {
  platform: Platform;
  name: string;
  priceText: string;
  priceValue: number | null;
  currency: string;
  imageUrls: string[];
  shopName: string;
  productUrl: string;
  affiliateUrl: string | null;
  productId: string | null;
  shopId: string | null;
  description: string;
  source: "api" | "sample";
  sample: boolean;
};

export type ConnectionStatus = {
  shopeeAffiliate: boolean;
  shopeeVideo: boolean;
  tiktokShop: boolean;
  googleTts: boolean;
  ffmpeg: boolean;
  sampleMode: boolean;
};

export type JobPublic = {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  sourceUrl: string;
  platform: Platform;
  product: ProductInfo | null;
  scriptText: string;
  caption: string;
  errorMessage: string | null;
  voiceMode: VoiceMode;
  postStatus: string | null;
  postMessage: string | null;
  affiliateUrl: string | null;
  durationSec: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
  imageCount: number;
  sample: boolean;
};

export type PostResult = {
  ok: boolean;
  status: "posted" | "needs_tap" | "failed";
  message: string;
  downloadHint: boolean;
};
