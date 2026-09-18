/**
 * 손을 댄 날을 기록한다.
 *
 * 사이티드가 파는 게 「시작할 때 숫자를 남겨 두고 나중에 다시 잰다」인데,
 * 정작 무엇을 언제 했는지는 아무 데도 안 남고 있었다.
 * 2주 뒤에 GPTBot 커버리지가 올라도 왜 올랐는지 증명할 수가 없다.
 *
 * 09.11 고객사 칸을 붙였다. 전에는 아이로그에 한 일을 적을 자리가 없었다.
 *
 *   node scripts/log-intervention.mjs "한 일" "왜" "무엇이 달라지길 기대하나"
 *   node scripts/log-intervention.mjs --client ilog "한 일" "왜" "기대"
 *   node scripts/log-intervention.mjs --list [--client ilog]
 */
import fs from "node:fs";
import { Pool } from "pg";
import { CLIENTS, bySlug } from "../clients.mjs";

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
  create table if not exists academy.interventions (
    id       serial primary key,
    day      date not null default ((now() at time zone 'Asia/Seoul')::date),
    what     text not null,
    why      text,
    expect   text,
    created  timestamptz not null default now()
  )`);
await pool.query(`alter table academy.interventions add column if not exists client_id int not null default 1`);
// Neon 세션은 UTC다. 오전 실행을 전날 작업으로 기록하지 않도록 DB 기본값도 KST로 고정한다.
await pool.query(`alter table academy.interventions alter column day set default ((now() at time zone 'Asia/Seoul')::date)`);

let args = process.argv.slice(2);
let client = null;
const ci = args.indexOf("--client");
if (ci >= 0) {
  client = bySlug(args[ci + 1]);
  if (!client) throw new Error(`고객사 없음: ${args[ci + 1]}`);
  args = args.filter((_, i) => i !== ci && i !== ci + 1);
}

if (args[0] === "--list" || !args.length) {
  const { rows } = await pool.query(
    `select day::text, client_id, what, why, expect from academy.interventions
      where ($1::int is null or client_id = $1) order by day desc, id desc`,
    [client?.id ?? null],
  );
  if (!rows.length) console.log("  기록 없음");
  for (const r of rows) {
    const name = CLIENTS.find((c) => c.id === r.client_id)?.name ?? `#${r.client_id}`;
    console.log(`\n  ${r.day}  [${name}] ${r.what}`);
    if (r.why) console.log(`     왜   ${r.why}`);
    if (r.expect) console.log(`     기대 ${r.expect}`);
  }
  await pool.end();
  process.exit(0);
}

const [what, why, expect] = args;
const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
await pool.query(
  `insert into academy.interventions (day, client_id, what, why, expect) values ($1::date,$2,$3,$4,$5)`,
  [day, client?.id ?? 1, what, why ?? null, expect ?? null],
);
console.log(`  기록했습니다 — [${(client ?? CLIENTS[0]).name}] ${what}`);
await pool.end();
