import type { MetadataRoute } from "next";

/**
 * 초안 단계에는 막아 뒀다. 브랜드명이 가안이고 문구가 확정 전이었기 때문이다.
 * 둘 다 끝나서 열었다 — 이름은 사이티드로 확정됐고 케이스 리포트도 붙었다.
 *
 * 막아 둔 채로 두면 우리 진단기로 우리 사이트를 재는 순간 33점이 나온다.
 * GEO 를 파는 회사가 크롤러를 막고 있으면 영업 자리에서 그걸로 끝난다.
 *
 * 다시 닫아야 하면 Vercel 환경변수에 NEXT_PUBLIC_BLOCK_INDEX=true 를 넣는다.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_BLOCK_INDEX === "true") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://geo-rose-nine.vercel.app";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
