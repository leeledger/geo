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
 * 엔진을 나눠서 잰다. 처음엔 Bing 만 봤는데, Search Console 은 여러 페이지가
 * 이미 색인됐다고 하는데도 화면에는 "0/5 미노출"이 찍혔다. 엔진이 다른 걸
 * 한 숫자로 뭉쳐 놓으면 이런 착각이 생긴다.
 *   Bing   — 긁을 수 있다
 *   네이버  — 긁을 수 있다. 실제 학부모가 쓰는 곳이라 이게 본 판이다.
 *   구글   — 긁으면 막힌다. Search Console URL 검사로 따로 확인한다.
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
/**
 * 재는 검색어.
 *
 * kind 를 「지역」이 아니라 「경쟁 / 브랜드 / 색인」으로 가른다.
 * 앞선 판은 다섯 중 셋이 학원 이름이 들어간 검색이었고, 그걸 「지역」으로
 * 묶어 놨다. 「석촌동 로봇 코딩학원」에서 1위인 건 이겨서 얻은 자리가 아니다 —
 * 이름이 로봇&코딩이고 석촌동에 있으니 나오는 게 당연하다.
 * 그런 걸 성과로 세면 좋아 보이는 숫자를 만드는 것이다.
 *
 * 경쟁   학원 이름 없이 「지역 + 업종」. 학부모가 실제로 치는 말. 이것만이 성과다
 * 브랜드 이름이 들어감. 이겼는지 못 이겼는지가 아니라 「방어되고 있는지」를 본다
 * 색인   site: 검색. 올라갔는지 보는 것이지 순위가 아니다
 */
const QUERIES = [
  { id: "idx", q: `site:${DOMAIN}`, kind: "색인" },

  // ── 경쟁: 이름 없이 찾는 사람. 늘려 두었다. 이겨야 하는 자리다
  { id: "c1", q: "송파구 코딩학원", kind: "경쟁" },
  { id: "c2", q: "송파 초등 코딩학원 추천", kind: "경쟁" },
  { id: "c3", q: "송파구 석촌동 코딩학원", kind: "경쟁" },
  { id: "c4", q: "잠실 초등 코딩학원", kind: "경쟁" },
  { id: "c5", q: "송파구 로봇교실", kind: "경쟁" },
  { id: "c6", q: "헬리오시티 코딩학원", kind: "경쟁" },

  // ── 브랜드: 남에게 자리를 뺏기고 있지 않은지 본다.
  //    AI 답변에서 「똑똑한 로봇&코딩학원」(glcedu.co.kr) 이 우리 자리를 가져간 적이 있다
  { id: "b1", q: "로봇앤코딩학원 석촌동", kind: "브랜드" },
  { id: "b2", q: "석촌동 로봇 코딩학원", kind: "브랜드" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grab(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9" } });
    if (!r.ok) return { err: `HTTP ${r.status}` };
    return { html: await r.text() };
  } catch (e) {
    return { err: e.message };
  }
}

/**
 * Bing 결과에서 우리 도메인이 나오는지 본다.
 *
 * 주의: Bing 은 색인이 없어도 "약 86개의 결과"라며 무관한 페이지를 채워 넣는다.
 * 그래서 결과 수를 세면 안 되고, 실제 링크가 우리 도메인인지를 봐야 한다.
 * 결과 링크는 /ck/a?u=<base64> 로 감싸여 있으므로 표시용 주소(cite)를 읽는다.
 */
async function bing(q) {
  const { html, err } = await grab(
    "https://www.bing.com/search?q=" + encodeURIComponent(q) + "&setlang=ko&cc=KR",
  );
  if (err) return { ok: false, hit: false, rank: null, note: err };

  const links = html
    .split('class="b_algo"')
    .slice(1)
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
    note: links.length === 0 ? "결과 파싱 0건" : "",
  };
}

/**
 * 네이버 웹 탭.
 *
 * 두 군데서 잘못 셀 수 있다.
 *  - 도메인 글자는 검색어를 되돌려주는 자리에도 박혀 있다. 글자를 세면 안 된다.
 *  - 페이지 맨 위 다섯 개 링크는 네이버 자기 메뉴(쇼핑·사전·지도…)다.
 *    전체 <a> 를 세면 1위가 6위로 나온다.
 * 그래서 웹문서 결과 블록만 잘라서 그 안에서만 찾는다.
 */
const NAVER_RESULT = "fds-web-normal-doc-root";

async function naver(q) {
  const { html, err } = await grab(
    "https://search.naver.com/search.naver?where=web&query=" + encodeURIComponent(q),
  );
  if (err) return { ok: false, hit: false, rank: null, note: err };

  const blocks = html.split(NAVER_RESULT).slice(1);
  const idx = blocks.findIndex((b) => b.slice(0, 4000).includes(DOMAIN));
  return {
    ok: true,
    hit: idx >= 0,
    rank: idx >= 0 ? idx + 1 : null,
    note: blocks.length === 0 ? "결과 파싱 0건" : "",
  };
}

const ENGINES = [
  { id: "bing", name: "Bing", run: bing },
  { id: "naver", name: "네이버", run: naver },
];

const rows = [];
for (const e of ENGINES) {
  console.log(`\n  [${e.name}]`);
  for (const [i, { id, q, kind }] of QUERIES.entries()) {
    if (i) await sleep(2600); // 연달아 때리면 막힌다
    const r = await e.run(q);
    rows.push({ engine: e.id, id, q, kind, ...r });
    const mark = !r.ok ? "?" : r.hit ? `노출 ${r.rank}위` : "미노출";
    console.log(`    ${kind.padEnd(5)} ${q.slice(0, 24).padEnd(26)} ${mark}${r.note ? "  (" + r.note + ")" : ""}`);
  }
}

console.log();
for (const e of ENGINES) {
  const mine = rows.filter((r) => r.engine === e.id);
  const indexed = mine.find((r) => r.id === "idx")?.hit ?? false;
  const exposed = mine.filter((r) => r.kind !== "색인" && r.hit).length;
  console.log(`  ${e.name.padEnd(6)} 색인 ${indexed ? "됨" : "아직"} · 질의 노출 ${exposed}/${QUERIES.length - 1}`);
}
console.log("  구글    Search Console URL 검사로 확인 (tools/submit-gsc.mjs)");

/**
 * 레퍼런스로 내놓을 수 있는가.
 *
 * 앞선 판은 「색인 아닌 것 중 하나라도 걸리면 통과」였다. 그러면 브랜드 검색
 * 하나로 통과가 된다 — 「석촌동 로봇 코딩학원」 1위로 「쓸 수 있음」이 떴다.
 * 학원 이름이 로봇&코딩이고 석촌동에 있으니 나오는 게 당연한 검색이다.
 * 이겨서 얻은 자리가 아니면 영업 자료가 못 된다.
 */
const rival = rows.filter((r) => r.kind === "경쟁");
const rivalHit = rival.filter((r) => r.hit);
const brand = rows.filter((r) => r.kind === "브랜드");
const brandMiss = brand.filter((r) => !r.hit);

console.log(`\n  경쟁 검색어  ${rivalHit.length}/${rival.length}   ← 이겨서 얻는 자리`);
for (const h of rivalHit) console.log(`    ★ [${h.engine}] ${h.rank}위 — ${h.q}`);

if (brandMiss.length) {
  const names = [...new Set(brandMiss.map((r) => `${r.q}(${r.engine})`))];
  console.log(`  브랜드 방어  ${brand.length - brandMiss.length}/${brand.length}`);
  console.log(`    ⚠ 우리 이름인데 안 나옴 — ${names.join(" · ")}`);
}

console.log(
  `\n  레퍼런스: ${rivalHit.length ? "쓸 수 있음" : "아직 아님 — 경쟁 검색어에서 한 번도 안 나왔습니다"}`,
);

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

// 엔진을 나누기 전 기록은 전부 Bing 이었다.
await pool.query(`alter table academy.serp_checks add column if not exists engine text not null default 'bing'`);
await pool.query(`alter table academy.serp_checks drop constraint if exists serp_checks_pkey`);
await pool.query(`
  create unique index if not exists serp_checks_key
    on academy.serp_checks (day, engine, query_id)`);

for (const r of rows) {
  if (!r.ok) continue;
  await pool.query(
    `insert into academy.serp_checks (day, engine, query_id, query, kind, hit, rank)
     values (current_date, $1, $2, $3, $4, $5, $6)
     on conflict (day, engine, query_id) do update set
       hit = excluded.hit, rank = excluded.rank, checked_at = now()`,
    [r.engine, r.id, r.q, r.kind, r.hit, r.rank],
  );
}

// 언제 처음 나왔는지 — 영업에서 쓸 날짜
const { rows: first } = await pool.query(
  `select engine, query_id, query, min(day) d from academy.serp_checks
    where hit group by engine, query_id, query order by min(day)`,
);
if (first.length) {
  console.log("\n  처음 노출된 날");
  first.forEach((f) =>
    console.log(`    ${new Date(f.d).toLocaleDateString("ko-KR")}  [${f.engine}] ${f.query}`));
}

await pool.end();
