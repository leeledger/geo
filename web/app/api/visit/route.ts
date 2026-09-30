import { NextResponse } from "next/server";
import { clientForKey } from "@/lib/crawl";
import { cleanVisit } from "@/lib/visit";
import { saveVisit } from "@/lib/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 고객사 서버의 사람 방문 기록을 받는다 (Step 29 D31). /api/crawl 과 같은 인증.
 *
 *   POST /api/visit
 *   x-cited-client: ilog
 *   x-cited-key:    (geo.clients.crawl_key)
 *   { path, ref_host, ref_kind, visitor, device }   ← IP 는 오지 않는다
 *
 * 고객사 쪽은 응답을 기다리지 않는다. 여기서도 저장 실패를 조용히 삼킨다.
 */
const MAX_BODY = 2048;

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

  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY) return NextResponse.json({ error: "too large" }, { status: 413 });
  let raw: unknown = null;
  try {
    raw = JSON.parse(text);
  } catch {
    // 아래에서 bad request
  }
  const v = cleanVisit(raw);
  if (!v) return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    await saveVisit(clientId, v);
  } catch {
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true });
}
