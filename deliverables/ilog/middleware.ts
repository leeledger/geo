import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { identify } from "./lib/cited-bots";

/**
 * AI 크롤러 방문 기록 — 사이티드로 보낸다.
 *
 * 지금은 AI 가 아이로그 페이지를 실제로 읽어 가는지 알 방법이 없습니다.
 * 검색 콘솔에도 안 나옵니다. 서버에서 봇 방문을 적어야만 보입니다.
 *
 * - 사람 방문에는 아무것도 하지 않습니다. 봇일 때만 한 번 보냅니다.
 * - 응답을 기다리지 않습니다(waitUntil). 페이지 속도에 영향이 없습니다.
 * - 보내는 값: 봇 이름, 경로, User-agent, IP. 사이티드 쪽에서 IP 는 해시로만 남깁니다.
 * - 환경변수 CITED_CRAWL_KEY 가 없으면 아무 일도 하지 않습니다.
 *
 * 이미 middleware.ts 가 있다면 이 파일을 덮지 말고, 기존 함수 맨 앞에
 * 아래 「기록」 블록만 옮겨 넣으세요. (event 인자가 필요합니다)
 *
 * Next.js 16 이상이면 파일 이름이 proxy.ts, 함수 이름이 proxy 입니다.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};

export function middleware(req: NextRequest, event: NextFetchEvent) {
  // ── 기록 ──────────────────────────────────────
  const key = process.env.CITED_CRAWL_KEY;
  const hit = key ? identify(req.headers.get("user-agent")) : null;
  if (hit) {
    event.waitUntil(
      fetch("https://geo-rose-nine.vercel.app/api/crawl", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cited-client": "ilog",
          "x-cited-key": key!,
        },
        body: JSON.stringify({
          bot: hit.bot,
          vendor: hit.vendor,
          path: req.nextUrl.pathname,
          ua: req.headers.get("user-agent") ?? "",
          ip: req.headers.get("x-forwarded-for") ?? "",
        }),
      }).catch(() => {}),
    );
  }
  // ── 기록 끝 ───────────────────────────────────

  return NextResponse.next();
}
