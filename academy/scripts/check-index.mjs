/**
 * 노출 측정 — 고객사마다 검색어를 넣어 우리 도메인이 나오는지 본다.
 *
 * 크롤러 방문은 서버가 기록하지만, 검색에 나오는지는 밖에서 검색해 봐야 안다.
 * 「언제부터 나왔는지」를 기억으로 말하면 영업에서 못 쓴다.
 *
 * 09.11 전까지는 도메인과 검색어가 로봇&코딩학원으로 박혀 있었다.
 * 아이로그를 받고 하루가 넘도록 아이로그는 한 번도 안 쟀다.
 * 이제 고객사 목록(../clients.mjs)을 돈다.
 *
 *   node scripts/check-index.mjs                 전 고객사
 *   node scripts/check-index.mjs --client ilog   한 곳만
 *   node scripts/check-index.mjs --dry           저장하지 않고 보기만
 */
import fs from "node:fs";
import { Pool } from "pg";
import { selectClients } from "../clients.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DRY = process.argv.includes("--dry");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

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
async function bing(q, c) {
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

  const idx = links.findIndex((u) => u.includes(c.domain));
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

async function naver(q, c) {
  const { html, err } = await grab(
    "https://search.naver.com/search.naver?where=web&query=" + encodeURIComponent(q),
  );
  if (err) return { ok: false, hit: false, rank: null, note: err };

  const blocks = html.split(NAVER_RESULT).slice(1);
  const idx = blocks.findIndex((b) => b.slice(0, 4000).includes(c.domain));
  return {
    ok: true,
    hit: idx >= 0,
    rank: idx >= 0 ? idx + 1 : null,
    note: blocks.length === 0 ? "결과 파싱 0건" : "",
  };
}

/**
 * 네이버 통합검색 — 사람이 실제로 보는 화면.
 *
 * 이걸 안 재고 웹문서 탭만 쟀다가 「경쟁 검색어 0/6」이라고 적어 놨는데,
 * 실제로 「송파구 코딩학원」을 치면 플레이스 블록에 2번째로 나오고 있었다.
 * 사람이 안 보는 탭을 재고 「안 나온다」고 한 것이다.
 *
 * 통합검색은 플레이스·블로그·웹문서·카페를 한 화면에 섞어 준다.
 * 어느 블록이든 첫 화면에 있으면 「나온 것」이다. 순위는 안 센다 —
 * 블록마다 기준이 달라서 한 숫자로 뭉치면 거짓말이 된다.
 *
 * 무엇으로 찾을지는 고객사마다 다르다(clients.mjs 의 brandRe).
 * 검색어를 되돌려 보여주는 자리에도 글자가 박히므로, 검색어 자체에 들어 있는
 * 말로 찾으면 무조건 걸린다 — 아이로그는 그래서 도메인으로만 찾는다.
 */
async function naverAll(q, c) {
  const { html, err } = await grab(
    "https://search.naver.com/search.naver?where=nexearch&sm=tab_hty.top&query=" + encodeURIComponent(q),
  );
  if (err) return { ok: false, hit: false, rank: null, note: err };
  const hit = c.brandRe.test(html);
  // 어느 블록에서 잡혔는지 적어 두면 나중에 무엇이 일했는지 안다
  let where = "";
  if (hit) {
    const i = html.search(c.brandRe);
    const before = html.slice(Math.max(0, i - 4000), i);
    where = /place|플레이스|api\/siteinfo/i.test(before) ? "플레이스"
      : /blog/i.test(before) ? "블로그"
      : /cafe/i.test(before) ? "카페"
      : "웹문서";
  }
  return { ok: true, hit, rank: null, note: where };
}

const ENGINES = [
  { id: "bing", name: "Bing", run: bing },
  { id: "naver", name: "네이버 웹문서", run: naver },
  { id: "naver_all", name: "네이버 통합검색", run: naverAll },
];

const clients = selectClients();
const rows = [];

for (const c of clients) {
  console.log(`\n══ ${c.name} · ${c.domain} ══`);
  const mine = [];
  for (const e of ENGINES) {
    console.log(`\n  [${e.name}]`);
    for (const [i, { id, q, kind }] of c.queries.entries()) {
      if (i) await sleep(2600); // 연달아 때리면 막힌다
      const r = await e.run(q, c);
      mine.push({ client: c.id, engine: e.id, id, q, kind, ...r });
      const mark = !r.ok ? "?" : r.hit ? (r.rank ? `노출 ${r.rank}위` : "노출") : "미노출";
      console.log(`    ${kind.padEnd(5)} ${q.slice(0, 24).padEnd(26)} ${mark}${r.note ? "  (" + r.note + ")" : ""}`);
    }
    await sleep(2600);
  }

  console.log();
  for (const e of ENGINES) {
    const m = mine.filter((r) => r.engine === e.id);
    const indexed = m.find((r) => r.kind === "색인")?.hit ?? false;
    const exposed = m.filter((r) => r.kind !== "색인" && r.hit).length;
    console.log(`  ${e.name.padEnd(8)} 색인 ${indexed ? "됨" : "아직"} · 질의 노출 ${exposed}/${m.filter((r) => r.kind !== "색인").length}`);
  }

  /**
   * 레퍼런스로 내놓을 수 있는가.
   * 브랜드 검색 하나로 통과시키면 안 된다 — 이겨서 얻은 자리가 아니면 영업 자료가 못 된다.
   */
  // 질의 단위로 센다 — 엔진별 줄을 세면 분모가 18 같은 이상한 수가 된다(대시보드·브리핑과 같게).
  // 한 질의는 어느 엔진에서든 한 번 걸리면 나온 것으로 본다.
  const tally = (kind) => {
    const m = new Map();
    for (const r of mine.filter((x) => x.kind === kind && x.ok)) m.set(r.q, (m.get(r.q) ?? false) || r.hit);
    return { won: [...m.values()].filter(Boolean).length, total: m.size };
  };
  const rt = tally("경쟁"), bt = tally("브랜드");
  const rivalHit = mine.filter((r) => r.kind === "경쟁" && r.hit);
  const brand = mine.filter((r) => r.kind === "브랜드");
  const brandMiss = brand.filter((r) => r.ok && !r.hit);

  console.log(`\n  경쟁 검색어  ${rt.won}/${rt.total}   ← 이겨서 얻는 자리`);
  for (const h of rivalHit) console.log(`    ★ [${h.engine}] ${h.rank ? h.rank + "위" : "노출"} — ${h.q}`);
  if (brand.length) {
    console.log(`  브랜드 방어  ${bt.won}/${bt.total}`);
    if (brandMiss.length) {
      const names = [...new Set(brandMiss.map((r) => `${r.q}(${r.engine})`))];
      console.log(`    ⚠ 우리 이름인데 안 나옴 — ${names.join(" · ")}`);
    }
  }
  rows.push(...mine);
}
console.log("\n  구글은 결과 페이지를 긁으면 막힌다. Search Console URL 검사로 확인 (tools/submit-gsc.mjs)");

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
await pool.query(`alter table academy.serp_checks add column if not exists client_id int not null default 1`);
await pool.query(`alter table academy.serp_checks drop constraint if exists serp_checks_pkey`);

// 고객사가 빠진 옛 인덱스는 걷어낸다. 남겨 두면 두 고객사가 같은 날 같은
// 검색어를 잴 때 뒤에 잰 쪽이 앞 결과를 덮어쓴다.
await pool.query(`drop index if exists academy.serp_checks_key`);
await pool.query(`
  create unique index if not exists serp_checks_client_key
    on academy.serp_checks (client_id, day, engine, query_id)`);

let saved = 0;
for (const r of rows) {
  if (!r.ok) continue;
  await pool.query(
    `insert into academy.serp_checks (client_id, day, engine, query_id, query, kind, hit, rank)
     values ($1, current_date, $2, $3, $4, $5, $6, $7)
     on conflict (client_id, day, engine, query_id) do update set
       query = excluded.query, kind = excluded.kind,
       hit = excluded.hit, rank = excluded.rank, checked_at = now()`,
    [r.client, r.engine, r.id, r.q, r.kind, r.hit, r.rank],
  );
  saved++;
}
console.log(`\n  저장 ${saved}줄`);

// 언제 처음 나왔는지 — 영업에서 쓸 날짜
for (const c of clients) {
  const { rows: first } = await pool.query(
    `select engine, query, min(day) d from academy.serp_checks
      where client_id = $1 and hit group by engine, query order by min(day)`, [c.id]);
  if (first.length) {
    console.log(`\n  ${c.name} · 처음 노출된 날`);
    first.forEach((f) =>
      console.log(`    ${new Date(f.d).toLocaleDateString("ko-KR")}  [${f.engine}] ${f.query}`));
  }
}

await pool.end();
