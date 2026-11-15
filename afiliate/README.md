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

วางลิงก์สินค้า Shopee ไทยได้เลยโดยยังไม่มีคีย์ Affiliate — ระบบอ่านชื่อ รูป และราคาจากหน้าร้านสาธารณะ แล้วทำคลิปพากย์ไทยตามปกติ

## คีย์ที่ต้องใส่ (ในที่เก็บความลับของ Cursor ไม่ใช่ไฟล์ .env บนเครื่องนี้)

ไม่บังคับถ้าจะวางลิงก์แล้วทำคลิป คีย์ Affiliate ใช้สร้างลิงก์นายหน้าเท่านั้น

ถ้าจะพากย์สวยขึ้น:

- `GOOGLE_TTS_API_KEY`

ถ้าจะสร้างลิงก์นายหน้า:

- `SHOPEE_AFFILIATE_APP_ID`
- `SHOPEE_AFFILIATE_SECRET`

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
