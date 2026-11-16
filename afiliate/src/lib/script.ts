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

function dramaKind(product: ProductInfo): "skin" | "sleep" | "generic" {
  const hay = `${product.name} ${product.description}`.toLowerCase();
  if (/ที่นอน|หมอน|ยางพารา|mattress|bed|lotus/.test(hay)) return "sleep";
  if (/เซรั่ม|ครีม|ผิว|skin|serum|whitening|vitaminc|clearnose|สกิน/.test(hay)) return "skin";
  return "generic";
}

/** Short Thai mini-drama from product facts. Template writer, no paid LLM. */
export function writeThaiCopy(product: ProductInfo): { script: string; caption: string; sentences: string[] } {
  const name = clipName(product.name, 36);
  const price = product.priceText ? `${product.priceText} บาท` : "ราคาน่าลอง";
  const kind = dramaKind(product);
  const sentences =
    kind === "skin"
      ? [
          "เมื่อคืนกระจกบอกว่าผิวหมองจนไม่กล้าส่องนาน",
          `เลยหยิบ ${name} มาลองดูสักครั้ง`,
          "แค่หยดเดียวก็รู้สึกสดใสขึ้นมาเลยนะคะ",
          "สั่งผ่านลิงก์ในคลิปได้เลย มีค่าคอมมิชชันหากสั่งผ่านลิงก์นี้",
        ]
      : kind === "sleep"
        ? [
            "เมื่อคืนกะที่นอนจนหลังล้า เช้ามาไม่อยากลุก",
            `เลยลอง ${name} ดูสักคืน`,
            "ตื่นมาหลังไม่ตึงแบบเดิมเลยนะคะ",
            "สั่งผ่านลิงก์ในคลิปได้เลย มีค่าคอมมิชชันหากสั่งผ่านลิงก์นี้",
          ]
        : [
            "ช่วงนี้หาของดีอยู่นานจนเหนื่อย",
            `จนเจอ ${name} ราคา ${price}`,
            "ของแบบนี้ต้องรีบลองสักครั้งนะคะ",
            "สั่งผ่านลิงก์ในคลิปได้เลย มีค่าคอมมิชชันหากสั่งผ่านลิงก์นี้",
          ];
  const script = sentences.join(" ").slice(0, 400);
  const link = product.affiliateUrl || product.productUrl;
  const hashtag = product.platform === "shopee" ? "#Shopee #รีวิวสินค้า" : "#TikTokShop #รีวิวสินค้า";
  const caption = [
    name,
    `ราคา ${price}`,
    "",
    sentences.join(" "),
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
Style: Caption,Noto Sans Thai,34,&H00FFFFFF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,36,36,72,1
Style: Banner,Noto Sans Thai,26,&H00FFFFFF,&H000000FF,&H00101010,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,24,24,24,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const banner = `${opts.product.priceText ? `฿${opts.product.priceText}` : "สินค้าแนะนำ"}  ${clipName(opts.product.name, 22)}`;
  const events = [
    `Dialogue: 0,${formatAssTime(0)},${formatAssTime(opts.durationSec)},Banner,,0,0,0,,${escapeAss(banner)}`,
  ];
  const weights = opts.sentences.map((s) => Math.max(8, s.length));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0.15;
  opts.sentences.forEach((sentence, index) => {
    const share = (weights[index] / total) * Math.max(4, opts.durationSec - 0.3);
    const start = cursor;
    const end = index === opts.sentences.length - 1 ? opts.durationSec : cursor + share;
    events.push(
      `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Caption,,0,0,0,,${escapeAss(sentence)}`,
    );
    cursor = end;
  });
  return `${header}${events.join("\n")}\n`;
}
