/**
 * 구글 서치콘솔 권한 탐침(Step 39c) — 원장 프로필(.browser-profile)로 고객 속성 화면을 열어 원문을 본다.
 * 원장이 「권한 받음」을 누르기 전에, 고객이 권한을 줬는지 화면으로 확인할 자리.
 *
 *   node gsc-access.mjs --client <slug>            판정 한 줄(GSC_ACCESS= · GSC_URL= · GSC_SAMPLE=)
 *   node gsc-access.mjs --client <slug> --look     + 최종 주소 · 본문 앞 60줄 · 보이는 버튼 글자(판정 기준을 만들 원문)
 *   node gsc-access.mjs --domain example.com --look   고객 행 없이 그 도메인 속성만(권한 없는 화면 원문 받기)
 *
 * 속성 = submit-gsc 와 같은 PROP(gscProperty ?? sc-domain:<domain>). 판정(권한판정)은 원문 fixture 가 들어오기 전엔 늘 「모름」이다.
 * 로그인이 풀려 있으면 「로그인이 풀렸습니다」를 찍고 종료코드 1 — local-agent 가 login-google 사람 일감을 올린다.
 */
import { chromium } from "playwright";
import path from "node:path";
import { 고객고르기, 잠깐DB, 도메인정리 } from "../academy/clients.mjs";
import { 권한판정 } from "../web/lib/client-core.mjs";
import { 구글나감 } from "./login-rules.mjs";

const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const LOOK = process.argv.includes("--look");
const 도메인 = arg("--domain");
if (!도메인 && !arg("--client")) {
  console.log("사용: node gsc-access.mjs --client <slug> [--look] | --domain <도메인> [--look]");
  process.exit(1);
}
const PROP = 도메인
  ? `sc-domain:${도메인정리(도메인)}`
  : await 잠깐DB(async (q) => {
    const [c] = await 고객고르기(process.argv, q);
    if (!c?.domain) throw new Error(`${c?.slug ?? arg("--client")}: domain 없음`);
    return c.gscProperty ?? `sc-domain:${c.domain}`;
  });
if (/^sc-domain:$/.test(PROP)) { console.log("도메인 모양이 아닙니다"); process.exit(1); }

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: false, viewport: { width: 1440, height: 940 }, locale: "ko-KR", timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
try {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(`https://search.google.com/search-console?resource_id=${encodeURIComponent(PROP)}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  // 리다이렉트(로그인 화면·속성 고르기)가 끝날 틈 — bing-submit-urls 와 같은 9초
  await page.waitForTimeout(9000);
  const url = page.url();
  console.log(`속성 ${PROP} · 주소 ${url}`);
  if (구글나감(url)) {
    console.log("로그인이 풀렸습니다 — 구글 서치콘솔에 다시 로그인");
    process.exitCode = 1;
  } else {
    const 글 = (await page.evaluate(() => document.body.innerText)).replace(/\n{2,}/g, "\n");
    console.log(`GSC_ACCESS=${권한판정(url, 글)}`);
    console.log(`GSC_URL=${url}`);
    console.log(`GSC_SAMPLE=${JSON.stringify(글.slice(0, 600))}`);
    if (LOOK) {
      for (const l of 글.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 60)) console.log(`  · ${l.slice(0, 160)}`);
      const 버튼 = await page.evaluate(() => [...document.querySelectorAll("button,[role=button],a[role=link]")]
        .filter((e) => e.offsetParent).map((e) => (e.innerText || e.getAttribute("aria-label") || "").trim()).filter(Boolean));
      console.log(`  버튼: ${JSON.stringify([...new Set(버튼)]).slice(0, 1500)}`);
    }
  }
} finally {
  await ctx.close();
}
