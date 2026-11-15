function present(name: string): boolean {
  return (process.env[name] ?? "").trim() !== "";
}

export function secrets() {
  return {
    shopeeAppId: (process.env.SHOPEE_AFFILIATE_APP_ID ?? "").trim(),
    shopeeSecret: (process.env.SHOPEE_AFFILIATE_SECRET ?? "").trim(),
    shopeePartnerId: (process.env.SHOPEE_PARTNER_ID ?? "").trim(),
    shopeePartnerKey: (process.env.SHOPEE_PARTNER_KEY ?? "").trim(),
    shopeeAccessToken: (process.env.SHOPEE_ACCESS_TOKEN ?? "").trim(),
    shopeeUserId: (process.env.SHOPEE_USER_ID ?? "").trim(),
    tiktokAppKey: (process.env.TIKTOK_SHOP_APP_KEY ?? "").trim(),
    tiktokAppSecret: (process.env.TIKTOK_SHOP_APP_SECRET ?? "").trim(),
    tiktokAccessToken: (process.env.TIKTOK_SHOP_ACCESS_TOKEN ?? "").trim(),
    googleTtsKey: (process.env.GOOGLE_TTS_API_KEY ?? "").trim(),
  };
}

export function connectionFlags() {
  const s = secrets();
  return {
    shopeeAffiliate: Boolean(s.shopeeAppId && s.shopeeSecret),
    shopeeVideo: Boolean(
      s.shopeePartnerId && s.shopeePartnerKey && s.shopeeAccessToken && s.shopeeUserId,
    ),
    tiktokShop: Boolean(s.tiktokAppKey && s.tiktokAppSecret && s.tiktokAccessToken),
    googleTts: Boolean(s.googleTtsKey),
    sampleMode: !(s.shopeeAppId && s.shopeeSecret) && !(s.tiktokAppKey && s.tiktokAccessToken),
  };
}

export { present };
