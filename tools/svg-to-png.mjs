/**
 * SVG 를 PNG 로 굽는다.
 *
 * 네이버 블로그 에디터와 유튜브는 SVG 를 안 받는다. 사이트에는 SVG 를 그대로 두고
 * (글자가 선명하고 용량이 작다) 밖에 올릴 때만 PNG 를 만든다.
 *
 * 파싱 오류를 반드시 잡는다. SVG 안에 & 를 그대로 쓰면 XML 이 깨지는데,
 * 브라우저는 에러 화면을 그려 준다. 그걸 그냥 찍으면 "30KB 생성됨" 같은
 * 멀쩡한 로그가 남고 실제로는 빨간 오류 화면이 PNG 로 저장된다.
 * 한 번 그렇게 굽고 로그만 보고 넘어갈 뻔했다.
 *
 *   node svg-to-png.mjs <디렉터리>               2배로 굽기 (기본)
 *   node svg-to-png.mjs <디렉터리> --scale 1     규격 그대로
 *   node svg-to-png.mjs <파일.svg> --transparent 배경 없이 (워터마크용)
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith("--")) || ".");
const si = args.indexOf("--scale");
const scale = si >= 0 ? Number(args[si + 1]) : 2;
// 영상 위에 겹치는 워터마크는 배경이 없어야 한다. 배경을 깔면 네모가 얹혀 보인다.
const transparent = args.includes("--transparent");

const one = fs.existsSync(dir) && fs.statSync(dir).isFile();
const base = one ? path.dirname(dir) : dir;
const files = one
  ? [path.basename(dir)]
  : fs.readdirSync(dir).filter((f) => f.endsWith(".svg"));
if (!files.length) {
  console.log("SVG 가 없습니다:", dir);
  process.exit(1);
}

const browser = await chromium.launch();
// SVG 를 최상위 문서로 연다 — 에이전트가 그린 DB 도해도 여기로 온다(naver-blog-post.mjs). 원장 PC 에서 그 안의 스크립트가 돌거나
// 바깥으로 요청이 나가면 안 된다: 자바스크립트를 끄고, file: 말고는 다 끊는다(Richard 9/22). parsererror 확인은 Playwright 가
// 따로 돌리는 evaluate 라 자바스크립트를 꺼도 된다
const context = await browser.newContext({ deviceScaleFactor: scale, javaScriptEnabled: false });
await context.route("**/*", (r) => (r.request().url().startsWith("file:") ? r.continue() : r.abort()));
const page = await context.newPage();

let bad = 0;
for (const f of files) {
  const src = path.join(base, f);
  const svg = fs.readFileSync(src, "utf8");
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const w = m ? Math.round(Number(m[1])) : 960;
  const h = m ? Math.round(Number(m[2])) : 480;

  await page.setViewportSize({ width: w, height: h });
  await page.goto(pathToFileURL(src).href, { waitUntil: "networkidle" });

  // XML 이 깨지면 브라우저가 parsererror 를 그린다. 찍기 전에 잡는다.
  const err = await page.evaluate(() => {
    const p = document.querySelector("parsererror");
    if (p) return p.textContent.replace(/\s+/g, " ").trim().slice(0, 120);
    return document.querySelector("svg") ? null : "svg 요소가 없습니다";
  });
  if (err) {
    console.log(`  ✗ ${f} — ${err}`);
    bad++;
    continue;
  }

  await page.waitForTimeout(600);
  const out = src.replace(/\.svg$/, ".png");
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h }, omitBackground: transparent });
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`  ${f} → ${path.basename(out)}  ${w}×${h}${scale !== 1 ? ` @${scale}x` : ""} · ${kb}KB`);
}

await browser.close();
if (bad) {
  console.log(`\n${bad}개가 깨졌습니다. SVG 안의 & 는 &amp; 로 써야 합니다.`);
  process.exit(1);
}
