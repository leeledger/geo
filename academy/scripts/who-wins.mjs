/**
 * 지고 있는 검색어에서 「무엇이」 이기고 있는지 본다.
 *
 * 고리의 마지막 자리가 하는 일은 잰 결과를 쓸 것으로 바꾸는 일이다.
 * 그러려면 「우리가 안 나온다」로는 부족하다. 그 자리에 뭐가 있는지 봐야
 * 무엇을 만들어야 하는지 정할 수 있다.
 *
 * 블로그가 이기는 자리에 홈페이지 글을 더 써 봐야 안 올라온다.
 * 목록 사이트가 이기는 자리라면 글이 아니라 등재가 답이다.
 *
 *   node scripts/who-wins.mjs
 */
import fs from "node:fs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const QUERIES = [
  "송파구 코딩학원",
  "송파 초등 코딩학원 추천",
  "잠실 초등 코딩학원",
  "헬리오시티 코딩학원",
  "송파구 로봇교실",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 주소를 보고 어떤 종류의 지면인지 가른다 */
function kindOf(url) {
  if (/blog\.naver|m\.blog\.naver/.test(url)) return "네이버블로그";
  if (/cafe\.naver/.test(url)) return "네이버카페";
  if (/post\.naver/.test(url)) return "네이버포스트";
  if (/in\.naver|map\.naver|place/.test(url)) return "플레이스";
  if (/tistory|brunch|velog|wordpress|medium/.test(url)) return "개인블로그";
  if (/youtube|youtu\.be/.test(url)) return "유튜브";
  if (/academy\.prompie|edufindkorea|soonwidot|mohazi|hakwon|학원/.test(url)) return "학원목록";
  if (/\.go\.kr|\.or\.kr/.test(url)) return "공공";
  return "웹사이트";
}

for (const q of QUERIES) {
  const r = await fetch(
    "https://search.naver.com/search.naver?where=web&query=" + encodeURIComponent(q),
    { headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9" } },
  ).catch((e) => ({ ok: false, e }));

  if (!r.ok) { console.log(`\n【 ${q} 】 못 가져옴`); await sleep(2600); continue; }
  const html = await r.text();

  const blocks = html.split("fds-web-normal-doc-root").slice(1);
  console.log(`\n【 ${q} 】 웹문서 ${blocks.length}건`);

  const tally = {};
  blocks.slice(0, 10).forEach((b, i) => {
    const head = b.slice(0, 5000);
    const url = (head.match(/href="(https?:\/\/[^"]+)"/) ?? [])[1] ?? "";
    const host = url.replace(/^https?:\/\//, "").split("/")[0];
    const title = (head.match(/<span[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]{0,120}?)<\/span>/) ?? [])[1];
    const k = kindOf(url);
    tally[k] = (tally[k] ?? 0) + 1;
    console.log(
      `  ${String(i + 1).padStart(2)}. ${k.padEnd(8)} ${host.slice(0, 34).padEnd(36)}` +
      (title ? title.replace(/<[^>]+>/g, "").trim().slice(0, 30) : ""),
    );
  });

  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  console.log(`     → ${top.map(([k, n]) => `${k} ${n}`).join(" · ")}`);
  await sleep(2600);
}

console.log(`
─────────────────────────────────────────────
무엇이 이기는 자리인지 보고 나서 정합니다.
  네이버블로그가 이기면  → 우리 사이트 글로는 못 이긴다. 블로그 쪽 손을 쓴다
  학원목록이 이기면      → 글이 아니라 등재가 답이다
  웹사이트가 이기면      → 그 자리는 우리 글로 노려볼 만하다
─────────────────────────────────────────────`);
