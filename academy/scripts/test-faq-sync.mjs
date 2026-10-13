// 홈 FAQ ↔ 스키마 FAQ 맞춤 검사(Step 44) — 한쪽만 고치면 FAQ 리치결과가 어긋난다.
//   node academy/scripts/test-faq-sync.mjs
// 1) home.html #faq 의 <summary> 목록 == schema.json FAQPage mainEntity[].name 목록 (순서까지)
// 2) AI학원 문답이 home.html · schema.json · llms.txt 세 곳에 다 있다
// 3) meta title·description, schema #org description 에 「AI학원」 정확히 1번 · name/alternateName 엔 없음
// 4) 새 문구를 slop-rules MARKS 로 돌려 0건
// 하나라도 걸리면 종료코드 1.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MARKS } from "./slop-rules.mjs";

const 뿌리 = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const 읽기 = (p) => fs.readFileSync(path.join(뿌리, p), "utf8").replace(/\r\n/g, "\n");

const 질문 = "송파에서 초등학생 AI학원을 찾고 있어요. AI는 어떻게 가르치나요?";
const 답1 = "로봇&코딩학원은 송파구 석촌동에 있는 코딩·로봇·AI학원입니다. AI는 따로 떼어 낸 특강이 아닙니다. 5단계 전부에 들어 있습니다. 초등 3~6학년은 얼굴 인식·감정 분류를 직접 만들어 보며 학습 데이터가 결과를 바꾸는 것을 확인합니다. 초등 5학년부터는 만들고 싶은 것을 우리말로 설명해 코드를 얻고, 그 코드를 읽고 고칩니다. 초등 5학년~중학교 3학년 대상 「AI 시대 코딩」(24주)은 AI에게 정확히 요청하는 법을 다룹니다.";
const 답2 = "하지 않는 것도 있습니다. AI가 준 답을 그대로 내게 하지 않습니다. 학원 AI 튜터도 정답 코드는 주지 않고 어긋난 곳과 채울 칸만 보여 줍니다. AI학원을 고를 때는 아이가 AI 답을 직접 돌려 보고 틀린 곳을 찾는 시간이 수업에 있는지 보세요.";
const llms절 = `## AI학원을 찾는 분께 (AI Classes)

이름에 AI가 들어간 학원은 아닙니다. 코딩·로봇 학원이고, AI는 5단계 전부에 들어 있습니다.

- 초등 1~4학년 (1단계): 그림·음성 AI를 직접 써 보며 AI가 어떤 도구인지 감을 잡습니다.
- 초등 3~6학년 (2단계): 얼굴 인식·감정 분류를 만들어 보며 학습 데이터가 결과를 바꾸는 것을 확인합니다.
- 초등 5학년 이상 (3단계): 자연어 코딩. 만들고 싶은 것을 우리말로 설명해 코드를 얻고, 그 코드를 읽고 고치고 설명합니다.
- 초등 5학년~중학교 3학년: 「AI 시대 코딩」 24주. 프롬프트 한 줄에서 완성작까지 갑니다.
- 5단계: AI API를 붙인 챗봇·이미지 분류 같은 서비스를 완성해 포트폴리오로 정리합니다.
- 성인: AI 업무자동화반 https://robotncoding.com/ai-work

하지 않는 것도 있습니다. AI가 준 답을 그대로 내게 하지 않습니다. 학원 AI 튜터도 정답 코드는 주지 않고 어긋난 곳과 채울 칸만 보여 줍니다.
AI학원을 고를 때는 아이가 AI 답을 직접 돌려 보고 틀린 곳을 찾는 시간이 수업에 있는지 보세요.`;

let fail = 0, pass = 0;
const 봄 = (이름, 됨, 왜 = "") => {
  if (됨) { pass++; console.log(`PASS ${이름}`); } else { fail++; console.log(`FAIL ${이름}${왜 ? ` — ${왜}` : ""}`); }
};
const 횟수 = (글, 말) => String(글 ?? "").split(말).length - 1;
const 풀기 = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const html = 읽기("content/home.html");
const llms = 읽기("public/llms.txt");
const meta = JSON.parse(읽기("content/meta.json"));
const schema = JSON.parse(읽기("content/schema.json"));
const 그래프 = schema["@graph"] ?? [];
const faq = 그래프.find((n) => n["@type"] === "FAQPage");
const org = 그래프.find((n) => n["@id"] === "https://robotncoding.com/#org");

// ── 1. 순서 맞춤
const 절 = html.match(/<section id="faq">([\s\S]*?)<\/section>/)?.[1] ?? "";
const 홈질문 = [...절.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => 풀기(m[1]));
const 스키마질문 = (faq?.mainEntity ?? []).map((q) => String(q.name).trim());
// Step 44 이전부터 글자가 다른 4쌍(같은 자리·같은 뜻). 이번 단계는 고치지 않는다 — BUILD-LOG Known Gaps.
// 여기 없는 어긋남은 전부 FAIL. 이 4쌍을 고치면 이 목록에서 지운다.
const 알려진어긋남 = new Map([
  ["다른 코딩학원과 무엇이 다른가요?", "로봇&코딩학원은 다른 코딩학원과 무엇이 다른가요?"],
  ["아이가 학원에서 뭘 배웠는지 집에서 알 수 있나요?", "아이가 코딩학원에서 뭘 배웠는지 집에서 알 수 있나요?"],
  ["몇 살부터 시작할 수 있나요? 글자를 못 읽어도 되나요?", "코딩은 몇 살부터 시작할 수 있나요? 글자를 못 읽어도 되나요?"],
  ["대회 수상이나 진학 실적이 있나요?", "로봇&코딩학원은 대회 수상이나 진학 실적이 있나요?"],
]);
const 어긋남 = 홈질문.map((q, i) => [i, q, 스키마질문[i]]).filter(([, h, s]) => h !== s);
for (const [i, h, s] of 어긋남.filter(([, h, s]) => 알려진어긋남.get(h) === s)) console.log(`KNOWN ${i + 1}번째 글자 다름(Known Gap): home「${h}」 schema「${s}」`);
const 새어긋남 = 어긋남.filter(([, h, s]) => 알려진어긋남.get(h) !== s);
봄(`home #faq ${홈질문.length}문답 == schema FAQPage ${스키마질문.length}문답 (순서까지)`,
  홈질문.length > 0 && 홈질문.length === 스키마질문.length && 새어긋남.length === 0,
  새어긋남.length ? 새어긋남.map(([i, h, s]) => `${i + 1}번째: home「${h}」 schema「${s}」`).join(" / ") : "개수 다름");

// ── 2. 새 문답 세 곳
const 홈문답 = [...절.matchAll(/<details>([\s\S]*?)<\/details>/g)].map((m) => m[1]).find((d) => 풀기(d).startsWith(질문)) ?? "";
const 홈답 = [...홈문답.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => 풀기(m[1]));
봄("home.html: 잠긴 질문", 홈질문.includes(질문));
봄("home.html: 잠긴 답 2문단 그대로", 홈답.length === 2 && 홈답[0] === 답1 && 홈답[1] === 답2);
봄("home.html: 날 & 없음(&amp;)", !/&(?!amp;|[a-z]+;|#\d+;)/.test(홈문답));
const 스키마문답 = (faq?.mainEntity ?? []).find((q) => q.name === 질문);
봄("schema.json: 잠긴 질문", !!스키마문답);
봄("schema.json: 잠긴 답(두 문단 공백 이음)", 스키마문답?.acceptedAnswer?.text === `${답1} ${답2}`);
봄("llms.txt: 잠긴 질문", llms.includes(`**${질문}**`));
봄("llms.txt: 잠긴 답", llms.includes(`**${질문}**\n${답1}\n${답2}`));
봄("llms.txt: 잠긴 llms 절", llms.includes(llms절));
봄("llms.txt: 절 자리(AI 리터러시 뒤, FAQ 앞)",
  llms.indexOf("## AI 리터러시와 자연어 코딩") < llms.indexOf(llms절) && llms.indexOf(llms절) < llms.indexOf("## 자주 묻는 질문 (FAQ)"));

// ── 3. AI학원 자리
봄("meta title: AI학원 1번", 횟수(meta.title, "AI학원") === 1, meta.title);
봄("meta description: AI학원 1번", 횟수(meta.description, "AI학원") === 1);
봄("schema #org description: AI학원 1번", 횟수(org?.description, "AI학원") === 1);
const 이름들 = [org?.name, ...[].concat(org?.alternateName ?? [])].join(" ");
봄("schema #org name/alternateName: AI학원 없음", !!org && 횟수(이름들, "AI학원") === 0, 이름들);

// ── 4. AI 티
const 새글 = [답1, 답2, llms절];
for (const m of MARKS) {
  let 걸림 = [];
  for (const 글 of 새글) {
    if (m.seq) {
      const used = m.seq.filter((w) => new RegExp(`(^|\\n)\\s*${w}[,\\s]`).test(글));
      if (used.length >= m.min) 걸림.push(...used);
    } else {
      걸림.push(...(글.match(m.re) ?? []));
    }
  }
  봄(`MARKS ${m.why}: 0건`, 걸림.length === 0, 걸림.join(", "));
}

console.log(`\n${pass} PASS · ${fail} FAIL`);
if (fail) process.exit(1);
