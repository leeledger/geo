/**
 * 초안 재료 표를 만든다.
 *
 * 2026-09-23 원장이 이틀에 초안 3편을 버렸다. 「너무 일반론적, 억지스러운 상황 설정」.
 * 같은 기간 사실·출처로 쓴 뉴스 글은 그대로 발행했다. 모델 문제가 아니라 재료 문제다.
 * 프롬프트에 금지 목록을 쌓아도 모델은 빈자리를 일반론과 지어낸 장면으로 채운다.
 *
 * inquiries 를 재사용하지 않는 이유 — 그 표는 유입 경로에서 등록 전환을 재는 표다.
 * 수업 장면·아이 말을 넣으려면 가짜 source 행을 만들어야 하고, 상담 하나에서 재료가
 * 셋 나오면 문의 수가 부풀어 전환율이 망가진다. 사이티드 영업 숫자가 거기서 나온다.
 *
 *   node scripts/setup-materials.mjs
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});

// company.mjs 의 ensure() 에도 같은 두 덩어리가 있다. 한쪽만 고치면 Actions 가 사람 손을 기다린다
await pool.query(`
  create table if not exists academy.materials (
    id         uuid primary key default gen_random_uuid(),
    client_id  int  not null default 1,
    -- 기본값을 current_date 로 두면 UTC 러너에서 전날로 찍힌다 (CLAUDE.md 함정)
    day        date not null default ((now() at time zone 'Asia/Seoul')::date),
    kind       text not null check (kind in ('상담','수업','질문','사례','숫자')),
    said       text not null,                -- 들은 말·있었던 일 그대로. 요약 금지
    context    text not null default '',     -- 학년·상황 (예: 초5 · 대회반 상담)
    used_in    text[] not null default '{}', -- 이 재료로 쓴 글 slug
    origin     text not null default 'owner',-- owner | inquiry
    inquiry_id uuid,
    created_at timestamptz not null default now()
  )`);

await pool.query(`create index if not exists materials_unused_idx
  on academy.materials (client_id, day desc) where cardinality(used_in) = 0`);

await pool.query(`
  create table if not exists academy.draft_feedback (
    id         bigserial primary key,
    client_id  int  not null default 1,
    slug       text not null,
    title      text not null default '',
    reasons    text[] not null default '{}',
    note       text not null default '',
    excerpt    text not null default '',     -- 버린 본문 앞 600자. 다음 프롬프트가 본다
    created_at timestamptz not null default now()
  )`);

/**
 * 뒤채움 1회. 상담에서 들은 말은 이미 문의 화면으로 들어오고 있다 —
 * 원장이 같은 말을 두 번 치게 두지 않는다. 이미 옮긴 inquiry_id 는 건너뛴다.
 */
const { rows: moved } = await pool.query(`
  insert into academy.materials (client_id, day, kind, said, context, origin, inquiry_id)
  select i.client_id, i.day, '상담', i.said, coalesce(i.grade, ''), 'inquiry', i.id
    from academy.inquiries i
   where coalesce(i.said, '') <> ''
     and not exists (select 1 from academy.materials m where m.inquiry_id = i.id)
  returning id`);

const { rows } = await pool.query(
  `select count(*)::int n, count(*) filter (where cardinality(used_in) = 0)::int unused from academy.materials`);
const { rows: fb } = await pool.query(`select count(*)::int n from academy.draft_feedback`);

console.log(`academy.materials 준비됨 · ${rows[0].n}건 (안 쓴 것 ${rows[0].unused}개) · 문의에서 옮긴 것 ${moved.length}건`);
console.log(`academy.draft_feedback 준비됨 · ${fb[0].n}건`);
await pool.end();
