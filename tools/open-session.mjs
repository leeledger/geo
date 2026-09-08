/**
 * 로그인 세션 열기.
 *
 * 브라우저를 띄우고 사람이 직접 로그인한다. 프로필을 디스크에 저장하므로
 * 다음부터는 자동화 스크립트가 그 세션을 그대로 쓴다.
 *
 * 앞선 판에서는 Enter 를 기다렸는데, 그 프로세스를 강제로 끊자 쿠키가
 * 디스크에 써지기 전에 날아갔다. 크로미움은 정상 종료할 때 쿠키를 flush 한다.
 * 그래서 지금은 로그인 상태를 스스로 확인하고, 다 되면 스스로 닫는다.
 *
 *   node open-session.mjs
 */
import { chromium } from "playwright";
import path from "node:path";

const PROFILE = path.join(process.cwd(), ".browser-profile");

/** 로그인 판정 — 로그인 화면이나 안내 페이지로 튀지 않으면 된 것으로 본다 */
const SITES = [
  {
    key: "google",
    name: "Google Search Console",
    open: "https://search.google.com/search-console",
    // /about 은 로그아웃 상태의 안내 페이지다. 이걸 로그인으로 오해했었다.
    isOut: (u) => /accounts\.google\.com|search-console\/about|\/welcome/.test(u),
  },
  {
    key: "naver",
    name: "네이버 서치어드바이저",
    open: "https://searchadvisor.naver.com/console/board",
    isOut: (u) => /nid\.naver\.com|\/login/.test(u),
  },
];

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});

const pages = {};
for (const s of SITES) {
  const p = await ctx.newPage();
  await p.goto(s.open, { waitUntil: "domcontentloaded" }).catch(() => {});
  pages[s.key] = p;
}
for (const p of ctx.pages()) {
  if (p.url() === "about:blank") await p.close().catch(() => {});
}

console.log(`
브라우저를 띄웠습니다. 탭 두 개에 각각 로그인해 주세요.

  1. Google Search Console
     robotncoding.com 속성 화면까지 들어가 주세요 (안내 페이지 말고)
  2. 네이버 서치어드바이저
     사이트 목록이 보이는 화면까지요
     ** 로그인할 때 '로그인 상태 유지' 를 꼭 켜주세요 **
     안 켜면 창을 닫을 때 세션이 사라집니다

둘 다 되면 제가 알아서 감지하고 창을 닫습니다. Enter 안 누르셔도 됩니다.
`);

const done = { google: false, naver: false };
const started = Date.now();
const LIMIT = 12 * 60 * 1000; // 12분

while (Date.now() - started < LIMIT) {
  for (const s of SITES) {
    if (done[s.key]) continue;
    const p = pages[s.key];
    if (p.isClosed()) continue;
    const u = p.url();
    if (u && !s.isOut(u) && !/^about:/.test(u)) {
      done[s.key] = true;
      console.log(`  ✓ ${s.name} 로그인 확인`);
    }
  }
  if (done.google && done.naver) break;
  await new Promise((r) => setTimeout(r, 3000));
}

if (!done.google || !done.naver) {
  const left = SITES.filter((s) => !done[s.key]).map((s) => s.name).join(", ");
  console.log(`\n아직 확인 안 된 곳: ${left}`);
  console.log("그래도 지금까지의 세션은 저장합니다.");
} else {
  console.log("\n둘 다 확인했습니다.");
}

// 정상 종료 — 이래야 쿠키가 디스크에 남는다
console.log("창을 닫고 세션을 저장합니다…");
await new Promise((r) => setTimeout(r, 2000));
await ctx.close();
console.log("저장 완료. 이제 check-session.mjs 로 확인할 수 있습니다.");
