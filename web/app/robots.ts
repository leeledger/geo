import type { MetadataRoute } from "next";

/**
 * 초안 단계라 색인을 막아 둔다 — 브랜드명이 가안이고 문구가 확정 전이다.
 * 공개 준비가 끝나면 Vercel 환경변수에 NEXT_PUBLIC_ALLOW_INDEX=true 를 추가하면
 * 코드 수정 없이 열린다. (GEO 서비스가 자기 사이트를 색인 막아두는 건 아이러니이므로 잊지 말 것)
 */
export default function robots(): MetadataRoute.Robots {
  const allow = process.env.NEXT_PUBLIC_ALLOW_INDEX === "true";
  return allow
    ? { rules: [{ userAgent: "*", allow: "/", disallow: "/admin" }] }
    : { rules: [{ userAgent: "*", disallow: "/" }] };
}
