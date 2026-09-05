import { NextResponse } from "next/server";
import { q, dbEnabled } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 일별 스냅샷. Vercel Cron 이 하루 한 번 부른다.
 *
 * 사람이 안 보고 있어도 기록이 쌓여야 한다. 측정이 사람 손에 달려 있으면
 * 바쁠 때 빠지고, 빠진 구간이 생기면 "언제부터 움직였는지"를 말할 수 없게 된다.
 */
export async function GET(req: Request) {
  // Vercel Cron 은 Authorization: Bearer $CRON_SECRET 을 붙여 보낸다
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!dbEnabled) return NextResponse.json({ error: "no database" }, { status: 500 });

  const [posts] = await q<{ n: number; chars: number }>(
    `select count(*)::int n, coalesce(sum(length(body)),0)::int chars from academy.published_posts`,
  );
  const [hits] = await q<{ total: number; d1: number; d7: number }>(
    `select count(*)::int total,
            count(*) filter (where seen_at > now() - interval '1 day')::int  d1,
            count(*) filter (where seen_at > now() - interval '7 days')::int d7
       from academy.crawl_hits`,
  );
  const bots = await q<{ bot: string; vendor: string; hits: number }>(
    `select bot, vendor, count(*)::int hits from academy.crawl_hits group by bot, vendor`,
  );

  const vendors = [...new Set(bots.map((b) => b.vendor))];
  const byBot = Object.fromEntries(bots.map((b) => [b.bot, b.hits]));

  await q(
    `insert into academy.snapshots (day, taken_at, posts, chars, crawl_total, crawl_1d, crawl_7d, vendors, by_bot)
     values (current_date, now(), $1,$2,$3,$4,$5,$6,$7)
     on conflict (day) do update set
       taken_at=now(), posts=excluded.posts, chars=excluded.chars,
       crawl_total=excluded.crawl_total, crawl_1d=excluded.crawl_1d,
       crawl_7d=excluded.crawl_7d, vendors=excluded.vendors, by_bot=excluded.by_bot`,
    [posts.n, posts.chars, hits.total, hits.d1, hits.d7, vendors, JSON.stringify(byBot)],
  );

  return NextResponse.json({
    ok: true,
    posts: posts.n,
    crawl_total: hits.total,
    crawl_1d: hits.d1,
    vendors,
  });
}
