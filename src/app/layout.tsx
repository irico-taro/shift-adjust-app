import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "シフト管理",
  description: "レッスン枠と業務シフトを一元管理するシフト調整アプリ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="app-header">
          <div className="app-header-inner">
            <a className="brand" href="/">
              シフト管理
            </a>
            <Nav />
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
