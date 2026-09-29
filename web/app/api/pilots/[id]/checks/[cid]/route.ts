import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { inqPool } from "@/lib/inquiries";

export const runtime = "nodejs";

/** 손 확인 캡처 한 장 — 관리자만. 저장할 때 머리 바이트로 가린 형식만 돌려준다(Step 26 D8) */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, cid } = await params;
  if (!/^\d{1,18}$/.test(cid)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const { rows: [r] } = await inqPool().query(
      `select capture, capture_type from geo.pilot_manual_checks where id = $1 and pilot_id::text = $2 and capture is not null`, [cid, id]);
    if (!r || !["image/png", "image/jpeg", "image/webp"].includes(r.capture_type)) return NextResponse.json({ error: "not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(r.capture), {
      headers: { "content-type": r.capture_type, "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
