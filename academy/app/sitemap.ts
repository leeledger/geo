import type { MetadataRoute } from "next";
import { listSlugs } from "@/lib/posts";

export const revalidate = 900;   // 글을 올리면 사이트맵에 빨리 들어가야 색인 요청이 이어진다
const BASE = "https://robotncoding.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listSlugs();
  return [
    { url: `${BASE}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/ai-work`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...posts.map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
