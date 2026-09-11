import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cited 사이티드 — AI 답변 노출 측정 · GEO",
  description:
    "손님이 AI에게 물었을 때 우리 이름이 나오는지 재고, 나오게 만듭니다. 몇 번 물어 몇 번 나왔는지까지 적는 GEO 대행사.",
  robots: process.env.NEXT_PUBLIC_ALLOW_INDEX === "true" ? undefined : { index: false, follow: false },
  openGraph: {
    title: "Cited 사이티드 — AI 답변 노출 측정 · GEO",
    description: "AI 답변에 우리 이름이 나오는지 표본과 함께 잽니다. 홈페이지 주소만 넣으면 무료 진단.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* 본문은 Pretendard. 세리프 제목은 「가독성이 떨어진다」는 말을 듣고 내렸다. 코드·로그만 Plex Mono. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
