/**
 * 답 대신 로그인 요구 화면이 저장된 과거 소비자 AI 측정을 실패 원장으로 옮긴다.
 *
 * 이 행은 브랜드 미언급이 아니라 측정 실패다. ai_measurements 에 두면 개선 루프와
 * 케이스 리포트의 분모를 부풀리므로, 원문을 ai_measurement_failures 에 보존한 뒤 뺀다.
 * 재실행해도 이미 옮긴 행은 source_measurement_id 로 중복되지 않는다.
 *
 *   node scripts/archive-blocked-ai-measurements.mjs
 *   node scripts/archive-blocked-ai-measurements.mjs --dry
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
const dry = process.argv.includes("--dry");

const blocked = String.raw`가입한 뒤 요청을 다시|Sign in to continue|로그인해서 계속|verify you are human|로그인하여 계속|unusual activity|비정상적인 활동`;
const client = await pool.connect();
try {
  await client.query("begin");
  await client.query(`create table if not exists academy.ai_measurement_failures (
    id bigserial primary key,
    source_measurement_id bigint unique,
    client_id int not null,
    measured_on date not null,
    collection_method text not null,
    engine text not null,
    prompt_id text not null,
    stage text,
    prompt_text text,
    attempt int not null default 1,
    reason text not null,
    raw jsonb not null default '{}'::jsonb,
    recorded_at timestamptz not null default now(),
    unique(client_id, measured_on, collection_method, engine, prompt_id, attempt)
  )`);

  const candidates = await client.query(
    `select count(*)::int n, min(measured_on)::text first_day, max(measured_on)::text last_day
       from academy.ai_measurements
      where collection_method like '%-web-logged-out'
        and coalesce(raw->>'answer','') ~* $1`,
    [blocked],
  );
  const c = candidates.rows[0];
  console.log(`옮길 측정 실패 ${c.n}건${c.n ? ` · ${c.first_day}~${c.last_day}` : ""}`);

  if (!dry && c.n) {
    const moved = await client.query(
      `insert into academy.ai_measurement_failures
         (source_measurement_id, client_id, measured_on, collection_method, engine,
          prompt_id, stage, prompt_text, attempt, reason, raw, recorded_at)
       select id, client_id, measured_on, collection_method, engine,
              prompt_id, stage, prompt_text, attempt, '로그인·가입 요구 화면', raw, imported_at
         from academy.ai_measurements
        where collection_method like '%-web-logged-out'
          and coalesce(raw->>'answer','') ~* $1
       on conflict (source_measurement_id) do nothing
       returning source_measurement_id`,
      [blocked],
    );
    const removed = await client.query(
      `delete from academy.ai_measurements m
        using academy.ai_measurement_failures f
        where f.source_measurement_id=m.id
          and m.collection_method like '%-web-logged-out'
          and coalesce(m.raw->>'answer','') ~* $1
        returning m.id`,
      [blocked],
    );
    console.log(`실패 원장 보존 ${moved.rowCount}건 · 측정 집계에서 제외 ${removed.rowCount}건`);
  }

  if (dry) await client.query("rollback");
  else await client.query("commit");
} catch (e) {
  await client.query("rollback").catch(() => {});
  throw e;
} finally {
  client.release();
  await pool.end();
}
