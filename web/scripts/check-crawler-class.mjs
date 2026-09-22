// web/lib/crawler-class.ts 의 두 목록이 academy/lib/bots.ts 판별표 두 칸과 같은지 본다.
// 다르면 종료코드 1. 읽는 법은 academy/scripts/case-report.mjs 와 같다.
import fs from "node:fs";

const bots = fs.readFileSync(new URL("../../academy/lib/bots.ts", import.meta.url), "utf8");
const mine = fs.readFileSync(new URL("../lib/crawler-class.ts", import.meta.url), "utf8");

const names = (text) => [...text.matchAll(/\[\/[^\n]*?\/i,\s*"([^"]+)"/g)].map((m) => m[1]);
const cut = bots.indexOf("// ── 검색 색인");
if (cut < 0) { console.error("bots.ts 에서 「검색 색인」 칸을 못 찾음"); process.exit(1); }
const want = { AI_BOTS: names(bots.slice(0, cut)), SEARCH_BOTS: names(bots.slice(cut)) };

const listOf = (name) => {
  const m = mine.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`));
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
};

let bad = false;
for (const [name, w] of Object.entries(want)) {
  const got = listOf(name);
  const a = JSON.stringify([...(got ?? [])].sort()), b = JSON.stringify([...w].sort());
  if (a !== b) { bad = true; console.error(`${name} 다름\n  bots.ts: ${b}\n  web    : ${a}`); }
  else console.log(`${name} 같음 (${w.length})`);
}
process.exit(bad ? 1 : 0);
