import { listPosts } from "@/lib/posts";
import { excerpt } from "@/lib/md";

/**
 * 블로그 RSS.
 *
 * 왜 필요한가: 네이버 서치어드바이저가 RSS 를 수집 경로로 쓴다. 사이트맵만 내면
 * 새 글이 반영되기까지 오래 걸린다. 구글·빙은 사이트맵으로 충분하지만 RSS 가 있어도 손해가 없다.
 */
export const revalidate = 900;

const BASE = "https://robotncoding.com";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET() {
  const posts = await listPosts(40);
  const now = new Date().toUTCString();

  const items = posts
    .map((p) => {
      const url = `${BASE}/blog/${p.slug}`;
      const date = p.published_at ? new Date(p.published_at).toUTCString() : now;
      const desc = p.summary || "";
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <category>${esc(p.category)}</category>
      <pubDate>${date}</pubDate>
      <description>${esc(desc)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>로봇&amp;코딩학원 수업 기록</title>
    <link>${BASE}/blog</link>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml" />
    <description>서울 송파구 석촌동 로봇&amp;코딩학원의 수업 기록, 학생 작품, 대회·진학 소식과 코딩 교육에 대한 글.</description>
    <language>ko</language>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
