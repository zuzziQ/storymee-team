import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StorymeeTeam – Cổng quản trị nội bộ",
  description: "Hệ thống quản lý công việc & nhân sự nội bộ AIFA Holding",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full">
      <body style={{ margin: 0, padding: 0, height: '100%', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  );
}
