/**
 * 색인·노출 확인 — 레퍼런스가 완성됐는지 매일 잰다.
 *
 * 크롤러가 읽어간 것과 검색에 나오는 것은 다른 단계다.
 *   크롤러 방문  →  색인 등록  →  검색·AI 답변 노출
 * 앞의 것은 서버 기록으로 알 수 있지만, 뒤의 둘은 밖에서 직접 검색해 봐야 안다.
 *
 * 이 사업의 첫 레퍼런스가 "언제 완성됐는지"를 나중에 기억으로 말하면 안 된다.
 * 날짜가 기록으로 남아야 영업에서 쓸 수 있다.
 *
 *   node scripts/check-index.mjs
 *   node scripts/check-index.mjs --dry   저장하지 않고 보기만
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DOMAIN = "robotncoding.com";
const DRY = process.argv.includes("--dry");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

/** 실제로 확인할 질의. 학부모가 쓸 말 그대로. */
const QUERIES = [
  { id: "idx", q: `site:${DOMAIN}`, kind: "색인" },
  { id: "loc1", q: "송파구 석촌동 코딩학원", kind: "지역" },
  { id: "loc2", q: "송파 초등 코딩학원 추천", kind: "지역" },
  { id: "loc3", q: "석촌동 로봇 코딩학원", kind: "지역" },
  { id: "brand", q: "로봇앤코딩학원 석촌동", kind: "브랜드" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Bing 결과에서 우리 도메인이 나오는지 본다.
 *
 * 주의: Bing 은 색인이 없어도 "약 86개의 결과"라며 무관한 페이지를 채워 넣는다.
 * 그래서 결과 수를 세면 안 되고, 실제 링크가 우리 도메인인지를 봐야 한다.
 */
async function probe(q) {
  const url = "https://www.bing.com/search?q=" + encodeURIComponent(q) + "&setlang=ko&cc=KR";
  let html = "";
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9" } });
    if (!r.ok) return { ok: false, hit: false, rank: null, note: `HTTP ${r.status}` };
    html = await r.text();
  } catch (e) {
    return { ok: false, hit: false, rank: null, note: e.message };
  }

  // Bing 은 결과 링크를 /ck/a?u=<base64> 로 감싼다. 대신 표시용 주소(cite)를 읽는다.
  // 그리고 색인이 없어도 무관한 페이지로 열 칸을 채우므로,
  // 결과 수가 아니라 "그 안에 우리 도메인이 있는가"만 본다.
  const blocks = html.split('class="b_algo"').slice(1);
  const links = blocks
    .map((bl) => {
      const m = bl.slice(0, 8000).match(/<cite[^>]*>([\s\S]*?)<\/cite>/);
      return m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, "") : null;
    })
    .filter(Boolean);

  const idx = links.findIndex((u) => u.includes(DOMAIN));
  return {
    ok: true,
    hit: idx >= 0,
    rank: idx >= 0 ? idx + 1 : null,
    total: links.length,
    note: links.length === 0 ? "결과 파싱 0건" : "",
  };
}

const rows = [];
for (const [i, { id, q, kind }] of QUERIES.entries()) {
  if (i) await sleep(2600); // 연달아 때리면 막힌다
  const r = await probe(q);
  rows.push({ id, q, kind, ...r });
  const mark = !r.ok ? "?" : r.hit ? `노출 ${r.rank}위` : "미노출";
  console.log(`  ${kind.padEnd(5)} ${q.slice(0, 26).padEnd(28)} ${mark}${r.note ? "  (" + r.note + ")" : ""}`);
}

const indexed = rows.find((r) => r.id === "idx")?.hit ?? false;
const exposed = rows.filter((r) => r.kind !== "색인" && r.hit).length;

console.log();
console.log(`  색인: ${indexed ? "됨" : "아직"} · 질의 노출: ${exposed}/${rows.length - 1}`);

// ── 레퍼런스 완성 판정
const READY = indexed && exposed >= 1;
console.log(`  레퍼런스: ${READY ? "쓸 수 있음" : "아직 이름"}`);

if (DRY) process.exit(0);

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});

await pool.query(`
  create table if not exists academy.serp_checks (
    day       date not null,
    query_id  text not null,
    query     text not null,
    kind      text not null,
    hit       boolean not null,
    rank      int,
    checked_at timestamptz not null default now(),
    primary key (day, query_id)
  )`);

for (const r of rows) {
  if (!r.ok) continue;
  await pool.query(
    `insert into academy.serp_checks (day, query_id, query, kind, hit, rank)
     values (current_date, $1, $2, $3, $4, $5)
     on conflict (day, query_id) do update set
       hit = excluded.hit, rank = excluded.rank, checked_at = now()`,
    [r.id, r.q, r.kind, r.hit, r.rank],
  );
}

// 언제 처음 나왔는지 — 영업에서 쓸 날짜
const { rows: first } = await pool.query(
  `select query_id, query, min(day) d from academy.serp_checks
    where hit group by query_id, query order by min(day)`,
);
if (first.length) {
  console.log("\n  처음 노출된 날");
  first.forEach((f) =>
    console.log(`    ${new Date(f.d).toLocaleDateString("ko-KR")}  ${f.query}`));
}

await pool.end();
