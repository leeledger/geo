/**
 * 리드 큐·문의 기록에 뭐가 들어 있는지 원본 그대로 본다.
 *
 * 관리 화면에서 회사명이 「????」 로 깨져 보인다.
 * DB 에 이미 깨진 채로 들어갔는지, 읽어 올 때 깨지는지 갈라야 한다.
 * 바이트를 직접 보면 안다 — 정상 UTF-8 한글은 EA~ED 로 시작한다.
 *
 *   node scripts/leads-peek.mjs
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
const q = async (s) => (await pool.query(s)).rows;

const found = await q(`
  select table_schema s, table_name t from information_schema.tables
   where table_name in ('leads','lead','inquiries') order by table_schema`);

if (!found.length) {
  console.log("  표가 없습니다");
  await pool.end();
  process.exit(0);
}

for (const { s: schema, t: table } of found) {
  const T = `${schema}.${table}`;
  const rows = await q(`select * from ${T} order by 1`);
  console.log(`\n════════ ${T} · ${rows.length}건 ════════`);

  for (const r of rows) {
    console.log("");
    for (const [k, v] of Object.entries(r)) {
      if (v === null || v === "") continue;
      const val = String(v);
      const hangul = /[가-힣]/.test(val);
      const broken = /�/.test(val);
      // 한글이나 깨진 글자가 있으면 앞 바이트를 같이 찍는다
      const bytes = hangul || broken
        ? "  [" + (Buffer.from(val, "utf8").subarray(0, 9).toString("hex").match(/../g) ?? []).join(" ") + "]"
        : "";
      const mark = broken ? "  ⚠깨짐" : "";
      console.log(`  ${k.padEnd(15)} ${val.slice(0, 55)}${mark}${bytes}`);
    }
  }
}

console.log("\n── DB 인코딩 ──");
for (const r of await q(`show server_encoding`)) console.log(`  server ${r.server_encoding}`);
for (const r of await q(`show client_encoding`)) console.log(`  client ${r.client_encoding}`);

await pool.end();
