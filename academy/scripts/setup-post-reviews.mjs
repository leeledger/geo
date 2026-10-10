/**
 * 학원 글 자동 감수 기록 표를 만든다 (Step 43).
 *
 * 주제를 고른 이유, 재료가 모자라 미룬 주제, 감수 회차마다의 관문 결과, 발행·버림·내림이 한 줄씩 쌓인다.
 * 같은 주제를 두 번 쓰지 않는 장치(topic_key)이자, 원장이 「왜 이 글이 나갔나」를 되짚는 기록이다.
 *
 * 끄는 스위치 geo.settings post_auto_publish 는 처음에 'off' 로 넣는다. 이미 있으면 건드리지 않는다.
 * 켜는 것은 러너에서 dry 를 확인한 뒤 사람이 한다 — 'on' 이 아니면(못 읽어도) 자동 발행은 안 나간다.
 *
 *   node scripts/setup-post-reviews.mjs
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
  create table if not exists academy.post_reviews (
    id        bigserial primary key,
    client_id int not null default 1,
    slug      text,
    topic_key text not null,
    kind      text not null check (kind in ('고름','재료부족','감수','발행','버림','내림','못냄')),
    attempt   int,
    passed    boolean,
    stages    jsonb not null default '{}'::jsonb,
    why       text,
    at        timestamptz not null default now()
  )`);
await pool.query(`create index if not exists post_reviews_topic on academy.post_reviews (client_id, topic_key, at desc)`);
await pool.query(`create index if not exists post_reviews_slug on academy.post_reviews (slug, at desc)`);
await pool.query(`insert into geo.settings (key, value) values ('post_auto_publish', 'off') on conflict (key) do nothing`);

const [s] = (await pool.query(`select key, value from geo.settings where key = 'post_auto_publish'`)).rows;
const [n] = (await pool.query(`select count(*)::int n from academy.post_reviews`)).rows;
console.log(`academy.post_reviews 준비됨 · ${n.n}행`);
console.log(`post_auto_publish = ${s?.value ?? "(없음)"}`);
await pool.end();
