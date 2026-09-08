/**
 * 네이버 플레이스 순위 확인.
 *
 * 지역 검색어("송파구 코딩학원")는 웹문서보다 플레이스가 위에 뜬다.
 * 홈페이지를 아무리 손봐도 플레이스가 없으면 지역 검색에서는 안 보이고,
 * 반대로 플레이스만 보고 "노출 안 됨"이라 적으면 실제보다 나쁘게 적게 된다.
 * 웹문서 추적(check-index.mjs)과 따로 재야 하는 이유다.
 *
 * 지도 API 를 직접 부르면 ncaptcha-all-search-no-result 가 돌아온다.
 * 결과가 0건인 게 아니라 막힌 것인데, 그대로 믿으면 "등록 안 됨"으로 잘못 읽는다.
 * 그래서 실제 브라우저로 화면을 읽는다.
 *
 *   node naver-place-check.mjs
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { Pool } from "pg";

const DRY = process.argv.includes("--dry");

for (const l of fs.readFileSync(new URL("../academy/.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

/**
 * 우리 업체인지 판정.
 *
 * 처음엔 /로봇\s*앤?\s*코딩/ 로 썼다가 「CiC 로봇코딩학원 위례캠퍼스」를
 * 우리로 셌다. 앤 을 선택으로 두면 남의 학원이 걸린다.
 * 「마이로봇앤코딩」 같은 것도 있어서 앞에서부터 맞아야 한다.
 */
const MINE = (s) => /^로봇\s*(앤|&)\s*코딩/.test(s.trim());
const QUERIES = ["로봇앤코딩학원", "석촌동 코딩학원", "송파구 코딩학원", "송파 초등 코딩학원"];

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const found = [];

for (const q of QUERIES) {
  await page.goto("https://map.naver.com/p/search/" + encodeURIComponent(q), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(7000);

  // 결과 목록은 iframe(#searchIframe) 안에 그려진다
  const frame = page.frameLocator("#searchIframe");
  const items = await frame.locator("li").all().catch(() => []);

  /** 업체 한 줄 = 상호 + 업종. 광고·구분선 li 는 상호가 안 잡힌다. */
  const names = [];
  for (const li of items.slice(0, 40)) {
    const t = (await li.innerText().catch(() => "")).split("\n")[0]?.trim();
    if (t && t.length > 1 && t.length < 40 && !names.includes(t)) names.push(t);
  }

  const rank = names.findIndex(MINE);
  found.push({ q, rank: rank >= 0 ? rank + 1 : null, top: names.slice(0, 4) });
  console.log(`\n"${q}"`);
  console.log(rank >= 0 ? `  ✓ ${rank + 1}위 — ${names[rank]}` : "  ✗ 목록에 없음");
  console.log("  상위: " + names.slice(0, 4).join(" / "));
  await page.waitForTimeout(1500);
}

// ── 플레이스에 홈페이지가 연결돼 있는가
// 연결돼 있으면 네이버 안에서 사이트로 들어오는 길이 생기고,
// 검색엔진에는 제3자 지면에서 걸린 링크가 된다.
await page.goto("https://map.naver.com/p/search/" + encodeURIComponent("로봇앤코딩학원"), {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(7000);
await page.frameLocator("#searchIframe").locator("li").first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(9000);

// 상세는 #entryIframe 에 그려지는데 늦게 붙는다. 프레임 목록에서 직접 찾는다.
let detail = "";
for (let i = 0; i < 6 && !detail; i++) {
  for (const f of page.frames()) {
    if (!/place|entry|restaurant/i.test(f.url())) continue;
    const t = await f.locator("body").innerText().catch(() => "");
    if (t && t.length > 60) { detail = t; break; }
  }
  if (!detail) await page.waitForTimeout(2500);
}
console.log("\n── 플레이스 상세 ──");
if (!detail) {
  console.log("  상세를 못 읽었습니다");
} else if (detail.includes("robotncoding.com")) {
  console.log("  홈페이지 연결: ✓ robotncoding.com");
} else if (!/홈페이지|http/i.test(detail)) {
  // 읽힌 게 요약 패널(주소·영업시간)뿐이면 링크가 없다고 말할 수 없다.
  // 이 자리에서 "없음"이라고 적었다가 이미 연결해 둔 것을 못 봤다.
  console.log("  홈페이지 연결: 확인 못함 — 요약만 읽혔습니다 (정보 탭을 봐야 합니다)");
} else {
  console.log("  홈페이지 연결: ✗ 없음 — 연결하면 유입 경로가 생깁니다");
}
if (detail) {
  const bits = detail.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 14);
  console.log("  " + bits.join(" · ").slice(0, 300));
}

await page.waitForTimeout(2000);
await ctx.close();

if (DRY) process.exit(0);

// ── 기록. 순위는 오르내리므로 날짜별로 남겨야 추세를 볼 수 있다.
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});
await pool.query(`
  create table if not exists academy.place_checks (
    day    date not null,
    query  text not null,
    rank   int,
    top    text,
    checked_at timestamptz not null default now(),
    primary key (day, query)
  )`);
for (const f of found) {
  await pool.query(
    `insert into academy.place_checks (day, query, rank, top)
     values (current_date, $1, $2, $3)
     on conflict (day, query) do update set
       rank = excluded.rank, top = excluded.top, checked_at = now()`,
    [f.q, f.rank, f.top.join(" / ")],
  );
}
const { rows } = await pool.query(
  `select query, min(day) d, min(rank) best from academy.place_checks
    where rank is not null group by query order by min(rank)`,
);
if (rows.length) {
  console.log("\n  플레이스 최고 순위");
  rows.forEach((r) =>
    console.log(`    ${String(r.best).padStart(2)}위  ${r.query}  (첫 기록 ${new Date(r.d).toLocaleDateString("ko-KR")})`));
}
await pool.end();
