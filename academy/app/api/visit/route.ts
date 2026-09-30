import { NextResponse } from "next/server";
import { q, dbEnabled } from "@/lib/db";
import { cleanVisit } from "@/lib/visit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 사람 방문 한 줄을 받는다 (Step 29 D31). 프록시에서만 호출된다 — /api/crawl 과 같은 키.
 *
 * 학원은 사이트가 이 저장소에 있고 DB 를 직접 쓴다(/api/crawl 과 같다). 사이티드 /api/visit 로 보내려면
 * 학원 geo.clients 에 crawl_key 를 새로 넣고 학원 서버에 그 키를 또 둬야 해서, 자기 라우트가 더 단순하다.
 * 표·중복 규칙은 web/lib/visits.ts 와 같은 줄이다 — academy/scripts/test-visit.mjs 가 대조한다.
 */
const CLIENT_ID = 1; // academy/clients.mjs 의 로봇&코딩학원 id (= geo.clients.id)
const MAX_BODY = 2048;

const VISITS_DDL = [
  `create table if not exists geo.site_visits (
  id bigserial primary key,
  client_id int not null references geo.clients(id),
  at timestamptz not null default now(),
  day date not null default ((now() at time zone 'Asia/Seoul')::date),
  path text not null,
  ref_host text not null default '',
  ref_kind text not null check (ref_kind in ('ai','search','sns','direct','internal','other')),
  visitor text not null,
  device text not null default '')`,
  `create index if not exists site_visits_client_day_idx on geo.site_visits (client_id, day)`,
  `alter table geo.site_visits enable row level security`,
];

/** 같은 사람이 같은 쪽을 1분 안에 또 열면(새로고침 연타·폭주) 한 번으로 친다 */
const INSERT_VISIT = `insert into geo.site_visits (client_id, path, ref_host, ref_kind, visitor, device)
  select $1::int, $2::text, $3::text, $4::text, $5::text, $6::text
   where not exists (select 1 from geo.site_visits
                      where client_id = $1::int and day = (now() at time zone 'Asia/Seoul')::date
                        and visitor = $5::text and path = $2::text and at > now() - interval '1 minute')`;

const g = globalThis as unknown as { __visitsReady?: boolean };

export async function POST(req: Request) {
  const key = process.env.CRAWL_KEY;
  // 키가 없으면 닫는다 — 열어 두면 누구나 방문 기록을 채울 수 있다(/api/crawl 과 달리 fail closed)
  if (!key || req.headers.get("x-crawl-key") !== key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!dbEnabled) return NextResponse.json({ ok: false });

  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY) return NextResponse.json({ error: "too large" }, { status: 413 });
  let raw: unknown = null;
  try {
    raw = JSON.parse(text);
  } catch {
    // 아래에서 bad request
  }
  const v = cleanVisit(raw);
  if (!v) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // 표 준비와 쓰기를 따로 잡는다 — 준비가 실패해도(표는 이미 있음) 쓰기는 해 본다.
  // 표가 있으면 DDL 을 안 돌린다 — 콜드 스타트마다 create index·alter table 이 잠금을 잡지 않게
  try {
    if (!g.__visitsReady) {
      const [r] = await q<{ ok: boolean }>(`select to_regclass('geo.site_visits') is not null as ok`);
      if (!r?.ok) for (const s of VISITS_DDL) await q(s);
      g.__visitsReady = true;
    }
  } catch {
    // 아래 쓰기가 실패하면 그때 삼킨다
  }
  try {
    await q(INSERT_VISIT, [CLIENT_ID, v.path, v.ref_host, v.ref_kind, v.visitor, v.device]);
  } catch {
    // 기록 실패가 페이지 서빙을 막아서는 안 된다
  }
  return NextResponse.json({ ok: true });
}
