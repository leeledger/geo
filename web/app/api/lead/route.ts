import { NextRequest, NextResponse } from "next/server";
import { saveLead, isEmail } from "@/lib/leads";

export const runtime = "nodejs";

const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 8;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "요청이 너무 잦습니다." }, { status: 429 });
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const email = String(body?.email ?? "").trim();
  if (!isEmail(email)) {
    return NextResponse.json({ error: "이메일 주소를 확인해 주세요." }, { status: 400 });
  }

  // 봇 방지용 허니팟 — 사람에겐 보이지 않는 필드가 채워졌으면 조용히 성공 처리
  if (String(body?.website ?? "").trim()) {
    return NextResponse.json({ ok: true });
  }

  const id = await saveLead({
    scanId: typeof body?.scanId === "string" ? body.scanId : null,
    email,
    company: body?.company ?? null,
    name: body?.name ?? null,
    phone: body?.phone ?? null,
    wants: body?.wants ?? null,
    ip,
  }).catch(() => null);

  if (!id) {
    return NextResponse.json({ error: "저장에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}
