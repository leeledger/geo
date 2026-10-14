/**
 * 빙 노출 측정 — 진짜 브라우저로 검색해 우리 도메인이 몇 위에 나오는지 본다.
 *
 * 2026-10-12: academy/scripts/check-index.mjs 가 fetch 로 빙을 긁어 왔는데, 빙은 브라우저가 아닌 요청에
 * 엉뚱한 결과를 채워 준다(「site:naver.com」에 유튜브, 「site:docttak.com」에 한컴). 그래서 학원 빙은 시작부터 늘 「미노출」로 찍혔다.
 * 같은 날 빙 웹마스터는 27쪽 색인, 진짜 브라우저 검색은 브랜드 1위·「송파구 코딩학원」 2위였다.
 * 그래서 빙만 PC 의 로그인 프로필(tools/.browser-profile)로 잰다. local-agent.mjs 가 하루 한 번 돌린다.
 *
 * 대조 검색: 「네이버」를 쳐서 naver.com 이 위 5개 안에 없으면 빙이 가짜 결과를 주는 것으로 본다(못 잼).
 * 고객마다 앞뒤로 대조해 둘 다 통과한 고객만 저장한다 — 도중에 빙이 바뀌면 그 고객 것은 버린다.
 * 미노출과 못 잼을 섞지 않는다 — 그게 이번 고장의 원인이었다.
 *
 *   node tools/bing-serp.mjs                  전 고객사
 *   node tools/bing-serp.mjs --client docttak 한 곳만
 *   node tools/bing-serp.mjs --dry            저장하지 않고 보기만
 */
import { chromium } from "playwright";
import { 가볍게 } from "./lean-browser.mjs";
import { fileURLToPath } from "node:url";
import { 고객고르기, 잠깐DB } from "../academy/clients.mjs";

const DRY = process.argv.includes("--dry");
const PROFILE = fileURLToPath(new URL("./.browser-profile", import.meta.url)); // 어디서 실행해도 같은 프로필
const say = (s) => console.log(`  ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 표시 주소의 호스트가 도메인이거나 그 하위 도메인일 때만. 「mydocttak.com」이나 경로에 도메인이 든 주소는 아니다 */
export const 내주소 = (cite, domain) => {
  const host = cite.replace(/^https?:\/\//, "").split(/[›/\s?#]/)[0].replace(/^www\./, "").toLowerCase();
  const d = domain.toLowerCase().replace(/^www\./, "");
  return host === d || host.endsWith(`.${d}`);
};

const 고객들 = (await 잠깐DB((q) => 고객고르기(process.argv, q))).filter((c) => c.domain && c.queries?.length);
if (!고객들.length) { say("잴 고객 없음"); process.exit(0); }

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false, viewport: { width: 1360, height: 900 }, locale: "ko-KR",
  args: ["--disable-blink-features=AutomationControlled"],
});
await 가볍게(ctx);
const page = ctx.pages()[0] ?? (await ctx.newPage());

/** 결과 목록의 표시 주소(cite)를 차례대로. 광고·뉴스 묶음은 b_algo 가 아니라 빠진다 */
async function 검색(q) {
  await page.goto("https://www.bing.com/search?q=" + encodeURIComponent(q) + "&setlang=ko&cc=KR", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("li.b_algo", { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  return page.$$eval("li.b_algo cite", (els) => els.map((e) => e.textContent.replace(/\s+/g, "")));
}
const 대조 = async () => (await 검색("네이버")).slice(0, 5).some((u) => 내주소(u, "naver.com"));

async function 저장(rows) {
  return 잠깐DB(async (q) => {
    if (!q) throw new Error("DB 를 못 열어 저장 못 함");
    for (const r of rows) {
      await q(
        `insert into academy.serp_checks (client_id, day, engine, query_id, query, kind, hit, rank)
         values ($1, (now() at time zone 'Asia/Seoul')::date, 'bing', $2, $3, $4, $5, $6)
         on conflict (client_id, day, engine, query_id) do update set
           query = excluded.query, kind = excluded.kind, hit = excluded.hit, rank = excluded.rank, checked_at = now()`,
        [r.client, r.id, r.q, r.kind, r.hit, r.rank],
      );
    }
    return rows.length;
  });
}

let 실패 = 0, 저장수 = 0, 노출 = 0;
try {
  for (const c of 고객들) {
    console.log(`\n══ ${c.name} · ${c.domain} ══`);
    if (!(await 대조())) { say("대조 검색 실패(앞) — 빙이 가짜 결과를 줌. 이 고객은 못 잼"); 실패++; continue; }
    const rows = [];
    for (const { id, q, kind } of c.queries) {
      await sleep(2500); // 연달아 치면 막힌다
      const cites = await 검색(q);
      if (!cites.length) { say(`${kind.padEnd(4)} ${q} — 결과 0, 못 잼`); continue; }
      const i = cites.findIndex((u) => 내주소(u, c.domain));
      rows.push({ client: c.id, id, q, kind, hit: i >= 0, rank: i >= 0 ? i + 1 : null });
      say(`${kind.padEnd(4)} ${q.slice(0, 26).padEnd(28)} ${i >= 0 ? `${i + 1}위` : "미노출"}`);
    }
    await sleep(2500);
    if (!(await 대조())) { say("대조 검색 실패(뒤) — 도중에 빙이 바뀌었을 수 있어 이 고객 것은 버림"); 실패++; continue; }
    // 고객마다 바로 저장 — 시간 한도에 걸려 끊겨도 앞 고객 것은 남는다
    if (!DRY && rows.length) { 저장수 += await 저장(rows); 노출 += rows.filter((r) => r.hit).length; }
  }
} finally {
  await ctx.close();
}
say(`\n${DRY ? "보기만 함" : `저장 ${저장수}줄 · 빙 노출 ${노출}`}${실패 ? ` · 못 잰 고객 ${실패}곳` : ""}`);
if (실패) process.exitCode = 1;
