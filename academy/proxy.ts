import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { identify } from "@/lib/bots";

/**
 * AI 크롤러가 왔을 때만 기록한다.
 *
 * 프록시는 Edge 에서 돌아 pg 를 못 쓴다. 그래서 판별만 여기서 하고
 * 저장은 Node 런타임 라우트에 넘긴다. 사람 요청에는 아무 일도 하지 않으므로
 * 일반 방문자의 응답 속도에는 영향이 없다.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|api/crawl|favicon.ico).*)"],
};

export default function proxy(req: NextRequest) {
  const ua = req.headers.get("user-agent");
  const hit = identify(ua);
  if (!hit) return NextResponse.next();

  const url = new URL("/api/crawl", req.nextUrl.origin);
  // 응답을 붙잡지 않되 요청이 잘리지도 않게 한다.
  // 그냥 void 로 던지면 응답이 먼저 끝나면서 기록이 유실된다 — 실제로 절반이 사라졌다.
  const send = fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-crawl-key": process.env.CRAWL_KEY ?? "" },
    body: JSON.stringify({
      bot: hit.bot,
      vendor: hit.vendor,
      path: req.nextUrl.pathname,
      ua: ua ?? "",
      ip: req.headers.get("x-forwarded-for") ?? "",
    }),
  }).catch(() => {});
  waitUntil(send);

  return NextResponse.next();
}
