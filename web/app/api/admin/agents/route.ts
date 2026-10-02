import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { readAgents } from "@/lib/agents";
import { listClients } from "@/lib/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 현황판 ② 실시간 줄이 45초마다 읽는다. ?c=슬러그 면 그 고객 탭의 줄(현황판과 같은 고르기). 관리자 쿠키가 없으면 401 */
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const want = req.nextUrl.searchParams.get("c");
  const clients = await listClients();
  const client = clients.find((x) => x.slug === want) ?? clients[0] ?? null;
  return NextResponse.json(await readAgents(Date.now(), client), { headers: { "cache-control": "no-store" } });
}
