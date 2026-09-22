import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { readAgents } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 현황판 ② 실시간 줄이 45초마다 읽는다. 관리자 쿠키가 없으면 401 */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await readAgents(), { headers: { "cache-control": "no-store" } });
}
