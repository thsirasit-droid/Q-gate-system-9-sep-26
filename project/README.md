# QC System — Quality Control & Dashboard

ระบบควบคุมคุณภาพสำหรับวิศวกร QC ประกอบด้วย 4 ส่วนหลัก:

1. **บันทึกการตรวจสอบชิ้นงาน** — บันทึกผลการตรวจสอบรายวัน พร้อมรูปมาตรฐานอัตโนมัติ และปุ่ม Approve สำหรับ Admin
2. **ระบบตัดสินใจออนไลน์** — แจ้งปัญหาพร้อมแนบรูป และตอบกลับแบบสนทนาคล้าย LINE ผู้ดูแลตัดสินใจ OK / NG / Rework
3. **ประวัติปัญหา** — บันทึกประวัติปัญหาที่เกิดขึ้น พร้อมไฟล์แนบ
4. **แดชบอร์ด** — สรุปผลการตรวจสอบของผู้ใช้ทุกคนเป็นรายเดือน แสดงเป็นกราฟ

## เทคโนโลยี

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Database/Auth:** Supabase (PostgreSQL + Row Level Security)
- **Charts:** Recharts
- **Icons:** Lucide React

## การติดตั้งและรันในเครื่อง

```bash
npm install
npm run dev
```

## การ Deploy บน Vercel

1. Push โค้ดขึ้น GitHub
2. ใน Vercel กด "Import Project" เลือก repo นี้
3. Framework Preset: **Vite**
4. Environment Variables ใส่:
   - `VITE_SUPABASE_URL` — URL ของ Supabase project
   - `VITE_SUPABASE_ANON_KEY` — Anon key ของ Supabase
5. กด Deploy

## การตั้งค่าฐานข้อมูล Supabase

ฐานข้อมูลถูกสร้างไว้แล้วผ่าน migration ที่ `supabase/migrations/qc_system_schema.sql`

ตารางทั้งหมด:
- `profiles` — ข้อมูลผู้ใช้ (รหัสพนักงาน, ชื่อ, บทบาท admin/user)
- `parts` — มาสเตอร์ชิ้นงาน + รูปมาตรฐาน
- `inspection_items` — หัวข้อการตรวจสอบที่ Admin กำหนดได้
- `inspection_records` — ใบบันทึกการตรวจสอบรายวัน
- `inspection_results` — ผลการตรวจสอบตามหัวข้อ
- `judgments` — การแจ้งปัญหาและการตัดสินใจ
- `judgment_messages` — ข้อความตอบกลับแบบสนทนา
- `problem_history` — ประวัติปัญหา

ทุกตารางเปิด Row Level Security (RLS) ครบทุกตาราง

## การใช้งานครั้งแรก

1. สมัครสมาชิกบัญชีแรก (จะได้บทบาท `user` อัตโนมัติ)
2. ไปที่ Supabase Dashboard → Table Editor → `profiles` → เปลี่ยน `role` เป็น `admin`
3. ในฐานะ Admin ให้เพิ่มชิ้นงาน + อัปโหลดรูปมาตรฐาน และกำหนดหัวข้อการตรวจสอบ
4. ผู้ใช้สามารถบันทึกการตรวจสอบได้หลังจากที่ Admin ตั้งค่าชิ้นงานและหัวข้อแล้ว
