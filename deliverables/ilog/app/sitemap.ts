import type { MetadataRoute } from "next";

/**
 * 사이트맵.
 *
 * 지금 ilog.ai.kr/sitemap.xml 은 404 다. 사이트맵이 없으면 검색엔진이
 * 페이지를 링크로만 찾아야 하고, 링크가 얕은 새 사이트는 그 과정에서 샌다.
 * AI 크롤러도 대부분 sitemap 을 먼저 본다.
 *
 * 이 파일 하나면 /sitemap.xml 이 생긴다. app/ 바로 아래에 둔다.
 *
 * robots.txt 가 /p/ 와 /dashboard/ 를 막고 있으니 여기에도 넣지 않는다 —
 * 막아 놓고 사이트맵에 넣으면 크롤러가 헛걸음한다.
 */
const BASE = "https://ilog.ai.kr";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/features`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
