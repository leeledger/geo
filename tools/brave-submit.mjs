/**
 * Brave 검색에 우리 주소를 읽어 달라고 요청한다.
 *
 * Claude 의 웹 검색은 Brave 색인을 쓴다(Anthropic 하위 처리자 목록, 2025-03 보도).
 * 2026-09-22 에 재 보니 Brave 에 site:robotncoding.com 이 0건이었다. ClaudeBot 은 127쪽을 읽어 갔는데도
 * Claude 가 검색으로는 우리를 못 찾아, 「robotncoding.com 은 강남 대치동 학원」처럼 남의 정보로 답했다.
 *
 * Brave 에는 서치콘솔 같은 관리 도구가 없고 search.brave.com/submit-url 하나뿐이다.
 * 제출 버튼에 캡차가 있다. 우회하지 않는다 — 주소 입력과 버튼은 이 도구가 하고, 캡차만 사람이 푼다.
 *
 *   node brave-submit.mjs                         기본 주소들
 *   node brave-submit.mjs https://robotncoding.com/blog/<슬러그>
 */
import { chromium } from "playwright";

const 기본 = ["https://robotncoding.com/", "https://robotncoding.com/blog", "https://robotncoding.com/llms.txt"];
const 주소들 = process.argv.slice(2).filter((a) => /^https?:\/\//.test(a));
const 목록 = 주소들.length ? 주소들 : 기본;

const b = await chromium.launch({ headless: false });
const p = await b.newPage({ locale: "ko-KR", viewport: { width: 1100, height: 800 } });
const 결과 = [];

for (const url of 목록) {
  await p.goto("https://search.brave.com/submit-url", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  await p.locator("input[type=text]").first().fill(url);
  await p.locator("button.captcha-button, button[type=submit]").first().click().catch(() => {});
  console.log(`\n${url}\n  캡차가 뜨면 창에서 풀어 주세요 (최대 3분). 제출되면 자동으로 다음으로 넘어갑니다.`);

  // 제출되면 입력 칸이 비거나 안내 문구가 바뀐다. 무엇이 뜨는지 확인한 적이 없어 둘 다 본다
  const 처음글 = await p.evaluate(() => document.body.innerText);
  const t0 = Date.now();
  let 됨 = false;
  while (Date.now() - t0 < 180000) {
    await p.waitForTimeout(2000);
    const 지금 = await p.evaluate(() => ({ text: document.body.innerText, v: document.querySelector("input[type=text]")?.value ?? "" })).catch(() => null);
    if (!지금) continue;
    if (/success|submitted|thank|received|완료|접수/i.test(지금.text) && 지금.text !== 처음글) { 됨 = true; break; }
    if (지금.v === "" && 지금.text !== 처음글) { 됨 = true; break; }
  }
  const 끝글 = (await p.evaluate(() => document.body.innerText).catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
  console.log(됨 ? `  ✓ 제출된 것으로 보입니다 · ${끝글}` : `  ✗ 3분 안에 확인이 안 됐습니다 · ${끝글}`);
  결과.push({ url, 됨 });
}

await b.close();
console.log(`\n${결과.filter((x) => x.됨).length}/${결과.length} 제출. Brave 는 보통 며칠~몇 주 뒤 색인한다 — 3일마다 도는 Claude 측정에서 인용이 생기는지 본다.`);
if (결과.some((x) => !x.됨)) process.exitCode = 1;
