import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "อะฟิลิเอต",
  description: "วางลิงก์ Shopee หรือ TikTok Shop แล้วได้คลิปพากย์ไทย",
  applicationName: "อะฟิลิเอต",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "อะฟิลิเอต",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-512.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#C23A2B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-dvh bg-paper font-sans antialiased">{children}</body>
    </html>
  );
}
