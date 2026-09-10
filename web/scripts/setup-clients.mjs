/**
 * 고객사 표를 만든다 — 대시보드가 여러 곳을 볼 수 있게.
 *
 * 지금 고객사는 로봇&코딩학원 한 곳이고, 측정 데이터가 전부 `academy` 스키마에
 * 들어 있다. 코드 열네 곳에 `academy.` 가 박혀 있어서, 두 번째 고객사가 생기면
 * 그 열네 곳을 다시 손봐야 한다.
 *
 * 한 곳일 때 미리 갈라 두는 게 싸다. 두 곳이 되고 나서 가르면 그때는
 * 「어느 줄이 누구 것인지」부터 알아내야 한다.
 *
 * 하는 일
 *   1. geo.clients — 고객사 명부
 *   2. 측정 표마다 client_id 를 붙이고, 기존 줄은 전부 로봇&코딩학원 것으로 채운다
 *   3. 없으면 만들고 있으면 그냥 둔다. 여러 번 돌려도 안전하다
 *
 *   node scripts/setup-clients.mjs
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
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);

console.log("── geo.clients ──");
await q(`
  create table if not exists geo.clients (
    id          serial primary key,
    slug        text not null unique,
    name        text not null,
    domain      text,
    /* 대외 공개용 가림 이름. 사례로 쓸 때 이걸 쓴다 */
    alias       text,
    status      text not null default 'active',   -- active · paused · ended
    started_on  date not null default current_date,
    /* 측정 데이터가 어느 스키마에 있나. 첫 고객사는 academy 에 있다 */
    schema_name text not null default 'academy',
    note        text,
    created_at  timestamptz not null default now()
  )`);

const [me] = await q(`
  insert into geo.clients (slug, name, domain, alias, schema_name, started_on, note)
  values ('robotncoding', '로봇&코딩학원', 'robotncoding.com',
          '수도권의 코딩·로봇 교육 학원', 'academy', date '2026-09-05',
          '사이티드의 첫 레퍼런스. 원장 본인이 운영한다')
  on conflict (slug) do update set
    name = excluded.name, domain = excluded.domain, alias = excluded.alias
  returning id, slug, name`);
console.log(`  ${me.id}. ${me.name} (${me.slug})`);

// ── 측정 표에 client_id 를 붙인다
const TABLES = ["posts", "crawl_hits", "serp_checks", "place_checks", "inquiries"];
console.log("\n── client_id 붙이기 ──");
for (const t of TABLES) {
  const exists = (await q(`select to_regclass('academy.${t}') r`))[0].r;
  if (!exists) { console.log(`  academy.${t} — 표가 없습니다`); continue; }

  const has = (await q(`
    select 1 from information_schema.columns
     where table_schema='academy' and table_name=$1 and column_name='client_id'`, [t])).length;

  if (!has) {
    // 기본값을 첫 고객사로 둔다. 그래야 지금 도는 스크립트들이 안 깨진다 —
    // insert 문마다 client_id 를 넣게 고치는 건 나중에 해도 된다.
    await q(`alter table academy.${t} add column client_id int not null default ${me.id}
             references geo.clients(id)`);
    await q(`create index if not exists ${t}_client_idx on academy.${t} (client_id)`);
    console.log(`  academy.${t} — 붙였습니다`);
  } else {
    console.log(`  academy.${t} — 이미 있습니다`);
  }

  const [{ n, mine }] = await q(`
    select count(*)::int n, count(*) filter (where client_id = ${me.id})::int mine
      from academy.${t}`);
  console.log(`      ${n}줄 · 이 고객사 ${mine}줄`);
}

console.log("\n── 고객사 목록 ──");
for (const c of await q(`select id, slug, name, status, started_on::text d from geo.clients order by id`)) {
  console.log(`  ${c.id}. ${c.name.padEnd(14)} ${c.slug.padEnd(14)} ${c.status}  착수 ${c.d}`);
}

await pool.end();
