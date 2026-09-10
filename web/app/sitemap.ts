import type { MetadataRoute } from "next";
import { SERVICES } from "@/lib/services";

/**
 * 사이트맵이 아예 없었다. GEO 를 파는 사이트에 사이트맵이 없으면
 * 영업 자리에서 고객이 우리를 진단해 보는 순간 끝난다.
 */
export const revalidate = 3600;

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://geo-rose-nine.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/services`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...SERVICES.map((s) => ({
      url: `${BASE}/services/${s.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${BASE}/case/robotncoding.html`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];
}
