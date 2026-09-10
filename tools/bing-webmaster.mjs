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
 * 로그인만 되어 있으면 「Import from Google Search Console」 로 한 번에 붙는다.
 * 구글 세션은 이미 이 프로필에 살아 있다.
 *
 *   node bing-webmaster.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");
const HOME = "https://www.bing.com/webmasters/home";

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});

// 성공이 alert 로 오는 화면이 있다. 핸들러가 없으면 플레이라이트가 조용히 닫는다.
ctx.on("dialog", (d) => d.accept().catch(() => {}));

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

const url = page.url();
const loggedOut = /login\.live\.com|login\.microsoftonline|\/webmasters\/about/.test(url);

console.log(`  주소  ${url.slice(0, 90)}`);

if (loggedOut) {
  console.log(`
  ─────────────────────────────────────────────
  마이크로소프트 로그인이 필요합니다.

  창을 열어 두었습니다. 로그인만 해 주세요.
  로그인 뒤에는 아무것도 안 하셔도 됩니다 —
  「Import from Google Search Console」 는 제가 누릅니다.

  로그인이 끝나면 이 스크립트를 다시 돌립니다.
  ─────────────────────────────────────────────
`);
  // 창을 닫지 않는다. 사람이 로그인할 시간이 필요하다.
  // 쿠키는 정상 종료할 때 디스크에 써지므로, 사람이 창을 닫아야 저장된다.
  process.exit(0);
}

console.log("  ✓ 로그인되어 있습니다\n");

// 이미 등록된 사이트가 있나
const body = await page.locator("body").innerText().catch(() => "");
if (/robotncoding/i.test(body)) {
  console.log("  robotncoding.com 이 이미 등록되어 있습니다.");
} else {
  console.log("  robotncoding.com 이 아직 없습니다. 가져오기를 찾습니다.");
  // 화면에 보이는 버튼을 그대로 읽는다. 경로를 추측하면 404 를 맞는다 —
  // 네이버에서 두 번 그랬다.
  const btns = await page.locator("button, a").allInnerTexts().catch(() => []);
  const hit = btns.filter((t) => /import|가져오기|search console/i.test(t)).slice(0, 6);
  console.log("  후보 버튼:", hit.length ? hit.join(" · ") : "(못 찾음)");
}

await page.screenshot({ path: "bing-webmaster.png", fullPage: false }).catch(() => {});
console.log("\n  화면을 bing-webmaster.png 로 저장했습니다.");
console.log("  창은 열어 둡니다.");
