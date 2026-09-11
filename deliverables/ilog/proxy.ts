import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { identify } from "./lib/cited-bots";

/**
 * AI 크롤러 방문 기록 — 사이티드로 보낸다.
 *
 * AI 가 아이로그 페이지를 실제로 읽어 가는지는 검색 콘솔에도 안 나온다.
 * 서버에서 봇 방문을 적어야만 보인다.
 *
 * - 사람 방문에는 아무것도 하지 않는다. 봇일 때만 한 번 보낸다.
 * - 응답을 기다리지 않는다(waitUntil). 페이지 속도에 영향이 없다.
 * - 보내는 값: 봇 이름, 경로, User-agent, IP(x-forwarded-for 첫 값). 사이티드 쪽에서 IP 는 해시로만 남긴다.
 * - 환경변수 CITED_CRAWL_KEY 가 없으면 아무 일도 하지 않는다.
 * - 이미지·영상 요청은 매처에서 뺀다. llms.txt·robots.txt·sitemap.xml 은 크롤러가 읽는 곳이라 남긴다.
 *
 * Next.js 16 부터 middleware.ts 는 proxy.ts, 함수 이름은 proxy 다.
 * 인증은 여기서 하지 않는다 — API route 마다 auth() 로 확인한다(CLAUDE.md).
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|api/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|mp4|webm)$).*)",
  ],
};

export function proxy(req: NextRequest, event: NextFetchEvent) {
  const key = process.env.CITED_CRAWL_KEY;
  const hit = key ? identify(req.headers.get("user-agent")) : null;
  if (key && hit) {
    event.waitUntil(
      fetch("https://geo-rose-nine.vercel.app/api/crawl", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cited-client": "ilog",
          "x-cited-key": key,
        },
        body: JSON.stringify({
          bot: hit.bot,
          vendor: hit.vendor,
          path: req.nextUrl.pathname,
          ua: req.headers.get("user-agent") ?? "",
          ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim(),
        }),
      })
        .then(() => undefined)
        .catch(() => undefined),
    );
  }
  return NextResponse.next();
}
