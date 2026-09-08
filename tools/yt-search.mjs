/**
 * 유튜브에서 비슷한 자리에 있는 채널을 찾는다.
 *
 * 검색 결과 페이지는 ytInitialData 라는 JSON 덩어리에 들어 있다.
 * HTML 을 정규식으로 긁으면 계속 빗나가므로 그 JSON 을 파싱한다.
 *
 *   node yt-search.mjs "검색어" "검색어2" ...
 */
import { chromium } from "playwright";
import path from "node:path";

const QUERIES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "AI 시대 교육 학부모",
      "AI 시대 아이 교육",
      "코딩교육 학부모",
      "챗GPT 아이 교육",
      "AI 교육 전문가",
    ];

const ctx = await chromium.launchPersistentContext(path.join(process.cwd(), ".browser-profile"), {
  headless: true,
  viewport: { width: 1400, height: 900 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

/** 채널명 → {영상수, 총조회수, 대표 제목들} */
const chan = new Map();

for (const q of QUERIES) {
  await page.goto("https://www.youtube.com/results?search_query=" + encodeURIComponent(q) + "&sp=CAMSAhAB",
    { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  const rows = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    // 렌더된 카드에서 읽는다. JSON 구조는 자주 바뀌지만 화면은 덜 바뀐다.
    for (const el of document.querySelectorAll("ytd-video-renderer")) {
      const title = el.querySelector("#video-title")?.textContent?.trim() || "";
      const ch = el.querySelector("ytd-channel-name a")?.textContent?.trim() || "";
      const meta = [...el.querySelectorAll("#metadata-line span")].map((s) => s.textContent.trim());
      if (!title || !ch || seen.has(title)) continue;
      seen.add(title);
      out.push({ title, ch, views: meta[0] || "", when: meta[1] || "" });
    }
    return out;
  });

  console.log(`\n=== "${q}" — ${rows.length}건`);
  for (const r of rows.slice(0, 8)) {
    console.log(`  ${r.views.padEnd(12)} ${r.ch.slice(0, 18).padEnd(20)} ${r.title.slice(0, 52)}`);
    const c = chan.get(r.ch) || { n: 0, titles: [] };
    c.n++;
    if (c.titles.length < 3) c.titles.push(r.title.slice(0, 46));
    chan.set(r.ch, c);
  }
  await page.waitForTimeout(1500);
}

console.log("\n\n══ 여러 검색어에 걸린 채널 ══");
[...chan.entries()]
  .filter(([, c]) => c.n >= 2)
  .sort((a, b) => b[1].n - a[1].n)
  .slice(0, 15)
  .forEach(([name, c]) => {
    console.log(`\n  ${name}  (${c.n}회)`);
    c.titles.forEach((t) => console.log(`     · ${t}`));
  });

await ctx.close();
