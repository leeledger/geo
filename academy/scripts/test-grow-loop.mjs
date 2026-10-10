// 성과가 개수로 늘어나는 고리(Step 31) 단위 시험 — 가짜 행만, DB·네트워크 없음.
//   node academy/scripts/test-grow-loop.mjs
// D38 효과 전파 · D39 후퇴 · D40 불린 탐침 → 확장 질문 · D41 안 불린 반경 → 세션 글 · D42 경쟁사 우세 정렬 · D43 아이로그 변형 탐침
// 각각 걸리는 경우 · 안 걸리는 경우 · 표본 부족 · 엔진(곳) 바뀜. 하나라도 틀리면 종료코드 1.
import assert from "node:assert/strict";
import { CLIENTS, bySlug } from "../clients.mjs";
import { 패널 } from "./seed-ilog-panel.mjs";
import { 자기점검, 변형후보, 꼬리뺀 } from "./loop-review.mjs";
import { 전파찾기, 전파칸, 사다리짓기, 경쟁우세, 후보고르기, 불리던글, 확장줄, 승격일감, 확장넣기 } from "./loop-grow.mjs";
import { 탐침글일감 } from "./session-task.mjs";

let fail = 0, pass = 0;
const t = (name, f) => {
  try { f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};
const tt = async (name, f) => {
  try { await f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};

const 오늘 = "2026-09-30";
const 날 = (n) => {
  const d = new Date(`${오늘}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const 클 = "claude-code-headless-websearch";
const 적중 = (r) => r.cited || r.mentioned;
/** pid 한 질문의 측정 n건. hit 건은 이름이 나옴. day0 부터 하루씩 */
const 잰 = (pid, { from, n, hit, method = 클, engine = "claude-code-web", url }) => Array.from({ length: n }, (_, i) => ({
  prompt_id: pid, day: 날(from + i), collection_method: method, engine,
  mentioned: i < hit, cited: i < hit && Boolean(url), citations: i < hit && url ? [{ domain: "robotncoding.com", url }] : [], answer: "",
}));
const 기본 = { runs: [], posts: [], today: 오늘, domain: "robotncoding.com", 적중, 탐침: false };
const 동네 = { prompt_id: "q2", stage: "local", text: "석촌동 코딩학원 어디가 좋아?" };

// ── D38 효과 전파
const stageOf = { q10: "problem", q11: "problem", q12: "problem", q2: "local" };
const 있음 = { id: 7, run_day: "2026-09-01", target_prompt: "q10", action_kind: "offsite", verdict: "효과 있음" };
t("D38 걸림 — 같은 단계 안 해 본 질문은 그 처방이 첫 칸", () => {
  const 원 = 전파칸(전파찾기([있음], stageOf).get("problem"), { prompt_id: "q11" }, new Map());
  assert.equal(원.id, 7);
  assert.deepEqual(사다리짓기(["content", "discover", "offsite"], 원.action_kind), ["offsite", "content", "discover"]);
});
t("D38 안 걸림 — 이미 해 본 처방·다른 단계·원래 질문", () => {
  const m = 전파찾기([있음], stageOf);
  assert.equal(전파칸(m.get("problem"), { prompt_id: "q11" }, new Map([["offsite", "판정 전"]])), null);
  assert.equal(m.get("local"), undefined);
  assert.equal(전파칸(m.get("problem"), { prompt_id: "q10" }, new Map()), null);
  assert.deepEqual(사다리짓기(["content", "discover", "offsite"], null), ["content", "discover", "offsite"]);
});
t("D38 표본 부족 — 「표본 부족」 판정은 전파하지 않는다", () => {
  assert.equal(전파찾기([{ ...있음, verdict: "표본 부족" }], stageOf).size, 0);
});
t("D38 엔진 바뀜 — 같은 엔진 전후가 없어 판정 전인 행동은 전파하지 않는다", () => {
  assert.equal(전파찾기([{ ...있음, verdict: "판정 전" }], stageOf).size, 0);
});
t("D38 여러 개면 가장 최근 「효과 있음」", () => {
  const m = 전파찾기([{ ...있음, id: 9, run_day: "2026-09-20", action_kind: "content" }, 있음], stageOf);
  assert.equal(m.get("problem").id, 9);
});

// ── D39 후퇴
const 앞창 = (o) => 잰("q2", { from: -20, n: 8, ...o });
const 뒤창 = (o) => 잰("q2", { from: -5, n: 6, ...o });
t("D39 걸림 — 앞 14일 6/8 → 최근 7일 1/6, 불리던 글 주소", () => {
  const rows = [...앞창({ hit: 6, url: "https://robotncoding.com/blog/seokchon" }), ...뒤창({ hit: 1 })];
  const r = 자기점검({ ...기본, questions: [동네], rows });
  assert.equal(r.regress.length, 1);
  assert.deepEqual(r.regress[0].곳들[0].앞, [6, 8]);
  assert.deepEqual(r.regress[0].곳들[0].뒤, [1, 6]);
  assert.equal(r.findings[0].code, "regress");
  assert.equal(불리던글(r.regress[0].urls, [{ slug: "seokchon", title: "석촌동" }]).slug, "seokchon");
});
t("D39 안 걸림 — 최근 3/6(50%)", () => {
  const r = 자기점검({ ...기본, questions: [동네], rows: [...앞창({ hit: 6 }), ...뒤창({ hit: 3 })] });
  assert.equal(r.regress.length, 0);
  assert.equal(r.findings.some((f) => f.code === "regress"), false);
});
t("D39 안 걸림 — 앞 14일도 안 불렸다(3/8)", () => {
  const r = 자기점검({ ...기본, questions: [동네], rows: [...앞창({ hit: 3 }), ...뒤창({ hit: 0 })] });
  assert.equal(r.regress.length + r.regressUnknown.length, 0);
});
t("D39 표본 부족 — 최근 4건이면 「모른다」 finding 만(후보 순서 안 바꿈)", () => {
  const r = 자기점검({ ...기본, questions: [동네], rows: [...앞창({ hit: 6 }), ...잰("q2", { from: -3, n: 4, hit: 0 })] });
  assert.equal(r.regress.length, 0);
  assert.deepEqual(r.regressUnknown.map((u) => u.왜), ["최근 표본 모자람"]);
  const f = r.findings.find((x) => x.code === "regress-unknown");
  assert.match(f.evidence, /^비교 못 함 — q2 Claude\(최근 표본 모자람\)/);
  assert.equal(r.findings.some((x) => x.code === "regress"), false);
});
t("D39 엔진 바뀜 — 같은 곳 다른 엔진이면 비교 안 함", () => {
  const rows = [...앞창({ hit: 6, engine: "openrouter" }), ...뒤창({ hit: 0 })];
  const r = 자기점검({ ...기본, questions: [동네], rows });
  assert.equal(r.regress.length, 0);
  assert.deepEqual(r.regressUnknown.map((u) => u.왜), ["엔진 바뀜"]);
});
t("D39 후보 — 후퇴한 질문은 50% 이상이어도 맨 앞, 없으면 Step 31 전 순서", () => {
  const 표 = [
    { prompt_id: "q2", stage: "local", n: 7, rate: 60 },
    { prompt_id: "q10", stage: "problem", n: 7, rate: 0 },
    { prompt_id: "q3", stage: "local", n: 7, rate: 20 },
  ];
  const 기 = { 열림: new Set(), 버린: new Set(), 단계순: { local: 0, problem: 2 } };
  assert.deepEqual(후보고르기(표, 기).map((x) => x.prompt_id), ["q3", "q10"]);
  const 앞 = 후보고르기(표, { ...기, 후퇴: new Set(["q2"]) });
  assert.deepEqual(앞.map((x) => x.prompt_id), ["q2", "q3", "q10"]);
  assert.equal(앞[0].후퇴, true);
  // 이미 행동이 열린 질문은 후퇴여도 안 고른다
  assert.deepEqual(후보고르기(표, { ...기, 후퇴: new Set(["q2"]), 열림: new Set(["q2"]) }).map((x) => x.prompt_id), ["q3", "q10"]);
});

// ── D40 불린 탐침 → 승인 질문 후보 → 확장 질문
const 탐 = { prompt_id: "p9", source_prompt: "q2", radius: "송파", text: "송파 코딩학원 어디가 좋아?", active: true, form: "sentence" };
t("D40 걸림 — 7일 4번 재서 2번(50%)", () => {
  const r = 자기점검({ ...기본, questions: [], probes: [탐], rows: 잰("p9", { from: -5, n: 4, hit: 2 }) });
  assert.deepEqual(r.promote.map((p) => [p.prompt_id, p.hit, p.n]), [["p9", 2, 4]]);
});
t("D40 안 걸림 — 4번 중 1번 · 꺼진 탐침", () => {
  assert.equal(자기점검({ ...기본, questions: [], probes: [탐], rows: 잰("p9", { from: -5, n: 4, hit: 1 }) }).promote.length, 0);
  assert.equal(자기점검({ ...기본, questions: [], probes: [{ ...탐, active: false }], rows: 잰("p9", { from: -5, n: 4, hit: 4 }) }).promote.length, 0);
});
t("D40 표본 부족 — 3번뿐 · 15일 전 측정은 안 셈, 14일 안이면 셈(Arch 31)", () => {
  assert.equal(자기점검({ ...기본, questions: [], probes: [탐], rows: 잰("p9", { from: -5, n: 3, hit: 3 }) }).promote.length, 0);
  assert.equal(자기점검({ ...기본, questions: [], probes: [탐], rows: 잰("p9", { from: -17, n: 4, hit: 4 }) }).promote.length, 0);
  assert.equal(자기점검({ ...기본, questions: [], probes: [탐], rows: 잰("p9", { from: -13, n: 4, hit: 2 }) }).promote.length, 1);
});
t("D40 곳 바뀜 — 두 곳 2번씩은 합치지 않는다", () => {
  const rows = [...잰("p9", { from: -5, n: 2, hit: 2 }), ...잰("p9", { from: -3, n: 2, hit: 2, method: "google-ai-mode-web-logged-out", engine: "google" })];
  assert.equal(자기점검({ ...기본, questions: [], probes: [탐], rows }).promote.length, 0);
});

/** 가짜 q — 부른 SQL 을 적고, 규칙(정규식 → 돌려줄 행)대로 답한다 */
const 가짜q = (규칙 = []) => {
  const 부름 = [];
  const q = async (sql, p = []) => {
    부름.push({ sql, p });
    for (const [re, f] of 규칙) if (re.test(sql)) return typeof f === "function" ? f(p) : f;
    return [];
  };
  return { q, 부름 };
};
await tt("D40 승격 일감 — 키·제목·30일 쿨다운 조건, dry 는 안 씀", async () => {
  const p = { prompt_id: "p9", text: 탐.text, method: 클, hit: 3, n: 4 };
  const d = 가짜q();
  const r0 = await 승격일감(d.q, { clientId: 1, p, 곳이름: "Claude", DRY: true });
  assert.equal(d.부름.length, 0);
  assert.equal(r0.title, "승인 질문 후보: 「송파 코딩학원 어디가 좋아?」 (탐침 3/4)");
  const w = 가짜q([[/insert into geo.agent_tasks/, [{ id: 55 }]]]);
  const r = await 승격일감(w.q, { clientId: 1, p, 곳이름: "Claude", DRY: false });
  assert.equal(w.부름[0].p[1], "probe-promote-p9");
  assert.match(w.부름[0].sql, /interval '30 days'/);
  assert.match(w.부름[0].sql, /status = '사람 대기'/);
  assert.match(r.말, /#55/);
});
await tt("D40 「했어요」 → 확장 질문 q101 · 탐침 끔 · 다시 안 넣음", async () => {
  const 일감 = [{ id: 55, payload: { probe: "p9", text: 탐.text } }];
  const w = 가짜q([
    [/kind='probe-promote' and status='완료'/, 일감],
    [/from geo.pilots/, [{ id: 3 }]],
    [/stage='extend'/, []],
    [/greatest/, [{ n: 101 }]],
  ]);
  const 줄 = await 확장넣기(w.q, { clientId: 1, 오늘, DRY: false });
  assert.match(줄[0], /확장 질문 q101/);
  const 넣음 = w.부름.find((c) => /insert into geo.pilot_questions/.test(c.sql));
  assert.deepEqual(넣음.p, [3, 101, 탐.text]);
  assert.match(넣음.sql, /'extend', \$3, false/);
  assert.ok(w.부름.some((c) => /set active=false/.test(c.sql) && c.p[1] === "p9"));
  assert.ok(w.부름.some((c) => /payload \|\| \$2::jsonb/.test(c.sql) && c.p[1] === JSON.stringify({ extend: 101 })));
  // dry 는 읽기만
  const d = 가짜q([[/kind='probe-promote' and status='완료'/, 일감]]);
  assert.match((await 확장넣기(d.q, { clientId: 1, 오늘, DRY: true }))[0], /\(dry\)/);
  assert.equal(d.부름.length, 1);
  // 같은 글자의 확장 질문이 있으면 새로 안 넣는다
  const s = 가짜q([
    [/kind='probe-promote' and status='완료'/, 일감],
    [/from geo.pilots/, [{ id: 3 }]],
    [/stage='extend'/, [{ position: 104, text: "송파 코딩학원, 어디가 좋아?" }]],
  ]);
  assert.match((await 확장넣기(s.q, { clientId: 1, 오늘, DRY: false }))[0], /q104/);
  assert.equal(s.부름.some((c) => /insert into geo.pilot_questions/.test(c.sql)), false);
});
await tt("D40 파일럿 없음 — 못 넣었다고 적고 아무것도 안 씀", async () => {
  const w = 가짜q([[/kind='probe-promote' and status='완료'/, [{ id: 55, payload: { probe: "p9", text: "x" } }]]]);
  assert.match((await 확장넣기(w.q, { clientId: 1, 오늘, DRY: false }))[0], /파일럿이 없어/);
  assert.equal(w.부름.some((c) => /insert|update/.test(c.sql)), false);
});
t("D40 확장줄 — n개 중 k개 불림 · 덜 잰 것 · 곳 안 합침 · 없으면 null", () => {
  const qs = [{ prompt_id: "q101" }, { prompt_id: "q102" }, { prompt_id: "q103" }];
  const rows = [
    ...잰("q101", { from: -3, n: 2, hit: 1 }),
    ...잰("q102", { from: -3, n: 3, hit: 1 }),
    ...잰("q103", { from: -1, n: 1, hit: 1 }),
  ];
  assert.equal(확장줄(qs, rows), "확장 질문 3개 중 1개 불림(최근 7일 · 1개는 아직 덜 잼)");
  assert.equal(확장줄([], rows), null);
  const 두곳 = [...잰("q101", { from: -3, n: 1, hit: 1 }), ...잰("q101", { from: -2, n: 1, hit: 1, method: "gemini-web-logged-out" })];
  assert.equal(확장줄([{ prompt_id: "q101" }], 두곳), "확장 질문 1개 중 0개 불림(최근 7일 · 1개는 아직 덜 잼)");
});

// ── D41 안 불린 반경
const 사슬탐침 = [
  { prompt_id: "p5", source_prompt: "q2", radius: "송파", text: "송파 코딩학원 어디가 좋아?", active: true, form: "sentence" },
  { prompt_id: "p8", source_prompt: "p5", radius: "서울", text: "서울 코딩학원 어디가 좋아?", active: true, form: "sentence" },
];
const 사슬 = (p8) => 자기점검({ ...기본, 탐침: true, 새탐침한도: 0, questions: [동네], probes: 사슬탐침, rows: [...잰("q2", { from: -5, n: 4, hit: 4 }), ...잰("p5", { from: -5, n: 4, hit: 3 }), ...p8] });
t("D41 걸림 — 송파 3/4 → 서울 0/4 이면 서울 칸", () => {
  const r = 사슬(잰("p8", { from: -5, n: 4, hit: 0 }));
  assert.deepEqual(r.gaps.map((g) => [g.prompt_id, g.radius, g.n, g.root]), [["p8", "서울", 4, "q2"]]);
});
t("D41 안 걸림 — 서울 1/4", () => assert.equal(사슬(잰("p8", { from: -5, n: 4, hit: 1 })).gaps.length, 0));
t("D41 표본 부족 — 서울 0/3 은 기다린다", () => assert.equal(사슬(잰("p8", { from: -5, n: 3, hit: 0 })).gaps.length, 0));
t("D41 곳 바뀜 — 문장 사슬은 Claude 로만 본다(다른 곳 0/4 는 안 셈)", () => {
  assert.equal(사슬(잰("p8", { from: -5, n: 4, hit: 0, method: "chatgpt-web-logged-out", engine: "chatgpt" })).gaps.length, 0);
});
const 칸 = { prompt_id: "p8", text: "서울 코딩학원 어디가 좋아?", radius: "서울", method: 클, n: 4, root: "q2" };
const 학원 = { id: 1, name: "로봇&코딩학원" };
await tt("D41·D60 일감 — 열린 세션 글이 있으면 새로 안 열고 그 일감에 묶는다", async () => {
  const w = 가짜q([[/status='세션 대기'\s+order by created_at, id limit 1/, [{ id: 40, payload: { question: "코딩학원 고르는 법" } }]]]);
  const r = await 탐침글일감(w.q, { c: 학원, 설정: bySlug("robotncoding", CLIENTS).loop, gap: 칸, 곳이름: "Claude", 오늘, DRY: false });
  assert.equal(r.id, null);
  assert.match(r.말, /#40 에 「서울 코딩학원 어디가 좋아\?」 묶음/);
  assert.equal(w.부름.some((c) => /insert/.test(c.sql)), false);
  const 묶음 = w.부름.find((c) => /jsonb_build_object\('questions'/.test(c.sql));
  assert.deepEqual(JSON.parse(묶음.p[1]), ["코딩학원 고르는 법", "서울 코딩학원 어디가 좋아?"]);
});
await tt("D41 일감 — 재료 없으면 「재료 필요」, 있으면 재료로만", async () => {
  const w = 가짜q([[/academy.materials/, [{ n: 0 }]], [/insert into geo.agent_tasks/, [{ id: 61 }]]]);
  const r = await 탐침글일감(w.q, { c: 학원, 설정: bySlug("robotncoding", CLIENTS).loop, gap: 칸, 곳이름: "Claude", 오늘, DRY: false });
  assert.equal(r.id, 61);
  const 넣음 = w.부름.find((c) => /insert into geo.agent_tasks/.test(c.sql));
  assert.equal(넣음.p[2], "세션에서 로봇&코딩학원 글 초안: 「서울 코딩학원 어디가 좋아?」 — 재료 필요");
  assert.match(넣음.p[3], /재료 필요/);
  assert.equal(JSON.parse(넣음.p[5]).probe, "p8");
  const m = 가짜q([[/academy.materials/, [{ n: 2 }]], [/insert into geo.agent_tasks/, [{ id: 62 }]]]);
  await 탐침글일감(m.q, { c: 학원, 설정: bySlug("robotncoding", CLIENTS).loop, gap: 칸, 곳이름: "Claude", 오늘, DRY: false });
  assert.doesNotMatch(m.부름.find((c) => /insert into geo.agent_tasks/.test(c.sql)).p[2], /재료 필요/);
});
await tt("D41 일감 — dry 는 닫기·쓰기 없음, 같은 문장 일감이 있으면 안 연다", async () => {
  const d = 가짜q([[/academy.materials/, [{ n: 0 }]]]);
  const r = await 탐침글일감(d.q, { c: 학원, 설정: bySlug("robotncoding", CLIENTS).loop, gap: 칸, 곳이름: "Claude", 오늘, DRY: true });
  assert.match(r.말, /^\(dry\)/);
  assert.equal(d.부름.some((c) => /^\s*(update|insert)/.test(c.sql)), false);
  const s = 가짜q([[/kind='question-draft' and \(regexp_replace/, [{ id: 12, status: "완료" }]]]);
  const r2 = await 탐침글일감(s.q, { c: 학원, 설정: bySlug("robotncoding", CLIENTS).loop, gap: 칸, 곳이름: "Claude", 오늘, DRY: false });
  assert.match(r2.말, /#12\(완료\)/);
});

// ── D42 경쟁사 우세
const 답 = (s) => ({ answer: s });
const 우리 = bySlug("robotncoding", CLIENTS).answerRe;
t("D42 걸림 — 경쟁사 3번 − 우리 1번 = 2, 같은 단계에서 먼저", () => {
  const rows = [답("코딩나라 추천"), 답("코딩나라, 로봇앤코딩학원"), 답("코딩 나라가 좋아요"), 답("없음")];
  assert.equal(경쟁우세(rows, 우리, ["코딩나라"]), 2);
  const 표 = [{ prompt_id: "q5", stage: "problem", n: 7, rate: 0 }, { prompt_id: "q6", stage: "problem", n: 7, rate: 20 }];
  const 기 = { 열림: new Set(), 버린: new Set(), 단계순: { problem: 2 } };
  assert.deepEqual(후보고르기(표, { ...기, 우세: { q5: 0, q6: 2 } }).map((x) => x.prompt_id), ["q6", "q5"]);
  assert.deepEqual(후보고르기(표, 기).map((x) => x.prompt_id), ["q5", "q6"]);
});
t("D42 안 걸림 — 경쟁사 미설정이면 0 · 단계가 먼저", () => {
  assert.equal(경쟁우세([답("코딩나라")], 우리, []), 0);
  const 표 = [{ prompt_id: "q6", stage: "problem", n: 7, rate: 20 }, { prompt_id: "q1", stage: "local", n: 7, rate: 40 }];
  assert.deepEqual(후보고르기(표, { 열림: new Set(), 버린: new Set(), 단계순: { local: 0, problem: 2 }, 우세: { q6: 5 } }).map((x) => x.prompt_id), ["q1", "q6"]);
});
t("D42 표본 부족 — 답 원문이 없으면 0", () => {
  assert.equal(경쟁우세([답(""), { answer: null }], 우리, ["코딩나라"]), 0);
});

// ── D43 아이로그 변형 탐침
const 아이로그 = bySlug("ilog", CLIENTS);
const 승인 = 패널.map(([stage, text], i) => ({ prompt_id: `q${i + 1}`, stage, text }));
t("D43 기능 말은 승인 검색어에서만 — 새 말 없음", () => {
  const v = 변형후보(승인, 아이로그.loop.probeVariants);
  const 기능들 = [...new Set(v.map((x) => x.text.replace(/ (앱|프로그램|무료)$/, "")))];
  assert.deepEqual(기능들, ["학원 관리", "학원 출결 관리", "학원 카톡 알림", "학원 수업 리포트"]);
  const 승인말 = 승인.filter((x) => x.stage === "keyword").map((x) => x.text).join(" ");
  for (const f of 기능들) assert.ok(승인말.includes(f), f);
});
t("D43 걸림 — 하루 한도 2개, 승인 질문과 같은 글은 안 만든다", () => {
  const r = 자기점검({ ...기본, domain: "ilog.ai.kr", questions: 승인, rows: [], 탐침: "variants", 변형: 아이로그.loop.probeVariants, 새탐침한도: 2 });
  assert.deepEqual(r.probes.map((p) => p.text), ["학원 관리 앱", "학원 관리 무료"]); // 「학원 관리 프로그램」 = q13 에서 「추천」 뺀 것 — 안 만듦
  assert.ok(r.probes.every((p) => p.form === "keyword" && p.source_prompt === "q13"));
  const 많이 = 자기점검({ ...기본, domain: "ilog.ai.kr", questions: 승인, rows: [], 탐침: "variants", 변형: 아이로그.loop.probeVariants, 새탐침한도: 99 });
  assert.equal(많이.probes.some((p) => p.text === "학원 출결 관리 앱"), false); // 승인 q15 와 같은 글
  assert.equal(많이.probes.length, 8);
  // 확장 질문과 꼬리말 빼고 같아도 안 만든다
  const 확장 = 자기점검({ ...기본, domain: "ilog.ai.kr", questions: 승인, rows: [], 탐침: "variants", 변형: 아이로그.loop.probeVariants, 새탐침한도: 99, 확장들: ["학원 관리 앱 추천 좀 해줘"] });
  assert.equal(확장.probes.some((p) => p.text === "학원 관리 앱"), false);
  assert.equal(확장.probes.length, 7);
  assert.equal(많이.findings.some((f) => f.code === "widen"), false); // 송파 넓힘은 안 돈다
});
t("D43 안 걸림 — 오늘 한도를 다 썼거나 이미 다 만들었다", () => {
  const r0 = 자기점검({ ...기본, domain: "ilog.ai.kr", questions: 승인, rows: [], 탐침: "variants", 변형: 아이로그.loop.probeVariants, 새탐침한도: 0 });
  assert.equal(r0.probes.length, 0);
  const 다 = 변형후보(승인, 아이로그.loop.probeVariants).map((v, i) => ({ prompt_id: `p${i + 1}`, text: v.text, source_prompt: v.source_prompt, active: true, form: "keyword" }));
  assert.equal(자기점검({ ...기본, domain: "ilog.ai.kr", questions: 승인, probes: 다, rows: [], 탐침: "variants", 변형: 아이로그.loop.probeVariants }).probes.length, 0);
});
t("D43 표본 부족·곳 바뀜 — 근거 줄은 Claude 로 잰 변형만, 안 잰 건 「아직 잰 변형 없음」", () => {
  const 다 = [{ prompt_id: "p1", text: "학원 관리 앱", source_prompt: "q13", active: true, form: "keyword" }];
  const r = 자기점검({ ...기본, domain: "ilog.ai.kr", questions: 승인, probes: 다, rows: 잰("p1", { from: -2, n: 2, hit: 0, method: "gemini-web-logged-out" }), 탐침: "variants", 변형: 아이로그.loop.probeVariants, 새탐침한도: 1 });
  assert.match(r.findings.find((f) => f.code === "variant").evidence, /^아직 잰 변형 없음/);
  const r2 = 자기점검({ ...기본, domain: "ilog.ai.kr", questions: 승인, probes: 다, rows: 잰("p1", { from: -2, n: 2, hit: 1 }), 탐침: "variants", 변형: 아이로그.loop.probeVariants, 새탐침한도: 0 });
  assert.match(r2.findings.find((f) => f.code === "variant").evidence, /「학원 관리 앱」 1\/2/);
});
const 변형탐 = { prompt_id: "p3", source_prompt: "q13", radius: "변형", text: "학원 관리 앱", active: true, form: "keyword" };
const 변형빈칸 = (rows) => 자기점검({ ...기본, domain: "ilog.ai.kr", questions: 승인, probes: [변형탐], rows, 탐침: "variants", 변형: 아이로그.loop.probeVariants, 새탐침한도: 0 }).gaps;
t("D41 아이로그 걸림 — 변형이 14일 4번 모두 0 이면 세션 글 칸", () => {
  assert.deepEqual(변형빈칸(잰("p3", { from: -12, n: 4, hit: 0 })).map((g) => [g.prompt_id, g.n, g.root]), [["p3", 4, "q13"]]);
});
t("D41 아이로그 안 걸림·표본 부족·곳 바뀜", () => {
  assert.equal(변형빈칸(잰("p3", { from: -12, n: 4, hit: 1 })).length, 0);
  assert.equal(변형빈칸(잰("p3", { from: -12, n: 3, hit: 0 })).length, 0);
  assert.equal(변형빈칸([...잰("p3", { from: -12, n: 2, hit: 0 }), ...잰("p3", { from: -5, n: 2, hit: 0, method: "gemini-web-logged-out" })]).length, 0);
  assert.equal(변형빈칸(잰("p3", { from: -20, n: 4, hit: 0 })).length, 0); // 15일 넘은 측정
});
t("꼬리뺀 — 띄어쓰기·꼬리말", () => {
  assert.equal(꼬리뺀("학원 관리 프로그램 추천 좀 해줘"), "학원관리프로그램");
  assert.equal(꼬리뺀("추천 학원"), "추천학원");
});
t("D43 학원은 그대로 넓힘(변형 안 만듦)", () => {
  const r = 자기점검({ ...기본, 탐침: bySlug("robotncoding", CLIENTS).loop.probes, questions: [], rows: [] });
  assert.equal(r.probes.length, 3);
  assert.ok(r.probes.every((p) => p.seed));
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
