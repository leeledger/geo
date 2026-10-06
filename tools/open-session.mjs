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
 *   node open-session.mjs                       구글 서치콘솔 · 네이버 서치어드바이저 · 빙 웹마스터 셋
 *   node open-session.mjs --only google,microsoft   고른 곳만 (google · naver · microsoft)
 *   node open-session.mjs --blog .browser-profile-docttak
 *        고객 블로그용 따로 둔 프로필에 네이버 로그인만(Step 35 D55). 학원 블로그 세션(.browser-profile)과 섞이지 않는다.
 *        그 고객 네이버 계정으로 로그인한다. 로컬 에이전트가 이 프로필로 원장이 확인한 블로그 초안을 올린다
 *
 * 출력 「✓ <이름> 로그인 확인」 줄은 login-poll.mjs(현황판 「로그인 창 열기」)가 읽는다 — 글자를 바꾸지 않는다.
 */
import { chromium } from "playwright";
import path from "node:path";
import { 구글나감, 네이버나감, 블로그나감, 빙나감, 네이버쿠키, 판정걸음 } from "./login-rules.mjs";

const bi = process.argv.indexOf("--blog");
const BLOG_PROFILE = bi >= 0 ? process.argv[bi + 1] : null;
if (bi >= 0 && (!BLOG_PROFILE || BLOG_PROFILE === ".browser-profile")) {
  console.log("--blog 다음에 따로 둘 프로필 폴더 이름을 주세요. 예: --blog .browser-profile-docttak (학원 프로필은 안 됩니다)");
  process.exit(1);
}
const PROFILE = path.resolve(process.cwd(), BLOG_PROFILE ?? ".browser-profile");

const 학원 = [
  {
    key: "google",
    name: "Google Search Console",
    open: "https://search.google.com/search-console",
    isOut: 구글나감,
    how: "robotncoding.com 속성 화면까지 들어가 주세요 (안내 페이지 말고)",
  },
  {
    key: "naver",
    name: "네이버 서치어드바이저",
    open: "https://searchadvisor.naver.com/console/board",
    isOut: 네이버나감,
    how: "사이트 목록이 보이는 화면까지요\n     ** 로그인할 때 '로그인 상태 유지' 를 꼭 켜주세요 ** — 안 켜면 창을 닫을 때 세션이 사라집니다",
  },
  {
    key: "microsoft",
    name: "빙 웹마스터",
    // 빙 제출(bing-submit-urls)이 여는 바로 그 화면 — 여기가 열리면 제출도 된다
    open: "https://www.bing.com/webmasters/submiturl?siteUrl=https%3A%2F%2Frobotncoding.com%2F",
    isOut: 빙나감,
    how: "마이크로소프트 계정으로 로그인해 「Submit URLs」 화면이 보일 때까지요",
  },
];

const oi = process.argv.indexOf("--only");
const ONLY = oi >= 0 ? String(process.argv[oi + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : null;
if (ONLY && (BLOG_PROFILE || !ONLY.length || ONLY.some((k) => !학원.some((s) => s.key === k)))) {
  console.log(`--only 다음에 ${학원.map((s) => s.key).join(" · ")} 가운데 고른 것을 쉼표로 주세요. --blog 와 같이 쓰지 않습니다`);
  process.exit(1);
}

const SITES = BLOG_PROFILE ? [
  { key: "naver", name: "네이버 블로그", open: "https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fsection.blog.naver.com%2F", isOut: 블로그나감 },
] : 학원.filter((s) => !ONLY || ONLY.includes(s.key));

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});

const pages = {};
const 상태 = {};
for (const s of SITES) {
  const p = await ctx.newPage();
  await p.goto(s.open, { waitUntil: "domcontentloaded" }).catch(() => {});
  pages[s.key] = p;
  상태[s.key] = { streak: 0, openedAt: Date.now(), done: false };
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
브라우저를 띄웠습니다. 탭 ${SITES.length}개에 각각 로그인해 주세요.
${SITES.map((s, i) => `\n  ${i + 1}. ${s.name}\n     ${s.how}`).join("\n")}

다 되면 제가 알아서 감지하고 창을 닫습니다. Enter 안 누르셔도 됩니다.
`);

const started = Date.now();
const LIMIT = 12 * 60 * 1000; // 12분

while (Date.now() - started < LIMIT) {
  for (const s of SITES) {
    const st = 상태[s.key];
    if (st.done) continue;
    const p = pages[s.key];
    if (p.isClosed()) continue;
    const url = p.url();
    let extraOk = true;
    if (s.key === "naver" && url && !s.isOut(url) && !/^about:/.test(url)) {
      // 주소만 보면 안 된다 — 네이버는 NID_AUT 가 만료일을 가져야(로그인 상태 유지) 창을 닫은 뒤에도 남는다
      const 쿠키 = 네이버쿠키(await ctx.cookies("https://nid.naver.com").catch(() => []));
      extraOk = 쿠키 === "유지";
      if (쿠키 === "세션만" && !st.warned) {
        st.warned = true;
        console.log(`  ! ${s.name}: 로그인은 됐지만 「로그인 상태 유지」가 꺼져 있어 창을 닫으면 사라집니다.\n    오른쪽 위에서 로그아웃하고, 로그인 화면에서 「로그인 상태 유지」를 켠 뒤 다시 로그인해 주세요.`);
      }
    }
    const 다음 = 판정걸음(st, { url, now: Date.now(), openedAt: st.openedAt, isOut: s.isOut, extraOk });
    st.streak = 다음.streak;
    if (다음.ok) {
      st.done = true;
      console.log(`  ✓ ${s.name} 로그인 확인`);
    }
  }
  if (SITES.every((s) => 상태[s.key].done)) break;
  await new Promise((r) => setTimeout(r, 3000));
}

const 남은 = SITES.filter((s) => !상태[s.key].done).map((s) => s.name);
if (남은.length) {
  console.log(`\n아직 확인 안 된 곳: ${남은.join(", ")}`);
  console.log("그래도 지금까지의 세션은 저장합니다.");
} else {
  console.log(SITES.length === 1 ? "\n로그인을 확인했습니다." : "\n모두 확인했습니다.");
}

// 정상 종료 — 이래야 쿠키가 디스크에 남는다
console.log("창을 닫고 세션을 저장합니다…");
await new Promise((r) => setTimeout(r, 5000)); // 쿠키 파일에 쓰일 틈
await ctx.close();
console.log("저장 완료. 이제 check-session.mjs 로 확인할 수 있습니다.");
