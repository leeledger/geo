import type { Metadata } from "next";
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/site";
import "./globals.css";

// canonical 은 여기 두지 않는다 — 두면 모든 하위 페이지가 「/」를 물려받는다. 페이지마다 따로 단다.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  robots: process.env.NEXT_PUBLIC_ALLOW_INDEX === "true" ? undefined : { index: false, follow: false },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "사이티드(Cited)",
    locale: "ko_KR",
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
