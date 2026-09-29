import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { inqPool } from "@/lib/inquiries";
import { ymd } from "@/lib/pilot-plan";
import { imageType, MAX_CAPTURE, SHOWN, SURFACES } from "@/lib/manual-checks";

export const runtime = "nodejs";

/**
 * 손 확인 기록 한 줄 (Step 26 D8) — 구글 AI 개요·AI 모드·네이버 AI 브리핑을 원장이 직접 본 결과와 캡처.
 * 서버 동작은 본문 1MB 상한이라 2MB 캡처를 못 받는다. 그래서 이 한 곳만 경로 처리기로 받는다(관리자 쿠키 + 같은 출처만).
 * 캡처는 이미지 한 장, 2MB 까지. 형식은 파일 머리 바이트로 가린다 — 브라우저가 붙인 형식 이름은 믿지 않는다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const origin = req.headers.get("origin");
  let sameOrigin = true;
  if (origin) { try { sameOrigin = new URL(origin).host === req.headers.get("host"); } catch { sameOrigin = false; } }
  if (!sameOrigin) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { id } = await params;
  const back = (msg?: string) => NextResponse.redirect(new URL(`/admin/pilots/${id}${msg ? `?check=${encodeURIComponent(msg)}` : ""}#manual`, req.url), 303);

  let form: FormData;
  try { form = await req.formData(); } catch { return back("입력을 못 읽었습니다"); }
  const question = String(form.get("question") ?? "").trim().slice(0, 300);
  const surface = String(form.get("surface") ?? "");
  const shown = String(form.get("shown") ?? "");
  const checkedOn = ymd(form.get("checked_on"));
  if (!question || !SURFACES.some((s) => s.key === surface) || !SHOWN.includes(shown) || !checkedOn) return back("질문·화면·결과·날짜를 다 넣어 주세요");

  let capture: Buffer | null = null, captureType: string | null = null;
  const f = form.get("capture");
  if (f && typeof f !== "string" && f.size > 0) {
    if (f.size > MAX_CAPTURE) return back("캡처는 2MB 까지입니다");
    capture = Buffer.from(await f.arrayBuffer());
    captureType = imageType(capture);
    if (!captureType) return back("캡처는 PNG·JPEG·WebP 이미지만 받습니다");
  }
  try {
    const { rowCount } = await inqPool().query(
      `insert into geo.pilot_manual_checks (pilot_id, question, surface, checked_on, shown, note, capture, capture_type)
       select p.id, $2, $3, $4, $5, $6, $7, $8 from geo.pilots p where p.id = $1`,
      [id, question, surface, checkedOn, shown, String(form.get("note") ?? "").trim().slice(0, 500), capture, captureType]);
    if (!rowCount) return back("파일럿이 없습니다");
  } catch (e) {
    console.error("pilot_manual_checks", e);
    return back("저장하지 못했습니다");
  }
  return back();
}
