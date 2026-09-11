import { Pool } from "pg";
import {
  windows, gatherDb, validCutoff, DEFAULT_CUTOFF,
  type BriefFacts, type BriefWindow,
} from "./brief-core.mjs";

/**
 * 대시보드의 「오늘 한 일」.
 *
 * DB 에 남는 일(손댄 기록·측정·재진단·크롤러·발행·리드)은 화면을 열 때마다 새로 센다.
 * DB 밖의 일(커밋·정찰 이슈·자동 작업 실행)은 GitHub Actions 가 3시간마다
 * academy/scripts/daily-brief.mjs 로 geo.daily_briefs 에 적어 두고, 여기서는 그걸 읽는다.
 * 마감 시각이 지나면 그날 치를 「closed」로 굳혀 둔다. 지난 날은 그 기록을 본다.
 */

export type BriefExtras = {
  commits: { hash: string; author: string; subject: string; at: string }[] | null;
  issues: { opened: { number: number; title: string }[]; closed: { number: number; title: string }[] } | null;
  runs: { name: string; ok: number; fail: number }[] | null;
};

export type BriefRow = {
  day: string;
  status: "open" | "closed";
  facts: BriefFacts;
  extras: BriefExtras | null;
  updatedAt: string;
};

const g = globalThis as unknown as { __briefPool?: Pool };

function pool(): Pool {
  if (!g.__briefPool) {
    const dsn = process.env.DATABASE_URL;
    if (!dsn) throw new Error("DATABASE_URL 없음");
    const u = new URL(dsn);
    u.searchParams.delete("sslmode");
    g.__briefPool = new Pool({
      connectionString: u.toString(),
      ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
      max: 3,
    });
  }
  return g.__briefPool;
}

const q = (sql: string, params: unknown[] = []) => pool().query(sql, params).then((r) => r.rows);

/** 마감 전에 저장해 둔 open 기록이 있으면 그 커밋·이슈·실행을 쓴다 */
const snapshotFor = (rows: any[]): BriefExtras | null => rows[0]?.data?.extras ?? null;

const toRow = (r: any): BriefRow => ({
  day: r.day,
  status: r.status,
  facts: r.data?.facts,
  extras: r.data?.extras ?? null,
  updatedAt: new Date(r.updated_at).toISOString(),
});

export async function readBrief(): Promise<{
  ok: boolean;
  cutoff: string;
  open: BriefWindow;
  closed: BriefWindow;
  live: BriefFacts | null;
  snapshot: BriefRow | null;
  history: BriefRow[];
}> {
  let cutoff = DEFAULT_CUTOFF;
  try {
    const [r] = await q(`select value from geo.settings where key = 'brief_cutoff'`);
    if (r && validCutoff(r.value)) cutoff = r.value;
  } catch { /* 표가 아직 없으면 기본값 */ }

  const w = windows(cutoff);
  let live: BriefFacts | null = null;
  try {
    live = await gatherDb(q, w.open.start, w.open.end);
  } catch { /* DB 가 막히면 「못 읽음」으로 그린다 */ }

  let snapshot: BriefRow | null = null;
  let history: BriefRow[] = [];
  try {
    const [s] = await q(
      `select day::text, status, data, updated_at from geo.daily_briefs where day = $1`, [w.open.day]);
    snapshot = s ? toRow(s) : null;
    history = (await q(
      `select day::text, status, data, updated_at from geo.daily_briefs
        where status = 'closed' order by day desc limit 7`)).map(toRow);
  } catch { /* 마감 스크립트가 아직 한 번도 안 돌았다 */ }

  // 방금 마감된 날이 아직 안 굳었으면(GitHub 이 3시간마다 굳힌다) DB 몫만이라도 지금 센다.
  // 마감 직후에 대시보드를 열면 「오늘」은 막 시작해 비어 있고, 볼 것은 방금 끝난 하루다.
  if (!history.some((h) => h.day === w.closed.day)) {
    try {
      const facts = await gatherDb(q, w.closed.start, w.closed.end);
      history = [
        { day: w.closed.day, status: "open", facts, extras: snapshotFor(await q(
          `select day::text, status, data, updated_at from geo.daily_briefs where day = $1`, [w.closed.day])),
          updatedAt: new Date().toISOString() },
        ...history,
      ];
    } catch { /* 못 세면 없는 대로 */ }
  }

  return { ok: live !== null, cutoff: w.cutoff, open: w.open, closed: w.closed, live, snapshot, history };
}

export async function saveCutoff(value: string) {
  if (!validCutoff(value)) throw new Error("HH:MM 형식이 아닙니다");
  await q(`create table if not exists geo.settings (
             key text primary key, value text not null, updated_at timestamptz not null default now())`);
  await q(
    `insert into geo.settings (key, value) values ('brief_cutoff', $1)
     on conflict (key) do update set value = excluded.value, updated_at = now()`, [value]);
}
