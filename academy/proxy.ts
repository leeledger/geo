import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { identify } from "@/lib/bots";
import { readVisit } from "@/lib/visit";

/**
 * AI 크롤러 방문과 사람 방문을 기록한다.
 *
 * 프록시는 Edge 에서 돌아 pg 를 못 쓴다. 그래서 판별만 여기서 하고
 * 저장은 Node 런타임 라우트에 넘긴다(봇 /api/crawl, 사람 /api/visit).
 * 둘 다 응답을 기다리지 않으므로 방문자의 응답 속도에는 영향이 없다.
 * 사람 방문은 문서 요청만 센다. VISIT_SALT 가 없으면 사람 쪽은 아무것도 안 한다(Step 29).
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|api/crawl|api/visit|favicon.ico).*)"],
};

export default function proxy(req: NextRequest) {
  const ua = req.headers.get("user-agent");
  const hit = identify(ua);
  if (!hit) {
    waitUntil(sendVisit(req));
    return NextResponse.next();
  }

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

/** 사람 방문 한 줄. 셀 요청이 아니면 아무것도 안 보낸다. 실패는 삼킨다 — 페이지를 막으면 안 된다 */
async function sendVisit(req: NextRequest) {
  try {
    const v = await readVisit(req, process.env.VISIT_SALT);
    if (!v) return;
    await fetch(new URL("/api/visit", req.nextUrl.origin), {
      method: "POST",
      headers: { "content-type": "application/json", "x-crawl-key": process.env.CRAWL_KEY ?? "" },
      body: JSON.stringify(v),
    });
  } catch {
    // 기록 실패가 페이지 서빙을 막아서는 안 된다
  }
}
