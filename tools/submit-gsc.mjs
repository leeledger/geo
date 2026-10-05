/**
 * Google Search Console — URL 검사 후 색인 생성 요청.
 *
 * 구글은 IndexNow 에 참여하지 않고, 공식 Indexing API 는 채용공고·방송일정에만
 * 쓸 수 있다(다른 용도로 쓰면 정책 위반이다). 그래서 콘솔 화면을 거쳐야 한다.
 *
 * 딥링크(/search-console/inspect?resource_id=…&id=…)는 404 가 났다.
 * 그래서 사람과 같은 경로로 간다 — 상단 검사창에 주소를 넣고 Enter.
 *
 * 주의:
 *  - 하루 요청 한도가 있다(대략 10건대). 넘기면 버튼이 막힌다.
 *  - 요청마다 쉰다. 자기 소유 사이트의 주소 몇 개를 넣는 용도로만 쓴다.
 *
 *   node submit-gsc.mjs
 *   node submit-gsc.mjs --all     사이트맵에서 앞 6개
 *   node submit-gsc.mjs --all --client ilog   다른 고객사 (기본은 학원)
 *
 * 속성은 도메인 속성(sc-domain:)이다. 고객사 덩어리에 gscProperty 가 있으면 그걸 쓴다.
 * 코드 덩어리가 없는 고객(geo.clients 에만 있는 고객)은 loadClients 가 고객설정 으로 도메인을 준다(Step 37 — 옛 D19 대체를 흡수).
 * 고객 Search Console 에 이 프로필 계정 권한이 없으면 검사창이 안 뜬다 — 권한은 사람이 받는다.
 */
import { chromium } from "playwright";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { loadClients, 고객고르기, 잠깐DB } from "../academy/clients.mjs";

const PROFILE = path.join(process.cwd(), ".browser-profile");

// 한 번에 한 속성만 돈다. 지정이 없으면 학원(목록 첫째) — 예전 동작 그대로. 지정하면 코드 3곳 + DB 고객에서 찾는다
const CLIENT = await 잠깐DB(async (q) => {
  if (!process.argv.includes("--client") && !process.env.CLIENT_ID) return (await loadClients(q))[0];
  const [c] = await 고객고르기(process.argv, q);
  if (!c.domain) throw new Error(`${c.slug}: domain 없음 — 구글 색인 요청을 못 합니다`);
  return c;
});
const SITE = `https://${CLIENT.domain}`;
const PROP = CLIENT.gscProperty ?? `sc-domain:${CLIENT.domain}`;
const ALL = process.argv.includes("--all");

/**
 * 이미 넣은 주소는 gsc-done.json 에 쌓아 둔다.
 * 하루 한도가 있어서 며칠에 걸쳐 나눠 넣어야 하는데,
 * 기록이 없으면 매번 앞의 6개만 다시 넣게 된다.
 */
const DONE_FILE = new URL("./gsc-done.json", import.meta.url);
const done = new Set(
  await readFile(DONE_FILE, "utf8").then(JSON.parse).catch(() => []),
);

async function targets() {
  if (!ALL) return [`${SITE}/`, `${SITE}/blog`];
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  const all = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const left = all.filter((u) => !done.has(u));
  console.log(`전체 ${all.length}개 · 접수함 ${done.size}개 · 남음 ${left.length}개`);
  return left.slice(0, 8);
}

const urls = await targets();
console.log(`색인 요청 ${urls.length}개`);

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

// 콘솔에 한 번만 들어간다. 이후에는 같은 화면에서 검사창만 다시 쓴다.
await page.goto(
  "https://search.google.com/search-console?resource_id=" + PROP,
  { waitUntil: "domcontentloaded" },
);
await page.waitForTimeout(7000);

if (/accounts\.google\.com|search-console\/about/.test(page.url())) {
  console.log("로그인이 안 돼 있습니다. `node open-session.mjs` 를 먼저 돌리세요.");
  await ctx.close();
  process.exit(1);
}

/** 상단 검사창 — placeholder 가 "'도메인'에 있는 모든 URL 검사" 형태다 */
async function inspectBox() {
  const cands = [
    page.getByPlaceholder(/URL 검사|Inspect any URL/i),
    page.locator('input[aria-label*="URL 검사"]'),
    page.locator('input[type="text"]:visible'),
  ];
  for (const c of cands) {
    const el = c.first();
    if (await el.isVisible().catch(() => false)) return el;
  }
  return null;
}

let ok = 0;
for (const [i, u] of urls.entries()) {
  console.log(`\n[${i + 1}/${urls.length}] ${u}`);

  const box = await inspectBox();
  if (!box) {
    console.log("  ✗ 검사창을 못 찾았습니다. 창을 확인해 주세요.");
    break;
  }

  await box.click();
  await page.waitForTimeout(300);
  await box.fill(u);
  await page.keyboard.press("Enter");

  // 실시간 조회라 느리다
  await page.waitForTimeout(12000);

  const body = await page.locator("body").innerText().catch(() => "");

  if (/색인이 생성됨|URL이 Google에 등록됨/.test(body)) {
    // 이미 색인된 주소에 요청을 누르면 하루 한도(10건 안팎)만 먹는다.
    // 9.11 에 8건 중 7건이 이미 색인된 주소였고, 정작 안 된 주소는 한도에 막혔다.
    console.log("  = 이미 색인돼 있습니다 — 한도를 아끼려 건너뜁니다");
    done.add(u);
    await writeFile(DONE_FILE, JSON.stringify([...done], null, 2));
    continue;
  }

  try {
    const btn = page
      .getByRole("button", { name: /색인 생성 요청|REQUEST INDEXING|Request indexing/i })
      .first();
    await btn.waitFor({ state: "visible", timeout: 20000 });
    await btn.click();
    console.log("  · 요청 눌렀습니다 — 접수까지 최대 90초");

    await page
      .getByText(/색인 생성이 요청됨|우선순위 크롤링 대기열|Indexing requested/i)
      .first()
      .waitFor({ timeout: 90000 });
    console.log("  ✓ 접수됨");
    ok++;
    done.add(u);
    await writeFile(DONE_FILE, JSON.stringify([...done], null, 2));

    // 확인 창 닫기
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1500);
  } catch (e) {
    const b2 = await page.locator("body").innerText().catch(() => "");
    if (/할당량|quota|초과/i.test(b2)) {
      console.log("  ! 하루 한도 초과 — 여기까지. 내일 이어서 하세요.");
      break;
    }
    console.log("  ✗ 요청 버튼을 못 눌렀습니다");
    console.log("    " + e.message.split("\n")[0].slice(0, 90));
    break;
  }

  if (i < urls.length - 1) {
    console.log("  … 20초 쉽니다");
    await page.waitForTimeout(20000);
  }
}

console.log(`\n접수 ${ok}/${urls.length}건. 창을 30초 열어 둡니다.`);
await page.waitForTimeout(30000);
await ctx.close();
