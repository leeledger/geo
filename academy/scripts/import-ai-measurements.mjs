/**
 * AI 답변 측정 원본을 고객사별 DB에 적재한다.
 *
 * 수동 소비자 화면, Claude Code WebSearch, API 측정 모두 같은 표에 넣되
 * collection_method와 engine을 보존한다. 서로 다른 방법의 수치를 한 비율로
 * 합치면 안 되므로 보고서도 측정 회차별로만 비교한다.
 *
 *   node scripts/import-ai-measurements.mjs ../probe/data/manual.claude-code-websearch.json
 *   node scripts/import-ai-measurements.mjs <file> --client robotncoding
 */
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { 인용판정 } from "../measure-targets.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

let args = process.argv.slice(2);
const ci = args.indexOf("--client");
const clientSlug = ci >= 0 ? args[ci + 1] : "robotncoding";
if (ci >= 0) args = args.filter((_, i) => i !== ci && i !== ci + 1);
if (!args[0]) throw new Error("사용법: node scripts/import-ai-measurements.mjs <json|jsonl> [--client slug]");

const file = path.resolve(process.cwd(), args[0]);
const source = fs.readFileSync(file, "utf8").trim();
const parsed = file.endsWith(".jsonl")
  ? source.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))
  : JSON.parse(source);

const normalizeDomain = (x) => {
  try { return new URL(x.url ?? x).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return String(x.domain ?? x).replace(/^www\./, "").toLowerCase(); }
};

// 수동 기록의 cited_us 표시는 사이트가 있을 때만 믿는다 — 사이트 없는 고객은 해당없음(null)
const 인용또는표시 = (판정, 표시) => (판정 === null ? null : 판정 || Boolean(표시));

let rows;
let meta;
if (Array.isArray(parsed)) {
  rows = parsed.filter((r) => r.ok !== false).map((r) => ({
    measured_on: (r.collected_at ?? new Date().toISOString()).slice(0, 10),
    collection_method: r.collection_method ?? "api",
    engine: r.engine,
    model: r.model ?? null,
    prompt_id: r.prompt_id,
    stage: r.stage ?? null,
    prompt_text: r.prompt_text,
    attempt: r.attempt ?? 1,
    citations: r.citations ?? [],
    mentioned: Boolean(r.mentioned_us),
    cited: 인용판정((r.citations ?? []).map(normalizeDomain), client.domain),
    note: r.note ?? null,
    raw: r,
  }));
  meta = {};
} else {
  meta = parsed;
  rows = (parsed.runs ?? parsed.entries ?? []).map((r, n) => ({
    measured_on: parsed.day ?? (parsed.collected_at ?? new Date().toISOString()).slice(0,10),
    collection_method: parsed.collection_method ?? "manual",
    engine: parsed.engine ?? "manual",
    model: parsed.model ?? null,
    prompt_id: r.prompt_id ?? `manual-${r.i ?? n}`,
    stage: r.stage ?? null,
    prompt_text: r.prompt ?? r.prompt_text ?? r.prompt_id,
    attempt: r.attempt ?? 1,
    citations: (r.sources ?? []).map((domain) => ({ domain })),
    mentioned: Boolean(r.mentioned_us) || String(r.text ?? "").toLowerCase().includes(client.name.toLowerCase()),
    cited: 인용또는표시(인용판정((r.sources ?? []).map(normalizeDomain), client.domain), r.cited_us),
    note: r.note ?? null,
    raw: r,
  }));
}

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const { rows: [client] } = await pool.query(`select id,slug,name,domain from geo.clients where slug=$1`, [clientSlug]);
if (!client) { await pool.end(); throw new Error(`고객사 없음: ${clientSlug}`); }

await pool.query(`
  create table if not exists academy.ai_measurements (
    id bigserial primary key,
    client_id int not null default 1,
    measured_on date not null,
    collection_method text not null,
    engine text not null,
    model text,
    prompt_id text not null,
    stage text,
    prompt_text text not null,
    attempt int not null default 1,
    mentioned boolean not null default false,
    cited boolean not null default false,
    citations jsonb not null default '[]'::jsonb,
    note text,
    raw jsonb not null,
    imported_at timestamptz not null default now(),
    unique (client_id, measured_on, collection_method, engine, prompt_id, attempt)
  )`);
await pool.query(`alter table academy.ai_measurements alter column cited drop not null`);
await pool.query(`alter table if exists academy.ai_probe_measurements alter column cited drop not null`);
await pool.query(`create index if not exists ai_measurements_client_day_idx on academy.ai_measurements (client_id, measured_on desc)`);

let written = 0;
for (const r of rows) {
  await pool.query(`
    insert into academy.ai_measurements
      (client_id, measured_on, collection_method, engine, model, prompt_id, stage, prompt_text,
       attempt, mentioned, cited, citations, note, raw)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14::jsonb)
    on conflict (client_id, measured_on, collection_method, engine, prompt_id, attempt)
    do update set mentioned=excluded.mentioned, cited=excluded.cited, citations=excluded.citations,
                  note=excluded.note, raw=excluded.raw, imported_at=now()`,
    [client.id, r.measured_on, r.collection_method, r.engine, r.model, r.prompt_id, r.stage,
      r.prompt_text, r.attempt, r.mentioned, r.cited, JSON.stringify(r.citations), r.note,
      JSON.stringify({ ...r.raw, measurement_note: meta.note ?? null, measure: meta.measure ?? null })]);
  written++;
}

console.log(`${client.name} · AI 답변 측정 ${written}건 적재 · ${path.basename(file)}`);
await pool.end();
