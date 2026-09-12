/**
 * 아직 발행 안 된 초안을 읽는다.
 *
 * 발행 전 사실 확인은 사람이 한다 — CLAUDE.md 에 그렇게 적혀 있다.
 * 그런데 초안은 사이트에 안 뜨니 볼 방법이 없었다. 그 자리를 메운다.
 *
 *   node scripts/draft-peek.mjs           초안 목록
 *   node scripts/draft-peek.mjs <슬러그>   본문까지
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
const CLIENT = Number(process.env.CLIENT_ID ?? 1);
const only = process.argv.slice(2).find((a) => !a.startsWith("--"));

const { rows } = await pool.query(
  only
    ? `select slug, title, summary, body, tags, updated_at from academy.posts where slug = $1`
    : `select slug, title, summary, length(body) 길이, updated_at from academy.posts
        where client_id = $1 and not published order by updated_at desc limit 20`,
  only ? [only] : [CLIENT],
);
await pool.end();

if (!rows.length) {
  console.log(only ? `${only} 를 못 찾았습니다.` : "초안이 없습니다.");
  process.exit(0);
}

const 때 = (d) => new Date(d).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

if (!only) {
  console.log(`초안 ${rows.length}편\n`);
  for (const p of rows) {
    console.log(`  ${p.slug}`);
    console.log(`    ${p.title}`);
    console.log(`    ${p.길이}자 · ${때(p.updated_at)}`);
  }
  console.log("\n본문을 보려면: node scripts/draft-peek.mjs <슬러그>");
} else {
  const p = rows[0];
  console.log(`제목  ${p.title}`);
  console.log(`슬러그 ${p.slug}`);
  console.log(`요약  ${p.summary ?? ""}`);
  console.log(`태그  ${(p.tags ?? []).join(", ")}`);
  console.log(`길이  ${(p.body ?? "").length}자 · ${때(p.updated_at)}`);
  console.log("\n" + "─".repeat(60) + "\n");
  console.log(p.body ?? "");
}
