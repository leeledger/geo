import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { identify } from "./lib/bots";
import { readVisit } from "./lib/visit";
import { decide } from "./lib/cited-proxy";

/**
 * cited.kr 자기 기록 — 거래처(아이로그) proxy 와 같은 모양 (Step 51 D164~D166).
 *
 * - 봇이면 /api/crawl 로 한 번, 사람의 문서 요청이면 /api/visit 로 한 번. client 는 cited.
 * - 보내는 곳은 같은 배포의 origin. 미리보기 배포는 CITED_CRAWL_KEY 가 없어 아무것도 안 한다.
 * - 응답을 기다리지 않는다(waitUntil). 실패는 삼킨다 — 페이지를 막으면 안 된다.
 * - cited_admin 쿠키가 있으면(원장 자기 방문) 사람 방문을 안 센다.
 * - 옛 호스트 요청은 next.config redirects 가 먼저 308 을 돌려 여기까지 안 온다.
 * - 이미지·영상·_next·api·admin 은 매처에서 뺀다. llms.txt·robots.txt·sitemap.xml 은 크롤러가 읽는 곳이라 남긴다.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|admin|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|mp4|webm)$).*)",
  ],
};

export function proxy(req: NextRequest, event: NextFetchEvent) {
  const key = process.env.CITED_CRAWL_KEY;
  const ua = req.headers.get("user-agent");
  const hit = key ? identify(ua) : null;
  const route = decide({
    pathname: req.nextUrl.pathname,
    cookie: req.headers.get("cookie"),
    hasKey: !!key,
    isBot: !!hit,
  });
  if (key && hit && route === "crawl") {
    event.waitUntil(
      send(req, key, "/api/crawl", {
        bot: hit.bot,
        vendor: hit.vendor,
        path: req.nextUrl.pathname,
        ua: ua ?? "",
        ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim(),
      }),
    );
  } else if (key && route === "visit") {
    event.waitUntil(sendVisit(req, key));
  }
  return NextResponse.next();
}

/** 사람 방문 한 줄. 셀 요청이 아니거나 VISIT_SALT 가 없으면 아무것도 안 보낸다 */
async function sendVisit(req: NextRequest, key: string): Promise<void> {
  try {
    const v = await readVisit(req, process.env.VISIT_SALT);
    if (v) await send(req, key, "/api/visit", v);
  } catch {
    // 기록 실패가 페이지를 막지 않는다
  }
}

async function send(req: NextRequest, key: string, path: string, body: unknown): Promise<void> {
  try {
    await fetch(new URL(path, req.nextUrl.origin), {
      method: "POST",
      headers: { "content-type": "application/json", "x-cited-client": "cited", "x-cited-key": key },
      body: JSON.stringify(body),
    });
  } catch {
    // 기록 실패가 페이지를 막지 않는다
  }
}
