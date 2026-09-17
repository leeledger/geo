/**
 * 에이전트 회사 표. 몇 번 돌려도 같다 (additive).
 *
 *   geo.agent_tasks     담당별 일감. 카드의 「다음 행동」 문구가 아니라 실제로 집어 가는 일
 *   geo.agent_activity  담당이 실제로 한 일의 기록. 「지금 누가 일하나」는 여기서 읽는다
 *   academy.posts.review_notes  초안을 쓴 모델이 스스로 적은 「확인이 필요한 문장」과 검사 결과
 *
 *   node scripts/setup-company.mjs
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });

const COMPANY_SQL = [
  `create table if not exists geo.agent_tasks (
    id bigserial primary key,
    client_id int not null references geo.clients(id),
    agent text not null,
    kind text not null,
    dedupe_key text not null,
    title text not null,
    detail text not null default '',
    payload jsonb not null default '{}'::jsonb,
    status text not null default '대기',
    priority int not null default 50,
    attempts int not null default 0,
    evidence text not null default '',
    last_error text not null default '',
    link text,
    next_try_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    done_at timestamptz,
    unique (client_id, dedupe_key)
  )`,
  `create index if not exists agent_tasks_open_idx on geo.agent_tasks (status, next_try_at)`,
  `alter table geo.agent_tasks enable row level security`,
  `create table if not exists geo.agent_activity (
    id bigserial primary key,
    client_id int references geo.clients(id),
    agent text not null,
    action text not null,
    ok boolean not null,
    summary text not null default '',
    task_id bigint,
    run_url text,
    at timestamptz not null default now()
  )`,
  `create index if not exists agent_activity_at_idx on geo.agent_activity (agent, at desc)`,
  `alter table geo.agent_activity enable row level security`,
  `alter table academy.posts add column if not exists review_notes jsonb not null default '{}'::jsonb`,
];

for (const s of COMPANY_SQL) await pool.query(s);
console.log(`에이전트 회사 표 준비 완료 (${COMPANY_SQL.length}문)`);
await pool.end();
