/**
 * 네이버 서치어드바이저 — 수집 요청 · 사이트맵 · RSS 제출.
 *
 * 네이버 로그인 쿠키(NID_AUT·NID_SES)는 '로그인 상태 유지'를 켜지 않으면
 * 세션 쿠키라 창을 닫는 순간 사라진다. 두 번 그렇게 날렸다.
 * 그래서 세션을 저장했다 다시 여는 대신, 로그인한 그 창에서 바로 일한다.
 *
 * 경로도 두 번 헛짚었다. 맞는 주소는 /console/site/request/… 다.
 * (/console/request/… 는 "This page could not be found" 가 나온다)
 * 메뉴를 펼쳐 href 를 직접 읽어서 알아냈다 — 주소를 추측하면 계속 빗나간다.
 *
 *   node naver-live.mjs
 *   node naver-live.mjs --all     사이트맵 앞 10개
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");
const SITE = "https://robotncoding.com";
const ALL = process.argv.includes("--all");

/** 네이버에 등록된 사이트 키. 지금은 http 로 등록돼 있다. */
const REG = process.env.NAVER_SITE || "https://robotncoding.com";
const q = (p) => `https://searchadvisor.naver.com/console/site/${p}?site=${encodeURIComponent(REG)}`;

async function targets() {
  if (!ALL) return ["/", "/blog"];
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(SITE, "") || "/")
    .slice(0, 10);
}

const paths = await targets();

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("dialog", async (d) => { console.log("  · " + d.message().slice(0, 60)); await d.accept().catch(() => {}); });

await page.goto(q("summary"), { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(4000);

if (/nid\.naver\.com/.test(page.url())) {
  console.log(`
네이버 로그인 화면입니다. 로그인해 주세요.
('로그인 상태 유지'를 켜면 다음부터 이 단계를 건너뜁니다)
창은 닫지 않습니다 — 닫으면 세션이 사라집니다.
`);
  const start = Date.now();
  while (Date.now() - start < 10 * 60 * 1000 && /nid\.naver\.com/.test(page.url())) {
    await page.waitForTimeout(2500);
  }
  if (/nid\.naver\.com/.test(page.url())) {
    console.log("10분 안에 로그인이 확인되지 않았습니다.");
    await ctx.close();
    process.exit(1);
  }
  console.log("✓ 로그인 확인\n");
  await page.waitForTimeout(3000);
}

/** SPA 라 렌더가 늦다. 입력창이 보일 때까지 기다린다. */
async function box(timeout = 20000) {
  const cands = [
    page.locator('input[placeholder*="URL"]'),
    page.locator('input[name*="url" i]'),
    page.locator('input[type="text"]:visible'),
  ];
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    for (const c of cands) {
      const el = c.first();
      if (await el.isVisible().catch(() => false)) return el;
    }
    await page.waitForTimeout(800);
  }
  return null;
}

// ── 1) 웹 페이지 수집 요청
console.log("웹 페이지 수집 요청");
await page.goto(q("request/crawl"), { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);

let done = 0;
for (const [i, p] of paths.entries()) {
  const el = await box();
  if (!el) {
    console.log("  ✗ 입력창을 못 찾았습니다");
    break;
  }
  try {
    await el.click();
    await el.fill("");
    await el.fill(p);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /확인|요청|제출/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(3500);
    const body = await page.locator("body").innerText().catch(() => "");
    if (/초과|하루 최대|한도/.test(body)) {
      console.log("  ! 하루 한도 — 여기까지");
      break;
    }
    console.log(`  ✓ ${p}`);
    done++;
  } catch (e) {
    console.log(`  ✗ ${p} — ${e.message.split("\n")[0].slice(0, 70)}`);
    break;
  }
  if (i < paths.length - 1) await page.waitForTimeout(2500);
}

// ── 2) 사이트맵 · RSS 제출 (한 번만 하면 되지만 다시 넣어도 무해하다)
for (const [name, page_, file] of [
  ["사이트맵", "request/sitemap", "sitemap.xml"],
  ["RSS", "request/rss", "rss.xml"],
]) {
  console.log(`\n${name} 제출`);
  await page.goto(q(page_), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const el = await box();
  if (!el) { console.log("  ✗ 입력창 없음"); continue; }
  try {
    await el.click();
    await el.fill(file);
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /확인|요청|제출/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(4000);
    console.log(`  ✓ ${file}`);
  } catch (e) {
    console.log(`  ✗ ${e.message.split("\n")[0].slice(0, 70)}`);
  }
}

console.log(`\n수집 요청 ${done}/${paths.length}건. 창을 40초 열어 둡니다.`);
await page.waitForTimeout(40000);
await ctx.close();
