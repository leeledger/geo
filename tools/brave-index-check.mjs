/**
 * Brave 색인에 우리 주소가 몇 개 들었나 — 읽기만 한다.
 *
 * Claude 웹 검색은 Brave 색인을 쓴다(메모리 claude-search-needs-brave). 9/22 에 홈·/blog·llms.txt 를 넣은 뒤
 * 9/24 측정에서 동네 질문 11/11 이 인용됐는데, 일반 질문(몇 학년부터·블록→파이썬 등)은 맞는 글이 있어도 0/9 였다.
 * 글 하나하나가 색인에 들었는지 본다. curl 은 429 로 막혀 브라우저로 본다.
 *
 *   node brave-index-check.mjs            site:robotncoding.com 결과의 주소 목록
 *   node brave-index-check.mjs <slug...>  그 글이 색인에 있나(주소로 검색)
 */
import { chromium } from "playwright";

const slugs = process.argv.slice(2);
const b = await chromium.launch({ headless: false });
const p = await b.newPage({ locale: "ko-KR", viewport: { width: 1200, height: 900 } });

const 찾기 = async (q) => {
  await p.goto(`https://search.brave.com/search?q=${encodeURIComponent(q)}&source=web`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3500);
  const hrefs = await p.$$eval("a[href]", (as) => as.map((a) => a.href));
  return [...new Set(hrefs.filter((h) => /^https:\/\/robotncoding\.com/.test(h)).map((h) => h.replace(/[?#].*$/, "")))];
};

const 모음 = new Set();
if (!slugs.length) {
  for (let page = 0; page < 3; page++) {
    await p.goto(`https://search.brave.com/search?q=${encodeURIComponent("site:robotncoding.com")}&source=web&offset=${page}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3500);
    const hrefs = await p.$$eval("a[href]", (as) => as.map((a) => a.href));
    const got = hrefs.filter((h) => /^https:\/\/robotncoding\.com/.test(h)).map((h) => h.replace(/[?#].*$/, ""));
    got.forEach((h) => 모음.add(h));
    if (!got.length) break;
  }
  console.log(`site:robotncoding.com — ${모음.size}개`);
  for (const h of [...모음].sort()) console.log("  " + h);
} else {
  for (const s of slugs) {
    const url = `https://robotncoding.com/blog/${s}`;
    const got = await 찾기(url);
    console.log(`${got.includes(url) ? "있음" : "없음"}  ${url}`);
  }
}
await b.close();
