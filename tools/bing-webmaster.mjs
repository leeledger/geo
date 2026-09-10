/**
 * 빙 웹마스터 등록 — 구글 서치콘솔에서 가져오기.
 *
 * 왜 하냐면:
 *   GPTBot 이 사이트맵만 계속 가져가고 본문은 45쪽 중 7쪽만 읽었다.
 *   robots.txt 도 사이트맵도 정상이다. 빙 색인이 0건이라 발견 경로가 없다.
 *   OpenAI 계열은 빙 인덱스에 크게 기댄다. 빙에 없으면 ChatGPT 가 못 찾는다.
 *   IndexNow 는 200 을 받고 있지만 그건 「알림」이지 「등록」이 아니다.
 *
 * 빙 웹마스터는 마이크로소프트 계정 로그인이 필요하다. 그건 사람이 한다.
 * 로그인만 되면 「Import from Google Search Console」 로 한 번에 붙는다 —
 * 구글 세션은 이미 이 프로필에 살아 있다.
 *
 * 앞선 판은 안내만 찍고 process.exit(0) 을 했다. 그러면 브라우저가 부모
 * 프로세스와 같이 죽는다. 「창을 열어 뒀다」고 말해 놓고 창이 없었다.
 * open-session.mjs 가 이미 푼 함정인데 똑같이 밟았다.
 * 그래서 여기서는 로그인될 때까지 기다린다.
 *
 *   node bing-webmaster.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");
const HOME = "https://www.bing.com/webmasters/home";
const LIMIT = 12 * 60 * 1000; // 12분

/** 로그아웃/안내 화면이면 아직 로그인 전이다 */
const isOut = (u) =>
  /login\.live\.com|login\.microsoftonline|\/webmasters\/about|^about:/.test(u);

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});

// 성공이 alert 로 오는 화면이 있다. 핸들러가 없으면 플레이라이트가 조용히 닫는다 —
// 네이버 소유확인에서 이것 때문에 한참 헤맸다.
ctx.on("dialog", (d) => d.accept().catch(() => {}));

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(4000);

if (isOut(page.url())) {
  console.log(`
  ─────────────────────────────────────────────
  빙 웹마스터 — 마이크로소프트 로그인이 필요합니다.

  이 창에서 로그인만 해 주세요.
  로그인 뒤에는 아무것도 안 하셔도 됩니다.

  왜 필요하냐면:
    OpenAI(ChatGPT) 가 45쪽 중 7쪽만 읽었습니다.
    robots 도 사이트맵도 정상인데, 빙 색인이 0건이라
    ChatGPT 가 이 사이트를 발견할 경로가 없습니다.

  로그인되면 제가 감지해서 이어서 합니다. 최대 12분 기다립니다.
  ─────────────────────────────────────────────
`);
}

const started = Date.now();
let inside = false;
while (Date.now() - started < LIMIT) {
  if (page.isClosed()) break;
  if (!isOut(page.url())) { inside = true; break; }
  await new Promise((r) => setTimeout(r, 3000));
}

if (!inside) {
  console.log("\n  로그인이 확인되지 않았습니다. 다음에 다시 시도합니다.");
  console.log("  (창을 닫아 주시면 지금까지의 세션은 저장됩니다)");
  await new Promise((r) => setTimeout(r, 2000));
  await ctx.close().catch(() => {});
  process.exit(0);
}

console.log("  ✓ 로그인 확인\n");
await page.waitForTimeout(3000);

const body = await page.locator("body").innerText().catch(() => "");
if (/robotncoding/i.test(body)) {
  console.log("  robotncoding.com 이 이미 등록되어 있습니다.");
} else {
  // 경로를 추측하면 404 를 맞는다 — 네이버에서 두 번 그랬다.
  // 화면에 실제로 있는 글자를 읽는다.
  const labels = await page.locator("button, a, [role=button]").allInnerTexts().catch(() => []);
  const hit = [...new Set(labels.map((t) => t.trim()).filter(
    (t) => t && /import|가져오기|search console|add site|사이트 추가/i.test(t),
  ))].slice(0, 8);
  console.log("  robotncoding.com 이 아직 없습니다.");
  console.log("  화면에 있는 버튼:", hit.length ? hit.join(" · ") : "(못 찾음)");
}

await page.screenshot({ path: "bing-webmaster.png" }).catch(() => {});
console.log("\n  화면을 bing-webmaster.png 로 저장했습니다.");

// 정상 종료해야 쿠키가 디스크에 남는다
await new Promise((r) => setTimeout(r, 2000));
await ctx.close().catch(() => {});
