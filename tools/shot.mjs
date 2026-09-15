/**
 * 화면을 찍는다.
 *
 * 왜 만드나: HTTP 200 은 「깨지지 않았다」는 뜻이 아니다. 오늘만 두 번 당했다 —
 * 네이버 이관이 「사진 0장」으로 조용히 올라갔고, 도해는 파일이 404 인데 본문만 멀쩡했다.
 * 로그와 상태 코드로는 안 보이는 것을 보려면 실제로 찍어 봐야 한다.
 *
 * 기존 도구는 전부 사이트별 일회용이었다(bing-webmaster-look 등). 범용으로 둔다.
 *
 * .browser-profile 을 쓰지 않는다. 그 프로필은 배타적 잠금이라, 로그인 세션을 쓰는
 * 작업과 동시에 돌리면 서로 막는다. 로그인이 필요 없는 공개 페이지만 찍는 도구다.
 *
 *   node shot.mjs <주소> [저장경로] [--w 1280] [--h 900] [--full]
 *     --full  페이지 전체를 이어 찍는다 (기본은 보이는 화면만)
 */
import { chromium } from "playwright";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d;
};
const plain = args.filter((a, i) => !a.startsWith("--") && !/^\d+$/.test(a) || (i === 0));
const url = args.find((a) => /^https?:\/\//.test(a));
if (!url) {
  console.log("주소를 주세요:  node shot.mjs <주소> [저장경로] [--w 1280] [--h 900] [--full]");
  process.exit(1);
}
const out = plain.find((a) => /\.png$/i.test(a)) ?? "shot.png";
const W = flag("w", 1280);
const H = flag("h", 900);
const FULL = args.includes("--full");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  locale: "ko-KR",
});

const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => null);
console.log(`${url}  HTTP ${res ? res.status() : "실패"}`);

// 글꼴이 늦게 오면 글자가 밀린 채로 찍힌다. 다 온 뒤에 찍는다.
await page.evaluate(() => document.fonts?.ready).catch(() => {});
await page.waitForTimeout(700);

const file = path.resolve(out);
await page.screenshot({ path: file, fullPage: FULL });
console.log(`저장: ${file}  ${W}x${H}${FULL ? " (전체)" : ""} @2x`);

await browser.close();
