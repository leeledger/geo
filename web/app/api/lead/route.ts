import { NextRequest, NextResponse, after } from "next/server";
import { saveLead, isEmail } from "@/lib/leads";
import { sendLeadAlert } from "@/lib/lead-alert";

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

const str = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

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

  // 고민은 체크박스 여러 개. 목록 밖 값도 들어올 수 있으니 길이와 개수만 자른다.
  const concerns = Array.isArray(body?.concerns)
    ? body.concerns.filter((c: unknown) => typeof c === "string" && c.trim()).slice(0, 8).map((c: string) => c.trim().slice(0, 40))
    : [];

  const id = await saveLead({
    scanId: typeof body?.scanId === "string" ? body.scanId : null,
    email,
    company: str(body?.company, 120),
    name: str(body?.name, 60),
    phone: str(body?.phone, 40),
    wants: str(body?.wants, 60),
    referral: str(body?.referral, 40),
    concerns: concerns.length ? concerns.join(" · ") : null,
    competitor: str(body?.competitor, 200),
    site: str(body?.site, 200),
    ip,
  }).catch(() => null);

  if (!id) {
    return NextResponse.json({ error: "저장에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  // 원장에게 메일 한 통(설정 없으면 건너뜀 · 실패해도 저장은 성공 — lib/lead-alert.ts)
  // 응답을 먼저 돌려주고 메일은 그 뒤에(Richard 28 — 발송 5초 제한이 폼 응답을 늦추지 않게)
  after(() => sendLeadAlert({ name: str(body?.name, 60), phone: str(body?.phone, 40) }, `${req.nextUrl.origin}/admin`));
  return NextResponse.json({ ok: true, id });
}
