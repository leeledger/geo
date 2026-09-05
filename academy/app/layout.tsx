import type { Metadata } from "next";
import meta from "@/content/meta.json";

export const metadata: Metadata = {
  metadataBase: new URL("https://robotncoding.com"),
  title: { default: meta.title, template: "%s | 로봇&코딩학원" },
  description: meta.description,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/rss.xml", title: "로봇&코딩학원 수업 기록" }] },
  },
  /**
   * 검색엔진 소유확인.
   * 각 도구에서 발급받은 문자열을 Vercel 환경변수에 넣으면 자동으로 메타태그가 붙는다.
   * 코드에 직접 박지 않는 이유: 값이 바뀌어도 배포만 다시 하면 되고, 저장소에 남지 않는다.
   */
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: {
      ...(process.env.NAVER_SITE_VERIFICATION
        ? { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION }
        : {}),
      ...(process.env.BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
        : {}),
    },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "로봇&코딩학원",
    title: meta.ogTitle,
    description: meta.ogDescription,
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
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap"
        />
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
