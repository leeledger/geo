/**
 * 리드 큐에서 테스트 데이터를 지운다.
 *
 * 09-05 에 리드 폼을 검증하면서 curl 로 넣은 것들이다.
 * Git Bash 가 한글을 제대로 못 넘겨서 회사명이 「���ؾ��̾ؾ�」로 들어갔고,
 * 그게 관리 화면에 실제 문의처럼 「2건」으로 떠 있었다.
 *
 * 진짜 문제는 깨진 글자가 아니라 **없는 리드를 있다고 세고 있던 것**이다.
 * 「연락처를 남긴 사람 2건」을 보고 영업 판단을 하면 안 된다.
 *
 *   node scripts/leads-clean.mjs          지울 것만 보여준다
 *   node scripts/leads-clean.mjs --apply  실제로 지운다
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

const APPLY = process.argv.includes("--apply");

/**
 * 테스트로 볼 근거.
 * 하나만 걸려도 지우지 않는다 — 실제 고객 이메일이 example 도메인일 리는 없지만,
 * 깨진 글자만으로 지우면 진짜 문의를 날릴 수 있다. 둘 다 봐야 한다.
 */
const { rows } = await pool.query(`
  select id, created_at, email, company, wants, source
    from geo.leads order by created_at`);

const test = [];
for (const r of rows) {
  const why = [];
  if (/@(example|test|sample)\./i.test(r.email)) why.push("테스트 도메인 이메일");
  if (/@dahae\.co\.kr$/i.test(r.email)) why.push("검증에 쓴 주소 (다해INC 는 프로브 표본 회사)");
  if (/�/.test(r.company ?? "")) why.push("회사명이 깨져 있음");
  if (/�/.test(r.wants ?? "")) why.push("관심 항목이 깨져 있음");
  if (why.length >= 2) test.push({ r, why });
}

console.log(`전체 ${rows.length}건 · 테스트로 판정 ${test.length}건\n`);
for (const { r, why } of test) {
  console.log(`  ${new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")}  ${r.email}`);
  why.forEach((w) => console.log(`     · ${w}`));
}

const keep = rows.length - test.length;
console.log(`\n남는 건 ${keep}건`);

if (!APPLY) {
  console.log("\n지우려면 --apply 를 붙여 다시 부르세요.");
  await pool.end();
  process.exit(0);
}

if (!test.length) { await pool.end(); process.exit(0); }

// 지우기 전에 원본을 파일로 남긴다. 되돌릴 수 없는 일은 흔적을 남긴다.
// 저장소 안에 쓰면 커밋에 딸려 간다 — 한 번 그랬다. 사람 연락처가 들어갈 수 있는 파일이다.
const dir = (process.env.TEMP || process.env.TMPDIR || "/tmp").split("\\").join("/");
const backup = `${dir}/leads-backup-${Date.now()}.json`;
fs.writeFileSync(backup, JSON.stringify(test.map((t) => t.r), null, 1), "utf8");
console.log(`\n원본을 남겼습니다: ${backup}`);

const ids = test.map((t) => t.r.id);
await pool.query(`delete from geo.leads where id = any($1::uuid[])`, [ids]);
const [{ n }] = (await pool.query(`select count(*)::int n from geo.leads`)).rows;
console.log(`지웠습니다. 남은 리드 ${n}건`);

await pool.end();
