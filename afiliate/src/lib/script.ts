import type { ProductInfo } from "./types";

function clipName(name: string, max = 42): string {
  const clean = name.replace(/\s+/g, " ").replace(/…/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trim();
}

function escapeAss(text: string): string {
  return text.replace(/[{}\\]/g, " ").replace(/\n/g, "\\N").replace(/,/g, " ");
}

function formatAssTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  const cs = Math.round((s % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function writeThaiCopy(product: ProductInfo): { script: string; caption: string; sentences: string[] } {
  const name = clipName(product.name);
  const price = product.priceText ? `${product.priceText} บาท` : "ราคาน่าลอง";
  const sentences = [
    `วันนี้ขอแนะนำ ${name}`,
    `ราคาอยู่ที่ ${price} ของจริงจากหน้าร้าน ไม่ได้แต่งรูป`,
    "สั่งผ่านลิงก์ในคลิปได้เลยนะคะ มีค่าคอมมิชชันหากสั่งผ่านลิงก์นี้",
  ];
  const script = sentences.join(" ").slice(0, 400);
  const link = product.affiliateUrl || product.productUrl;
  const hashtag = product.platform === "shopee" ? "#Shopee #รีวิวสินค้า" : "#TikTokShop #รีวิวสินค้า";
  const caption = [
    name,
    `ราคา ${price}`,
    "",
    "สั่งผ่านลิงก์นายหน้า:",
    link,
    "",
    hashtag,
    "มีค่าคอมมิชชันหากสั่งผ่านลิงก์นี้",
  ].join("\n");
  return { script, caption, sentences };
}

export function buildAssFile(opts: {
  product: ProductInfo;
  sentences: string[];
  durationSec: number;
}): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Noto Sans Thai,38,&H00FFFFFF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,36,36,96,1
Style: Banner,Noto Sans Thai,30,&H00FFFFFF,&H000000FF,&H002B3AC2,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,24,24,36,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const banner = `${opts.product.priceText ? `฿${opts.product.priceText}` : "สินค้าแนะนำ"}  ${clipName(opts.product.name, 28)}`;
  const events = [
    `Dialogue: 0,${formatAssTime(0)},${formatAssTime(opts.durationSec)},Banner,,0,0,0,,${escapeAss(banner)}`,
  ];
  const weights = opts.sentences.map((s) => Math.max(8, s.length));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0.2;
  opts.sentences.forEach((sentence, index) => {
    const share = (weights[index] / total) * Math.max(4, opts.durationSec - 0.4);
    const start = cursor;
    const end = index === opts.sentences.length - 1 ? opts.durationSec : cursor + share;
    events.push(
      `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Caption,,0,0,0,,${escapeAss(sentence)}`,
    );
    cursor = end;
  });
  return `${header}${events.join("\n")}\n`;
}
