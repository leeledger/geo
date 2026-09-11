import { NextResponse } from "next/server";
import { clientForKey, saveHit } from "@/lib/crawl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 고객사 서버의 크롤러 방문 기록을 받는다.
 *
 *   POST /api/crawl
 *   x-cited-client: ilog
 *   x-cited-key:    (geo.clients.crawl_key)
 *   { bot, vendor, path, ua, ip }
 *
 * 기록 실패가 고객사 페이지를 막으면 안 되므로 고객사 쪽은 응답을 기다리지 않는다.
 * 여기서도 실패를 조용히 삼킨다.
 */
export async function POST(req: Request) {
  const slug = req.headers.get("x-cited-client") ?? "";
  const key = req.headers.get("x-cited-key") ?? "";
  let clientId: number | null = null;
  try {
    clientId = await clientForKey(slug, key);
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b?.bot || !b?.path) return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    await saveHit(clientId, b);
  } catch {
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true });
}
