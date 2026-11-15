# อะฟิลิเอต

เว็บมือถือสำหรับวางลิงก์สินค้า Shopee / TikTok Shop แล้วได้คลิปแนวตั้ง พากย์ไทย มีซับ จากนั้นกดโพสต์ไป Shopee

โฟลเดอร์นี้แยกจากแอป QC ใน `project/` — ห้ามผสมโค้ด

## เปิดบนเครื่องนี้

จากโฟลเดอร์ `afiliate/`:

```bash
npm install
npm run dev
```

แล้วเปิด http://127.0.0.1:3100

กด **ลองสินค้าตัวอย่าง** ได้ทันทีโดยยังไม่มีคีย์

## คีย์ที่ต้องใส่ (ในที่เก็บความลับของ Cursor ไม่ใช่ไฟล์ .env บนเครื่องนี้)

ขั้นต่ำถ้าจะดึงสินค้าจริงและพากย์สวย:

- `SHOPEE_AFFILIATE_APP_ID`
- `SHOPEE_AFFILIATE_SECRET`
- `GOOGLE_TTS_API_KEY`

ถ้าจะอ่านสินค้า TikTok Shop:

- `TIKTOK_SHOP_APP_KEY`
- `TIKTOK_SHOP_APP_SECRET`
- `TIKTOK_SHOP_ACCESS_TOKEN`

ถ้าจะให้ระบบอัปโหลดคลิปเข้า Shopee Video แทนการแตะในแอป:

- `SHOPEE_PARTNER_ID`
- `SHOPEE_PARTNER_KEY`
- `SHOPEE_ACCESS_TOKEN`
- `SHOPEE_USER_ID`

แอป Video บน Shopee Open Platform ต้องได้รับอนุญาตก่อน คีย์ Affiliate อย่างเดียวอัปโหลดคลิปไม่ได้
