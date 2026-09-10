/**
 * 유니크 제약에 client_id 를 넣는다.
 *
 * serp_checks 는 (day, engine, query_id) 로 묶여 있고
 * place_checks 는 (day, query) 로 묶여 있다.
 * 고객사가 한 곳일 때는 맞지만, 두 곳이 같은 날 같은 검색어를 재면
 * on conflict 가 걸려서 **뒤에 잰 고객사가 앞 고객사 결과를 덮어쓴다.**
 *
 * 「송파구 코딩학원」은 우리 고객사 전용 검색어가 아니다. 다른 학원 고객사가
 * 생기면 바로 부딪힌다. 조용히 덮어써서 아무도 모르게 숫자가 틀어진다.
 *
 *   node scripts/fix-client-keys.mjs
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

const PLAN = [
  { table: "serp_checks", cols: ["client_id", "day", "engine", "query_id"] },
  { table: "place_checks", cols: ["client_id", "day", "query"] },
];

for (const { table, cols } of PLAN) {
  console.log(`── academy.${table} ──`);

  // 지금 걸린 제약을 본다. 이름을 추측하면 엉뚱한 걸 지운다.
  const cons = await q(`
    select con.conname, pg_get_constraintdef(con.oid) def
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'academy' and rel.relname = $1 and con.contype in ('u','p')`,
    [table]);
  for (const c of cons) console.log(`  현재: ${c.conname} ${c.def}`);

  const want = `unique (${cols.join(", ")})`;
  const already = cons.find((c) => c.def.replace(/\s+/g, " ").toLowerCase().startsWith(want));
  if (already) { console.log("  이미 고객사가 들어 있습니다\n"); continue; }

  /**
   * 기본키도 봐야 한다.
   * place_checks 는 (day, query) 가 PRIMARY KEY 였다. 유니크만 바꾸고 놔뒀더니
   * 기본키가 그대로 남아서 두 고객사가 여전히 부딪히는 상태였다.
   * 기본키를 떼려면 대체할 열이 있어야 하므로 id 를 먼저 만든다.
   */
  const pk = cons.find((c) => c.def.toLowerCase().startsWith("primary key"));
  if (pk && !pk.def.toLowerCase().includes("client_id")) {
    const hasId = (await q(`
      select 1 from information_schema.columns
       where table_schema='academy' and table_name=$1 and column_name='id'`, [table])).length;
    if (!hasId) {
      await q(`alter table academy.${table} add column id bigserial`);
      console.log("  id 열 추가");
    }
    await q(`alter table academy.${table} drop constraint ${pk.conname}`);
    await q(`alter table academy.${table} add primary key (id)`);
    console.log(`  기본키 교체: ${pk.conname} → id`);
  }

  const drop = cons.filter((c) => c.def.toLowerCase().startsWith("unique"));
  for (const c of drop) {
    await q(`alter table academy.${table} drop constraint ${c.conname}`);
    console.log(`  떼어냄: ${c.conname}`);
  }
  const name = `${table}_client_uniq`;
  await q(`alter table academy.${table} add constraint ${name} unique (${cols.join(", ")})`);
  console.log(`  새로: ${name} (${cols.join(", ")})\n`);
}

console.log("── 확인 ──");
for (const { table } of PLAN) {
  for (const c of await q(`
    select con.conname, pg_get_constraintdef(con.oid) def
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname='academy' and rel.relname=$1 and con.contype='u'`, [table])) {
    console.log(`  ${table}: ${c.def}`);
  }
}

await pool.end();
