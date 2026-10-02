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
 *   node open-session.mjs --blog .browser-profile-docttak
 *        고객 블로그용 따로 둔 프로필에 네이버 로그인만(Step 35 D55). 학원 블로그 세션(.browser-profile)과 섞이지 않는다.
 *        그 고객 네이버 계정으로 로그인한다. 로컬 에이전트가 이 프로필로 원장이 확인한 블로그 초안을 올린다
 */
import { chromium } from "playwright";
import path from "node:path";

const bi = process.argv.indexOf("--blog");
const BLOG_PROFILE = bi >= 0 ? process.argv[bi + 1] : null;
if (bi >= 0 && (!BLOG_PROFILE || BLOG_PROFILE === ".browser-profile")) {
  console.log("--blog 다음에 따로 둘 프로필 폴더 이름을 주세요. 예: --blog .browser-profile-docttak (학원 프로필은 안 됩니다)");
  process.exit(1);
}
const PROFILE = path.resolve(process.cwd(), BLOG_PROFILE ?? ".browser-profile");

/** 로그인 판정 — 로그인 화면이나 안내 페이지로 튀지 않으면 된 것으로 본다 */
const SITES = BLOG_PROFILE ? [
  {
    key: "naver",
    name: "네이버 블로그",
    // 로그인 화면에서 시작해 블로그 홈으로 돌아오면 된 것이다
    open: "https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fsection.blog.naver.com%2F",
    isOut: (u) => /nid\.naver\.com/.test(u),
  },
] : [
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

console.log(BLOG_PROFILE ? `
브라우저를 띄웠습니다(프로필 ${BLOG_PROFILE}). 블로그를 올릴 네이버 계정으로 로그인해 주세요.
  ** '로그인 상태 유지' 를 꼭 켜주세요 ** — 안 켜면 창을 닫을 때 세션이 사라집니다
  블로그 아이디(blog.naver.com/<아이디>)는 academy/.env.local 에 NAVER_BLOG_ID_<고객 슬러그 대문자>=<아이디> 로 적어 주세요.
블로그 홈으로 돌아오면 제가 알아서 감지하고 창을 닫습니다.
` : `
브라우저를 띄웠습니다. 탭 두 개에 각각 로그인해 주세요.

  1. Google Search Console
     robotncoding.com 속성 화면까지 들어가 주세요 (안내 페이지 말고)
  2. 네이버 서치어드바이저
     사이트 목록이 보이는 화면까지요
     ** 로그인할 때 '로그인 상태 유지' 를 꼭 켜주세요 **
     안 켜면 창을 닫을 때 세션이 사라집니다

둘 다 되면 제가 알아서 감지하고 창을 닫습니다. Enter 안 누르셔도 됩니다.
`);

// 블로그 프로필은 네이버 하나만 연다 — 구글은 처음부터 된 것으로 둔다
const done = { google: Boolean(BLOG_PROFILE), naver: false };
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
  console.log(BLOG_PROFILE ? "\n로그인을 확인했습니다." : "\n둘 다 확인했습니다.");
}

// 정상 종료 — 이래야 쿠키가 디스크에 남는다
console.log("창을 닫고 세션을 저장합니다…");
await new Promise((r) => setTimeout(r, 2000));
await ctx.close();
console.log("저장 완료. 이제 check-session.mjs 로 확인할 수 있습니다.");
