// /ai 페이지 잠금 검사(Step 45) — 키워드 횟수·숫자 출처·AI 티·FAQ 중복·네비·측정 검색어.
//   node academy/scripts/test-ai-page.mjs
// 하나라도 걸리면 종료코드 1.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MARKS } from "./slop-rules.mjs";
import { CODE_CLIENTS } from "../clients.mjs";

const 뿌리 = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const 읽기 = (p) => fs.readFileSync(path.join(뿌리, p), "utf8").replace(/\r\n/g, "\n");

let fail = 0, pass = 0;
const 봄 = (이름, 됨, 왜 = "") => {
  if (됨) { pass++; console.log(`PASS ${이름}`); } else { fail++; console.log(`FAIL ${이름}${왜 ? ` — ${왜}` : ""}`); }
};
const 횟수 = (글, 말) => String(글 ?? "").split(말).length - 1;
const 풀기 = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const 문자열들 = (v) => typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(문자열들)
  : v && typeof v === "object" ? Object.values(v).flatMap(문자열들) : [];

const ai = JSON.parse(읽기("content/ai.json"));
const html = 읽기("content/home.html");
const llms = 읽기("public/llms.txt");
const schema = JSON.parse(읽기("content/schema.json"));
const page = 읽기("app/ai/page.tsx");
const nav = 읽기("components/Nav.tsx");
const sitemap = 읽기("app/sitemap.ts");

const 글들 = 문자열들(ai);
const 전체 = 글들.join("\n");

// ── 1. 키워드 정확 횟수 (잠긴 글로 셌다. 안 맞으면 글을 고치지 말고 Arch 에게)
for (const [말, n] of [["초등 AI 교육", 2], ["AI 수업", 2], ["AI 교육 기관", 1], ["AI 강의", 1], ["AI학원", 0]]) {
  봄(`ai.json 「${말}」 ${n}번`, 횟수(전체, 말) === n, `실제 ${횟수(전체, 말)}번`);
}
봄("ai.json 「AI 교육」 5번 이하", 횟수(전체, "AI 교육") <= 5, `실제 ${횟수(전체, "AI 교육")}번`);
봄("title 「초등 AI 교육」 1번", 횟수(ai.title, "초등 AI 교육") === 1, ai.title);
봄("title 「AI 수업」 1번", 횟수(ai.title, "AI 수업") === 1, ai.title);
봄("h1 「초등 AI 교육」 1번", 횟수(ai.h1.join(" "), "초등 AI 교육") === 1);

// ── 2. FAQ 가 홈·스키마 FAQ 와 안 겹침
const 절 = html.match(/<section id="faq">([\s\S]*?)<\/section>/)?.[1] ?? "";
const 홈질문 = [...절.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => 풀기(m[1]));
const 스키마질문 = ((schema["@graph"] ?? []).find((n) => n["@type"] === "FAQPage")?.mainEntity ?? []).map((q) => String(q.name).trim());
봄("홈 FAQ 를 읽었다", 홈질문.length > 0 && 스키마질문.length > 0);
const 겹침 = ai.faq.map(([q]) => q.trim()).filter((q) => 홈질문.includes(q) || 스키마질문.includes(q));
봄(`ai.json FAQ ${ai.faq.length}문 — 홈·schema FAQ 와 겹침 0`, ai.faq.length === 3 && 겹침.length === 0, 겹침.join(" / "));

// ── 3. 숫자 출처 — ai.json 의 숫자 덩어리가 llms.txt 또는 home.html 에 글자 그대로
const 숫자 = [...new Set(전체.match(/\d[\d,]*/g) ?? [])];
const 출처없음 = 숫자.filter((n) => !llms.includes(n) && !html.includes(n));
봄(`숫자 ${숫자.length}개 출처 있음`, 출처없음.length === 0, 출처없음.join(", "));

// ── 4. AI 티 — slop-rules MARKS (test-faq-sync 와 같은 해석) + 금지어
for (const m of MARKS) {
  const 걸림 = [];
  for (const 글 of 글들) {
    if (m.seq) {
      const used = m.seq.filter((w) => new RegExp(`(^|\\n)\\s*${w}[,\\s]`).test(글));
      if (used.length >= m.min) 걸림.push(...used);
    } else {
      걸림.push(...(글.match(m.re) ?? []));
    }
  }
  봄(`MARKS ${m.why}: 0건`, 걸림.length === 0, 걸림.join(", "));
}
const 금지 = 전체.match(/다양한|여러 가지|정말|매우|필수적|혁신적|놀라운|알아보겠습니다|먼저,|마지막으로/g) ?? [];
봄("금지어 0건", 금지.length === 0, 금지.join(", "));

// ── 5. 네비 — Nav.tsx LINKS == home.html .navlinks (mtel 제외), 둘 다 /ai
const navHref = [...(nav.match(/const LINKS = \[([\s\S]*?)\];/)?.[1] ?? "").matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
const 홈nav = html.match(/<div class="navlinks">([\s\S]*?)<\/div>/)?.[1] ?? "";
const 홈href = [...홈nav.matchAll(/<a ([^>]*)>/g)].filter((m) => !/class="mtel"/.test(m[1])).map((m) => m[1].match(/href="([^"]+)"/)?.[1]);
봄("Nav.tsx LINKS == home.html nav (순서까지)", navHref.length > 0 && JSON.stringify(navHref) === JSON.stringify(홈href),
  `Nav ${navHref.join(" ")} / home ${홈href.join(" ")}`);
봄("두 네비 다 /ai 포함", navHref.includes("/ai") && 홈href.includes("/ai"));

// ── 6. 링크·사이트맵·llms·canonical
봄("home.html 에 href=\"/ai\" 1개 이상", 횟수(html, 'href="/ai"') >= 1);
봄("sitemap.ts 에 /ai 줄", /\$\{BASE\}\/ai`/.test(sitemap));
봄("llms.txt 에 robotncoding.com/ai 로 끝나는 줄", /https:\/\/robotncoding\.com\/ai$/m.test(llms));
봄("page.tsx canonical /ai", page.includes('canonical: "/ai"'));

// ── 7. 측정 검색어 — AI교육 4개 따로, 경쟁 6개 그대로
const 학원 = CODE_CLIENTS.find((c) => c.id === 1);
const qs = 학원?.queries ?? [];
const aiq = qs.filter((x) => x.kind === "AI교육");
봄("학원 queries AI교육 a1~a4", JSON.stringify(aiq.map((x) => x.id)) === JSON.stringify(["a1", "a2", "a3", "a4"]), aiq.map((x) => x.id).join(","));
봄("학원 queries 경쟁 6개 그대로", qs.filter((x) => x.kind === "경쟁").length === 6);

console.log(`\n${pass} PASS · ${fail} FAIL`);
if (fail) process.exit(1);
