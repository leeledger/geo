/**
 * 지고 있는 검색어에서 「무엇이」 이기고 있는지 본다.
 *
 * 고리의 마지막 자리가 하는 일은 잰 결과를 쓸 것으로 바꾸는 일이다.
 * 그러려면 「우리가 안 나온다」로는 부족하다. 그 자리에 뭐가 있는지 봐야
 * 무엇을 만들어야 하는지 정할 수 있다.
 *
 * 블로그가 이기는 자리에 홈페이지 글을 더 써 봐야 안 올라온다.
 * 목록 사이트가 이기는 자리라면 글이 아니라 등재가 답이다.
 * 비교·추천 글이 이기는 자리라면 그 글에 이름을 넣는 게 답이다.
 *
 *   node scripts/who-wins.mjs                         전 고객사
 *   node scripts/who-wins.mjs --client ilog           한 곳
 *   node scripts/who-wins.mjs --client ilog --md out.md   표로 저장
 */
import fs from "node:fs";
import path from "node:path";
import { selectClients } from "../clients.mjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => (s || "").replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

/** 주소와 제목을 보고 어떤 종류의 지면인지 가른다 */
function kindOf(url, title = "") {
  if (/blog\.naver|m\.blog\.naver/.test(url)) return "네이버블로그";
  if (/cafe\.naver/.test(url)) return "네이버카페";
  if (/post\.naver/.test(url)) return "네이버포스트";
  if (/in\.naver|map\.naver|place/.test(url)) return "플레이스";
  if (/youtube|youtu\.be/.test(url)) return "유튜브";
  if (/play\.google|apps\.apple|onestore/.test(url)) return "앱스토어";
  if (/academy\.prompie|edufindkorea|soonwidot|mohazi|hakwonmap|hakwoninfo/.test(url)) return "학원목록";
  if (/\.go\.kr|\.or\.kr/.test(url)) return "공공";
  // 제목이 비교·추천·순위면 그 글에 이름이 들어가야 한다
  if (/비교|추천|순위|top\s?\d|best|\d+\s?(종|가지|곳)/i.test(title)) return "비교·추천글";
  if (/tistory|brunch|velog|wordpress|medium|blog/.test(url)) return "개인·기업블로그";
  return "웹사이트";
}

const mdOut = (() => {
  const i = process.argv.indexOf("--md");
  return i > 0 ? process.argv[i + 1] : null;
})();
const md = [];

for (const c of selectClients()) {
  const queries = c.queries.filter((x) => x.kind === "경쟁").map((x) => x.q);
  console.log(`\n══ ${c.name} · ${c.domain} ══`);
  md.push(`## ${c.name} — 경쟁 검색어에서 이기고 있는 지면`, "");

  for (const q of queries) {
    const r = await fetch(
      "https://search.naver.com/search.naver?where=web&query=" + encodeURIComponent(q),
      { headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9" } },
    ).catch((e) => ({ ok: false, e }));

    if (!r.ok) { console.log(`\n【 ${q} 】 못 가져옴`); await sleep(2600); continue; }
    const html = await r.text();

    const blocks = html.split("fds-web-normal-doc-root").slice(1);
    console.log(`\n【 ${q} 】 네이버 웹문서 ${blocks.length}건`);
    md.push(`### 「${q}」`, "", "| # | 종류 | 주소 | 제목 |", "|---|---|---|---|");

    const tally = {};
    blocks.slice(0, 10).forEach((b, i) => {
      const head = b.slice(0, 6000);
      const url = (head.match(/href="(https?:\/\/[^"]+)"/) ?? [])[1] ?? "";
      const host = url.replace(/^https?:\/\//, "").split("/")[0];
      const title = strip((head.match(/<span[^>]*class="[^"]*(?:title|headline)[^"]*"[^>]*>([\s\S]{0,200}?)<\/span>/) ?? [])[1]);
      const mine = url.includes(c.domain);
      const k = mine ? "★ 우리" : kindOf(url, title);
      tally[k] = (tally[k] ?? 0) + 1;
      console.log(`  ${String(i + 1).padStart(2)}. ${k.padEnd(9)} ${host.slice(0, 34).padEnd(36)}${title.slice(0, 30)}`);
      md.push(`| ${i + 1} | ${k} | ${url.slice(0, 90)} | ${title.replace(/\|/g, "/").slice(0, 60)} |`);
    });

    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    console.log(`     → ${top.map(([k, n]) => `${k} ${n}`).join(" · ")}`);
    md.push("", `→ ${top.map(([k, n]) => `${k} ${n}`).join(" · ")}`, "");
    await sleep(2600);
  }
}

console.log(`
─────────────────────────────────────────────
무엇이 이기는 자리인지 보고 나서 정합니다.
  네이버블로그가 이기면  → 우리 사이트 글로는 못 이긴다. 블로그 쪽 손을 쓴다
  학원목록이 이기면      → 글이 아니라 등재가 답이다
  비교·추천글이 이기면   → 그 글에 이름을 넣는다. 운영사에 연락한다
  웹사이트가 이기면      → 그 자리는 우리 페이지로 노려볼 만하다
─────────────────────────────────────────────`);

if (mdOut) {
  const file = path.resolve(process.cwd(), mdOut);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `# 경쟁 검색어 지면 조사 · ${new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}\n\n` + md.join("\n") + "\n", "utf8");
  console.log(`\n저장: ${path.relative(process.cwd(), file)}`);
}
