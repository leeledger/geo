/**
 * 지고 있는 검색어와 쓰려는 주제가 맞물리는가.
 *
 * 고리의 마지막 자리는 「다음에 뭘 쓸지 정한다」다. 그 자리가 하는 일은
 * 「잰 결과」를 「쓸 것」으로 바꾸는 것이다. 그런데 지금 큐에 든 주제 12개는
 * 전부 전국 단위 AI 교육 이야기고, 우리가 지고 있는 검색어는 전부 동네 검색어다.
 * 고리는 도는데 제자리로만 온다.
 *
 * 「경쟁 0/6」은 멈춤이 아니라 신호다. 무엇을 써야 하는지 알려주고 있다.
 *
 *   node scripts/topic-gap.mjs
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
const CLIENT = Number(process.env.CLIENT_ID ?? 1);

// ── 지고 있는 검색어
const losing = await q(`
  select query, bool_or(hit) as won
    from academy.serp_checks
   where client_id = $1 and kind = '경쟁'
     and day = (select max(day) from academy.serp_checks where client_id = $1)
   group by query order by query`, [CLIENT]);

console.log("【 지고 있는 경쟁 검색어 】");
const lost = losing.filter((r) => !r.won).map((r) => r.query);
for (const r of losing) console.log(`  ${r.won ? "★ 잡힘" : "  미노출"}  ${r.query}`);

// ── 쓰려는 주제
const spec = JSON.parse(fs.readFileSync(new URL("../content/topics.json", import.meta.url), "utf8"));
const topics = spec.topics ?? [];

/** 검색어에서 뜻있는 낱말만 뽑는다. 「학원」「추천」은 다 들어가 있어서 뺀다. */
const STOP = new Set(["학원", "추천", "코딩", "초등", "교실"]);
const words = (s) => s.split(/\s+/).map((w) => w.replace(/[^가-힣a-zA-Z0-9]/g, "")).filter((w) => w && !STOP.has(w));

console.log(`\n【 큐에 든 주제 ${topics.length}개가 이 검색어를 겨냥하나 】`);
let covered = 0;
for (const query of lost) {
  const keys = words(query);
  const hit = topics.filter((t) => {
    const hay = `${t.title} ${(t.tags ?? []).join(" ")} ${t.angle ?? ""}`;
    return keys.some((k) => hay.includes(k));
  });
  if (hit.length) {
    covered++;
    console.log(`  ○ ${query}`);
    hit.slice(0, 2).forEach((t) => console.log(`      ← ${t.title}`));
  } else {
    console.log(`  ✗ ${query.padEnd(22)} 겨냥하는 주제 없음  (핵심어: ${keys.join(" ")})`);
  }
}

console.log(`\n  ${lost.length}개 중 ${covered}개만 겨냥하고 있습니다.`);

if (covered < lost.length) {
  console.log(`
  ─────────────────────────────────────────────────────
  고리가 제자리로 돕니다.

  잰 결과는 「동네 검색어에서 진다」인데, 쓰려는 주제는 전부 전국 단위입니다.
  그런 글을 몇 편 더 써도 「송파구 코딩학원」에서는 안 올라옵니다.

  동네 검색어를 잡는 길은 셋입니다. 글이 그중 하나일 뿐입니다.
    1. 플레이스   이미 1~2위다. 여기는 됐다
    2. 남의 지면  오늘학교 같은 목록. 인용의 80%가 여기서 온다
    3. 우리 글    지역이 본문에 실제로 들어간 글. 억지로 넣으면 티가 난다
  ─────────────────────────────────────────────────────`);
}

// ── 이미 쓴 글 중 지역이 들어간 것
const localPosts = await q(`
  select slug, title from academy.posts
   where client_id = $1 and published
     and (title ~ '송파|석촌|잠실|가락|헬리오' or body ~ '송파|석촌|잠실|가락|헬리오')
   order by published_at desc limit 10`, [CLIENT]);
console.log(`\n【 지역이 들어간 글 ${localPosts.length}편 】`);
for (const p of localPosts) console.log(`  ${p.title.slice(0, 46)}`);
if (!localPosts.length) console.log("  없음 — 43편 중 지역을 언급한 글이 하나도 없습니다");

await pool.end();
