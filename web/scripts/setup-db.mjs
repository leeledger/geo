/**
 * DB 초기 설정 — 스키마 적용 + 왕복 검증.
 *
 *   node scripts/setup-db.mjs
 *
 * DATABASE_URL 은 .env.local 또는 환경변수에서 읽는다.
 * 여러 번 실행해도 안전하다 (create ... if not exists).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

// .env.local 을 직접 읽는다 (Next 밖에서 도는 스크립트라 자동 주입이 없다)
for (const f of [".env.local", ".env"]) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

const DSN = process.env.DATABASE_URL;
if (!DSN) {
  console.error("✗ DATABASE_URL 이 없습니다.\n  web/.env.local 에 아래 한 줄을 넣으세요:\n");
  console.error("  DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require\n");
  process.exit(1);
}

const host = (() => { try { return new URL(DSN).hostname; } catch { return "?"; } })();
console.log(`대상  ${host}`);
if (/neon\.tech$/.test(host) && !/-pooler\./.test(host)) {
  console.warn("⚠ Pooler 가 아닌 직접 연결입니다. 서버리스에서는 커넥션이 고갈됩니다.");
  console.warn("  Neon 대시보드에서 'Pooled connection' 문자열(호스트에 -pooler 포함)로 바꾸세요.\n");
}

// sslmode 는 코드에서 정한다 (pg 8.23+ 경고 회피). 기본은 인증서 검증 켜짐.
let dsnClean = DSN;
try { const u = new URL(DSN); u.searchParams.delete("sslmode"); dsnClean = u.toString(); } catch {}

const client = new pg.Client({
  connectionString: dsnClean,
  ssl: /localhost|127\.0\.0\.1/.test(DSN) ? undefined
     : { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  const { rows: [v] } = await client.query("select version()");
  console.log(`연결  ${v.version.split(",")[0]}\n`);

  const sql = fs.readFileSync(path.join(ROOT, "db", "schema.sql"), "utf8");
  await client.query(sql);
  console.log("✓ 스키마 적용");

  const { rows: tables } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'geo' order by table_name`);
  console.log(`✓ geo 스키마 객체: ${tables.map((t) => t.table_name).join(", ")}`);

  // 왕복 검증 — 실제로 쓰고 읽고 지운다
  const { rows: [s] } = await client.query(
    `insert into geo.scans (origin, total, grade, checks, notes)
     values ('https://__setup_test__', 0, '위험', '{}'::jsonb, '[]'::jsonb) returning id`);
  const { rows: [l] } = await client.query(
    `insert into geo.leads (scan_id, email, company) values ($1, 'setup@test.local', '설정검증') returning id`,
    [s.id]);
  const { rows: [j] } = await client.query(
    `select l.email, sc.origin from geo.leads l join geo.scans sc on sc.id = l.scan_id where l.id = $1`, [l.id]);
  console.log(`✓ 쓰기·조인·읽기 확인 (${j.email})`);

  await client.query("delete from geo.leads where id = $1", [l.id]);
  await client.query("delete from geo.scans where id = $1", [s.id]);
  console.log("✓ 검증 데이터 정리\n");

  const { rows: [c] } = await client.query(
    "select (select count(*) from geo.scans) scans, (select count(*) from geo.leads) leads");
  console.log(`현재  진단 ${c.scans}건 · 리드 ${c.leads}건`);
  console.log("\n준비 완료. npm run dev 후 /admin 에서 확인하세요.");
} catch (e) {
  console.error("\n✗ 실패:", e.message);
  if (/password authentication|SASL/i.test(e.message)) console.error("  → 연결 문자열의 비밀번호를 확인하세요.");
  if (/ENOTFOUND|EAI_AGAIN/i.test(e.message)) console.error("  → 호스트명을 확인하세요.");
  if (/self.signed|certificate/i.test(e.message)) console.error("  → URL 끝에 ?sslmode=require 를 붙이세요.");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
