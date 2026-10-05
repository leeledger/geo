/**
 * 빙 웹마스터 — 주소를 직접 제출한다(URL Submission).
 *
 * 2026-09-22: 사이트맵은 「Success」(45쪽 발견)인데 Bingbot 이 읽은 건 47쪽 중 5쪽(10.6%).
 * ChatGPT 검색·Copilot 은 빙 색인에 기댄다 — OpenAI 커버리지 34% 도 여기서 막힌다(메모리 openai-crawl-needs-bing).
 * IndexNow 는 「알림」이고, 제출 화면은 하루 한도 안에서 「이 주소를 읽어라」다.
 *
 * 화면을 먼저 읽고 누른다. 셀렉터를 추측하면 헛클릭이 조용히 성공처럼 보인다.
 *
 *   node bing-submit-urls.mjs --look        화면만 읽고 찍는다
 *   node bing-submit-urls.mjs               사이트맵 주소 중 아직 안 낸 것을 한도 안에서 낸다
 *   node bing-submit-urls.mjs --client docttak   다른 고객사 (인자 없으면 학원)
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { bingClient } from "./bing-site.mjs";

const CLIENT = bingClient();
const SITE = `https://${CLIENT.domain}/`;
const LOOK = process.argv.includes("--look");
const DONE = path.join(process.cwd(), "bing-done.json");
const say = (s) => console.log(`  ${s}`);

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1360, height: 900 }, locale: "ko-KR",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(`https://www.bing.com/webmasters/submiturl?siteUrl=${encodeURIComponent(SITE)}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);
say(`${CLIENT.name} · 주소 ${page.url()}`);
if (/login|signin/i.test(page.url())) { say("로그인이 풀렸습니다 — node open-session.mjs 로 로그인"); await ctx.close(); process.exit(1); }

const 글 = (await page.evaluate(() => document.body.innerText)).replace(/\n{2,}/g, "\n");
// 화면 모양(2026-09-22 확인): 「Quota left for today (URL Submission Only)」 다음 줄에 숫자
const 한도 = /Quota left for today[^\n]*\n\s*(\d[\d,]*)/i.exec(글)?.[1];
say(`남은 한도: ${한도 ?? "화면에서 못 읽음"}`);

if (LOOK) {
  for (const l of 글.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 60)) say(`· ${l.slice(0, 120)}`);
  const 요소 = await page.evaluate(() => [...document.querySelectorAll("textarea,input,button")]
    .filter((e) => e.offsetParent).map((e) => `${e.tagName} ${e.type ?? ""} ${e.getAttribute("aria-label") ?? ""} ${e.placeholder ?? ""} ${(e.innerText ?? "").slice(0, 30)}`));
  say(`요소: ${JSON.stringify(요소).slice(0, 1500)}`);
  await page.screenshot({ path: path.join(process.cwd(), "bing-submit-look.png"), fullPage: true });
  await ctx.close();
  process.exit(0);
}

const xml = await (await fetch(`${SITE}sitemap.xml`)).text();
const 전체 = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
const 낸것 = new Set(fs.existsSync(DONE) ? JSON.parse(fs.readFileSync(DONE, "utf8")) : []);
const 남은것 = 전체.filter((u) => !낸것.has(u));
const 이번 = 남은것.slice(0, Math.max(0, Math.min(Number(String(한도 ?? "10").replace(/,/g, "")) || 10, 남은것.length)));
say(`사이트맵 ${전체.length}개 · 이미 냄 ${낸것.size} · 이번 ${이번.length}`);
if (!이번.length) { await ctx.close(); process.exit(0); }

// 「Submit URLs」 버튼을 눌러야 입력 창이 열린다 (--look 으로 확인: 처음엔 textarea 가 없다)
await page.getByRole("button", { name: "Submit URLs" }).first().click({ timeout: 8000 });
await page.waitForTimeout(2500);
const 칸 = page.locator("textarea").first();
if (!(await 칸.count())) { say("✗ 입력 칸을 못 찾았습니다 — --look 으로 화면을 다시 보세요"); await ctx.close(); process.exit(1); }
await 칸.click();
await 칸.fill(이번.join("\n"));
await page.waitForTimeout(800);
// 창 안의 제출 버튼은 「Submit」 — 바깥의 「Submit URLs」 와 헷갈리지 않게 마지막 것을 누른다
const 버튼들 = await page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.offsetParent).map((b) => (b.innerText || b.getAttribute("aria-label") || "").trim()));
say(`창 버튼: ${JSON.stringify(버튼들.slice(-8))}`);
await page.getByRole("button", { name: /^Submit$/ }).last().click({ timeout: 8000 });
await page.waitForTimeout(6000);
const 뒤 = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
const 됨 = /success|submitted|성공|제출되었/i.test(뒤) && !/error|failed|exceeded|오류|초과/i.test(뒤.slice(0, 2000));
say(됨 ? `✓ ${이번.length}개 제출` : `✗ 제출 확인이 안 됩니다 · ${뒤.slice(0, 200)}`);
await page.screenshot({ path: path.join(process.cwd(), "bing-submit-after.png"), fullPage: true });
if (됨) fs.writeFileSync(DONE, JSON.stringify([...낸것, ...이번], null, 2));
await ctx.close();
if (!됨) process.exitCode = 1;
