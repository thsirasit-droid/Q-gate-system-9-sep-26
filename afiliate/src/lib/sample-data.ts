import type { ProductInfo } from "./types";

export const SAMPLE_SHOPEE: ProductInfo = {
  platform: "shopee",
  name: "เซรั่มวิตามินซี 30 มล. ผิวกระจ่างใส",
  priceText: "199",
  priceValue: 199,
  currency: "THB",
  imageUrls: ["/sample/serum.jpg", "/sample/serum-2.jpg"],
  videoUrls: [],
  shopName: "ร้านตัวอย่าง Afiliate",
  productUrl: "https://shopee.co.th/sample-i.1001.2002",
  affiliateUrl: null,
  productId: "2002",
  shopId: "1001",
  description: "เซรั่มวิตามินซีสำหรับผิวหมอง ใช้เช้า-เย็น เนื้อบางเบา",
  source: "sample",
  sample: true,
};

export const SAMPLE_TIKTOK: ProductInfo = {
  platform: "tiktok",
  name: "หูฟังบลูทูธกันน้ำ แบต 24 ชั่วโมง",
  priceText: "159",
  priceValue: 159,
  currency: "THB",
  imageUrls: ["/sample/earbuds.jpg"],
  videoUrls: [],
  shopName: "ร้านตัวอย่าง TikTok",
  productUrl: "https://shop.tiktok.com/view/product/sample",
  affiliateUrl: null,
  productId: "3003",
  shopId: null,
  description: "หูฟังไร้สายกันเหงื่อ ใส่สบาย แบตอึด",
  source: "sample",
  sample: true,
};
