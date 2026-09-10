/**
 * 문의 기록 표를 만든다.
 *
 * 이게 없어서 사이티드 검증의 마지막 고리가 끊겨 있었다.
 * 노출도 재고 크롤러도 재는데, 그게 문의로 이어지는지를 못 재고 있었다.
 *
 * AI 답변을 보고 온 사람은 서버 기록에 안 남는다. 챗 화면에서 이름만 보고
 * 나중에 네이버로 검색해 오면 "네이버에서 온 사람"으로 찍힌다.
 * 그래서 상담에서 직접 묻는 것 말고는 방법이 없다.
 * 원시적이지만 조작이 불가능하고, 대행사가 아니라 고객사가 가진 데이터라
 * 리포트보다 신뢰도가 높다.
 *
 *   node scripts/setup-inquiries.mjs
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

await pool.query(`
  create table if not exists academy.inquiries (
    id         uuid primary key default gen_random_uuid(),
    day        date not null default current_date,
    -- 어떻게 알고 왔는가. 이 한 칸이 이 표의 존재 이유다.
    source     text not null,
    -- 원문 그대로. "AI한테 물어봤더니 여기가 나왔어요" 같은 말을 남긴다.
    said       text not null default '',
    channel    text not null default '전화',   -- 전화 · 카카오 · 방문
    grade      text not null default '',        -- 초등 저학년 · 고학년 · 중등
    enrolled   boolean,                          -- null = 아직 모름
    note       text not null default '',
    created_at timestamptz not null default now()
  )`);

await pool.query(`create index if not exists inquiries_day_idx on academy.inquiries (day desc)`);

/** 유입 경로는 몇 가지로 고정한다. 자유 입력만 두면 나중에 셀 수가 없다. */
await pool.query(`
  create or replace view academy.inquiry_summary as
  select
    date_trunc('month', day)::date as month,
    count(*)::int                                              as total,
    count(*) filter (where source in ('네이버검색','구글검색','AI'))::int as from_search,
    count(*) filter (where source = 'AI')::int                 as from_ai,
    count(*) filter (where source = '소개')::int               as from_word,
    count(*) filter (where enrolled)::int                      as enrolled
  from academy.inquiries
  group by 1 order by 1 desc`);

const { rows } = await pool.query(`select count(*)::int n from academy.inquiries`);
console.log(`academy.inquiries 준비됨 · 지금 ${rows[0].n}건`);
console.log("academy.inquiry_summary 뷰 생성");
await pool.end();
