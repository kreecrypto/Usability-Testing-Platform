import type { Metadata } from "next";
import ResearcherSession from "../components/auth/researcher-session";
import "./globals.css";

export const metadata: Metadata = {
  title: "UT Platform — แพลตฟอร์มทดสอบการใช้งาน",
  description: "แพลตฟอร์มทดสอบการใช้งานและวิเคราะห์หลักฐาน UX",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body><ResearcherSession>{children}</ResearcherSession></body>
    </html>
  );
}
