import { NextRequest, NextResponse } from "next/server";
import { scanSite, normalizeTarget } from "@/lib/scan";
import { saveScan } from "@/lib/leads";

export const runtime = "nodejs";
export const maxDuration = 60;   // 외부 사이트 여러 개를 받아오므로 길게 잡는다

// 아주 단순한 IP 레이트리밋. 인스턴스 재시작 시 초기화되지만 남용 방지엔 충분하다.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const LIMIT = 5;

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();       // 메모리 무한 증가 방지
  return arr.length > LIMIT;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const origin = normalizeTarget(String(body?.domain ?? ""));
  if (!origin) {
    return NextResponse.json({ error: "올바른 홈페이지 주소를 입력해 주세요. (예: example.co.kr)" }, { status: 400 });
  }

  try {
    const result = await scanSite(origin, 5);

    // 저장 실패가 진단 자체를 막지 않게 한다 — 사용자에겐 결과가 먼저다
    const scanId = await saveScan({
      origin: result.origin,
      total: result.total,
      grade: result.grade,
      checks: result.checks,
      notes: result.notes,
      ip,
      userAgent: req.headers.get("user-agent"),
      referrer: req.headers.get("referer"),
    }).catch(() => null);

    return NextResponse.json({ ...result, scanId });
  } catch (e: any) {
    return NextResponse.json({ error: `진단 중 오류가 발생했습니다: ${e?.message ?? "unknown"}` }, { status: 500 });
  }
}
