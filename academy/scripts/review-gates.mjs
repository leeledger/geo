/**
 * 자동 감수(Step 43) 관문 (b)(c)(d) 의 순수 판정 — auto-post.mjs --review 가 부르고, test-post-auto.mjs 가 시험한다.
 * DB·모델 없음. (a) 출처 대조는 fact-check.mjs 출처대조() 다.
 */
import { 검사, MARKS, 문단들 } from "./slop-rules.mjs";
import { 공통짜임새 } from "./writer-common.mjs";
import { 가림검사 } from "../masks.mjs";

/** 9/28 내린 이관 글의 옛 이름 — 지금 학원이 아닌 지점·브랜드(D84·실패 모드 「재료」) */
export const 옛이름 = ["로보티즈키즈랩", "반포교육원", "2호점"];

/** 학원 홍보로 닫기 — 마지막 두 문단만 본다(CLAUDE.md 「우리 학원으로 오세요로 닫지 않는다」) */
const 홍보말 = /우리 학원|저희 학원|체험 수업|상담 문의|등록하세요|오세요|문의 주세요|연락 주세요/;

const 출처절빼기 = (본문) => String(본문 ?? "").replace(/\r/g, "").replace(/^#{1,4}\s*(?:출처|참고)\s*$[\s\S]*?(?=^#{1,4}\s|(?![\s\S]))/gm, "");
const 목록덩어리 = (p) => p.split("\n").every((l) => /^\s*(?:[-*]|\d+[.)])\s+/.test(l));

/**
 * (b) AI 티. 걸린 것을 사람 말로 돌려준다. 비었으면 통과.
 *   slop-rules 치명 · MARKS 어휘(경고까지) · 결론 반복 · 목록 남발 · 공통짜임새 · 제목 질문형 · 문단 80~400 · 소제목 4개까지 · 홍보로 닫기
 */
export function 티찾기(제목, 본문, 재료들 = []) {
  const 걸림 = [];
  const g = 검사(본문, { 재료들 });
  for (const f of g.치명) 걸림.push(`${f.why} ${f.n}곳 — ${f.sample.slice(0, 2).join(" / ")}`);
  const 어휘 = new Set([...MARKS.map((m) => m.why), "결론에서 앞 말 반복", "목록 남발"]);
  for (const f of g.경고) if (어휘.has(f.why)) 걸림.push(`${f.why} ${f.n}곳 — ${f.sample.slice(0, 2).join(" / ")}`);
  for (const s of 공통짜임새(본문)) 걸림.push(s);
  if (!/(?:\?|요|까)\s*$/.test(String(제목 ?? "").trim())) 걸림.push(`제목이 질문형이 아님 — 「${제목}」`);
  const 글 = 출처절빼기(본문);
  const 문단 = 문단들(글).filter((p) => !/^!\[[^\]]*\]\([^)]*\)$/.test(p) && !목록덩어리(p));
  const 짧은 = 문단.filter((p) => p.length < 80);
  const 긴 = 문단.filter((p) => p.length > 400);
  if (짧은.length) 걸림.push(`80자 안 되는 문단 ${짧은.length}개 — 「${짧은[0].slice(0, 30)}」`);
  if (긴.length) 걸림.push(`400자 넘는 문단 ${긴.length}개 — 「${긴[0].slice(0, 30)}…」`);
  const 소제목 = (글.match(/^##\s+.+$/gm) ?? []).length;
  if (소제목 > 4) 걸림.push(`소제목 ${소제목}개 — 4개까지`);
  const 끝문단 = 문단.slice(-2).join("\n");
  const 홍보 = 끝문단.match(홍보말);
  if (홍보) 걸림.push(`학원 홍보로 닫기 — 「${홍보[0]}」`);
  return 걸림;
}

/** (d) 가림. 다른 고객사 이름·도메인 + 옛 이름. 이 글 안의 /blog/ 내부 링크는 자기 글이라 뺀다. 비었으면 통과 */
export function 가림찾기(글, 말들) {
  return 가림검사(글, [...말들, ...옛이름]).filter((x) => !x.startsWith("모양 /blog/"));
}

/** CLAUDE.md 에서 절대 규칙·AI 티 절을 뽑는다. 못 뽑으면 null — 감수를 규칙 없이 돌리지 않는다 */
export function 원장규칙(md) {
  const t = String(md ?? "").replace(/\r/g, "");
  const 절 = (머리) => {
    const i = t.indexOf(`## ${머리}`);
    if (i < 0) return "";
    const j = t.indexOf("\n## ", i + 3);
    return t.slice(i, j < 0 ? undefined : j).trim();
  };
  const 규칙 = 절("절대 규칙");
  const 티 = 절("AI 가 쓴 티");
  if ((규칙.match(/^- /gm) ?? []).length < 6 || !티) return null;
  return { 규칙, 티 };
}

/** CLAUDE.md 「AI 가 쓴 티」 금지 줄들(대신 이렇게 앞까지) — 규칙표 시험이 쓴다 */
export function AI티줄(md) {
  const r = 원장규칙(md);
  if (!r) return [];
  const 앞 = r.티.split("**대신 이렇게**")[0];
  return 앞.split("\n").filter((l) => /^- /.test(l)).map((l) => l.slice(2).trim());
}

/** (c) 원장 관점 프롬프트. 쓰기 프롬프트를 보지 않는다 — 규칙과 버린 이유와 글만 */
export function 관점프롬프트({ 규칙, 제목, 본문, 버린이유 = [] }) {
  return [
    "너는 송파의 코딩·로봇 학원 원장이다. 이 글은 네 학원 블로그에 네 이름으로 나간다.",
    "학부모가 읽고 광고로 느낄 곳을 찾아라. 너그럽게 보지 마라 — 한 곳이라도 있으면 이 글은 안 나간다.",
    "",
    규칙.규칙,
    "",
    규칙.티,
    "",
    "## 원장이 전에 버리거나 내린 이유",
    "- 2026-09-23 관점 초안 3편 버림: AI slop · 일반론 · 억지 상황(재료 없이 지어낸 상담 장면)",
    "- 2026-09-28 이관 글 「코딩학원의 선택」 내림: 옛 지점(로보티즈키즈랩 반포교육원·헬리오시티 2호점) 이야기를 지금 학원 일처럼 씀",
    ...버린이유.map((x) => `- ${x}`),
    "",
    "## 할 일",
    "걸림: 광고로 읽히는 문장을 본문에서 그대로 베껴 종류와 함께 적는다. 종류는 광고|학원홍보마무리|불안팔기|지어낸경험|일반론|번역체 중 하나.",
    "말리기: 본문에서 독자에게 「하지 말라」「안 해도 된다」고 말리는 문장 하나를 한 글자도 바꾸지 말고 그대로 베낀다. 없으면 빈 문자열.",
    "베끼는 문장은 본문에 그대로 있어야 한다. 고쳐 쓴 문장은 없는 것으로 친다.",
    '형식: JSON 하나만 {"걸림":[{"문장":"","종류":""}],"말리기":""}',
    "",
    `# 제목\n${제목}`,
    "",
    `# 본문\n${본문}`,
  ].join("\n");
}
