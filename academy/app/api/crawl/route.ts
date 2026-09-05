import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { q, dbEnabled } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 프록시에서만 호출된다. 외부에서 임의로 채워 넣지 못하게 키로 막는다. */
export async function POST(req: Request) {
  const key = process.env.CRAWL_KEY;
  if (key && req.headers.get("x-crawl-key") !== key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!dbEnabled) return NextResponse.json({ ok: false });

  const b = await req.json().catch(() => null);
  if (!b?.bot || !b?.path) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // 원문 IP 는 남기지 않는다 — 봇 판별에는 해시로 충분하다
  const salt = process.env.IP_HASH_SALT ?? "robotncoding";
  const ipHash = b.ip
    ? createHash("sha256").update(salt + String(b.ip).split(",")[0].trim()).digest("hex").slice(0, 32)
    : null;

  try {
    await q(
      `insert into academy.crawl_hits (bot, vendor, path, ua, ip_hash)
       values ($1,$2,$3,$4,$5)`,
      [b.bot, b.vendor ?? "", String(b.path).slice(0, 300), String(b.ua ?? "").slice(0, 500), ipHash],
    );
  } catch {
    // 기록 실패가 페이지 서빙을 막아서는 안 된다
  }
  return NextResponse.json({ ok: true });
}
