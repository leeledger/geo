/**
 * 모션 페이지를 영상으로 굽는다.
 *
 * 도해가 하나씩 들어오는 구간을 영상 파일로 만든다.
 * 편집 프로그램에서 이 파일을 얹고 그 위에 목소리만 얹으면 된다.
 * 애프터이펙트 같은 게 없어도 되고, 만드는 건 사람이 아니라 여기서 한다.
 *
 * 브라우저 화면을 그대로 녹화하는 방식이라 CSS 로 만든 움직임이면 무엇이든 담긴다.
 *
 *   node motion-record.mjs two-skills            8초 (기본)
 *   node motion-record.mjs two-skills --sec 12   길이 지정
 *   node motion-record.mjs --all                 motion/ 안의 전부
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const SRC = path.resolve("../academy/public/youtube/motion");
const OUT = path.resolve("../academy/public/youtube/motion/out");

const args = process.argv.slice(2);
const si = args.indexOf("--sec");
const sec = si >= 0 ? Number(args[si + 1]) : 8;
const names = args.includes("--all")
  ? fs.readdirSync(SRC).filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, ""))
  : args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));

if (!names.length) {
  console.log("이름을 주거나 --all 을 쓰세요. 예: node motion-record.mjs two-skills");
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

for (const name of names) {
  const file = path.join(SRC, `${name}.html`);
  if (!fs.existsSync(file)) { console.log(`✗ ${name}.html 이 없습니다`); continue; }

  // 녹화는 컨텍스트 단위다. 페이지마다 새로 열어야 파일이 나뉜다.
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });

  // 애니메이션이 처음부터 담기도록 잠깐 두고 시작 시점을 맞춘다
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => { a.currentTime = 0; a.play(); });
  });

  await page.waitForTimeout(sec * 1000);

  const video = page.video();
  await ctx.close();          // 닫아야 파일이 써진다
  await browser.close();

  const tmp = await video.path();
  const dest = path.join(OUT, `${name}.webm`);
  fs.renameSync(tmp, dest);
  const mb = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
  console.log(`  ${name}.html → out/${name}.webm  1920×1080 · ${sec}초 · ${mb}MB`);
}

console.log(`\n${OUT} 에 있습니다. 편집에서 얹고 목소리만 넣으시면 됩니다.`);
