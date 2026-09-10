import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cited 사이티드 — AI 답변 인용 측정",
  description:
    "AI 답변에 브랜드가 인용되는지 표본과 오차범위까지 붙여 측정합니다.",
  robots: process.env.NEXT_PUBLIC_ALLOW_INDEX === "true" ? undefined : { index: false, follow: false },
  openGraph: {
    title: "Cited 사이티드 — AI 답변 인용 측정",
    description: "AI 답변 노출을 표본·신뢰구간과 함께 측정합니다. 무료 진단.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+KR:wght@400;500;600&family=Noto+Serif+KR:wght@700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
