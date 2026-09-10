/**
 * 리드가 실제로 DB 에 남는지, 한글이 안 깨지는지 왕복으로 확인한다.
 *
 * /api/lead 가 {"ok":true} 를 돌려줬는데 표에 아무것도 없었다.
 * 200 을 받았다고 저장된 게 아니다 — 넘긴 것과 저장된 것은 다르다.
 *
 *   node scripts/lead-roundtrip.mjs
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

const MARK = `왕복확인-${Date.now().toString(36)}`;
const EMAIL = `roundtrip@robotncoding.com`;

const before = (await pool.query(`select count(*)::int n from geo.leads`)).rows[0].n;
console.log(`  보내기 전 ${before}건`);

const res = await fetch("https://geo-rose-nine.vercel.app/api/lead", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: EMAIL,
    company: MARK,
    // website 는 허니팟이다 — 사람에게 안 보이는 칸이라 채우면 봇으로 걸린다.
    // 여기 값을 넣었다가 200 을 받고도 저장이 안 돼서 한참 헤맸다. 비워 둔다.
    wants: "측정",
  }),
});
console.log(`  응답 ${res.status} ${JSON.stringify(await res.json())}`);

// 저장은 비동기일 수 있다. 잠깐 기다렸다 본다.
await new Promise((r) => setTimeout(r, 2500));

const rows = (await pool.query(
  `select email, company, wants, scan_id, source, created_at
     from geo.leads order by created_at desc limit 3`,
)).rows;
console.log(`  보낸 뒤 ${rows.length}건`);
for (const r of rows) {
  const ok = r.company === MARK ? "✓ 한글 그대로" : /�/.test(r.company ?? "") ? "⚠ 깨짐" : "";
  console.log(`    ${r.email} · ${r.company} · ${r.wants} ${ok}`);
}

const saved = rows.find((r) => r.email === EMAIL);
if (!saved) {
  console.log("\n  ⚠ 응답은 ok 인데 표에 없습니다. 저장 경로를 봐야 합니다.");
} else {
  console.log(`\n  저장 확인 · scan_id ${saved.scan_id ?? "(없음)"} · source ${saved.source}`);
  await pool.query(`delete from geo.leads where email = $1`, [EMAIL]);
  console.log("  확인용 리드는 지웠습니다.");
}

await pool.end();
