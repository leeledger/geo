// 아이로그를 학원과 같은 수준으로(Step 30) 단위 시험 — 가짜 행만, DB·네트워크 없음.
//   node academy/scripts/test-ilog-loop.mjs
// 1) 질문 패널 20개 모양  2) 이름 판별 말(오탐)  3) 고객별 루프 설정(이름 질문 적중·홈 JSON-LD)
// 4) 자기 점검 — 탐침 끄기·검색어형 묶음  5) 세션 글 일감 제목  6) 측정 예산 두 배 조건·순서
// 7) 「세션 대기」 생애주기(열기·재사용·끝냄·판정 찾기·dry) — 가짜 q
// 8) 고객당 열린 세션 글 1개 — 묶기(Step 40 D60)  9) 나이로 안 닫음
// 하나라도 틀리면 종료코드 1.
import assert from "node:assert/strict";
import { CLIENTS, bySlug, 세션글제목 } from "../clients.mjs";
import { 패널, 이름말 } from "./seed-ilog-panel.mjs";
import { 자기점검 } from "./loop-review.mjs";
import { 대상고르기, 고객수, 측정상한 } from "../measure-targets.mjs";
import fs from "node:fs";
import { 세션일감열기, 세션완료찾기, 세션끝냄, 같은질문일감, 세션글키, 세션일감묶기, 묶음상한, 탐침글일감 } from "./session-task.mjs";

let fail = 0, pass = 0;
const t = (name, f) => {
  try { f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};
const tt = async (name, f) => {
  try { await f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};
const 학원 = bySlug("robotncoding", CLIENTS), 아이로그 = bySlug("ilog", CLIENTS);

// ── 1. 패널
t("질문 20개", () => assert.equal(패널.length, 20));
t("질문 글 겹침 없음", () => assert.equal(new Set(패널.map(([, x]) => x)).size, 20));
t("단계 consider 7 · problem 5 · keyword 5 · brand 3", () => {
  const 셈 = 패널.reduce((m, [s]) => ((m[s] = (m[s] ?? 0) + 1), m), {});
  assert.deepEqual(셈, { consider: 7, problem: 5, keyword: 5, brand: 3 });
});
t("질문마다 출처가 적혀 있음", () => { for (const [, x, 출처] of 패널) assert.ok(출처?.trim(), x); });
t("이름 질문에만 이름이 들어 있음", () => {
  const re = new RegExp(이름말(), "i");
  for (const [s, x] of 패널) assert.equal(re.test(x), s === "brand", x);
});

// ── 2. 이름 판별 말
const 이름 = new RegExp(이름말(), "i");
t("「아이로그」를 센다", () => assert.ok(이름.test("학원 관리 프로그램으로는 클래스업, 아이로그 등이 있습니다")));
t("도메인을 센다", () => assert.ok(이름.test("자세한 요금은 https://ilog.ai.kr/guides 에 있습니다")));
t("「(주)·㈜·주식회사 아이로그」(동명 SI 회사)는 안 센다", () => {
  assert.equal(이름.test("(주)아이로그는 시스템 통합 회사입니다"), false);
  assert.equal(이름.test("(주) 아이로그 본사"), false);
  assert.equal(이름.test("㈜아이로그는 SI 업체입니다"), false);
  assert.equal(이름.test("주식회사 아이로그 채용"), false);
});
t("「ilog」 단독(IBM ILOG)·다른 도메인은 안 센다", () => {
  assert.equal(이름.test("IBM ILOG CPLEX Optimization Studio"), false);
  assert.equal(이름.test("ilog.co.kr 에서 확인하세요"), false);
});
t("clients.mjs 와 seed 가 같은 원문", () => assert.equal(이름말(), 아이로그.answerRe.source));

// ── 3. 고객별 루프 설정
t("학원 설정은 Step 30 전 값 그대로", () => {
  assert.equal(학원.loop.brandHit.source, "석촌");
  assert.deepEqual(학원.loop.homeLd.map((r) => r.source), ['"address"', "석촌|송파"]);
  assert.equal(학원.loop.draft, "write-draft");
  assert.equal(학원.loop.probes, true);
});
t("아이로그 이름 질문 적중은 기능 말", () => {
  assert.ok(아이로그.loop.brandHit.test("아이로그는 출결 키패드와 알림톡을 지원합니다"));
  assert.equal(아이로그.loop.brandHit.test("아이로그는 포항의 미용실입니다"), false);
});
const LD_학원 = '{"@type":"EducationalOrganization","address":{"streetAddress":"서울 송파구 석촌동"}}';
const LD_아이로그 = '{"@type":"SoftwareApplication","name":"아이로그","url":"https://ilog.ai.kr"}';
const 통과 = (설정, ld) => 설정.homeLd.every((re) => re.test(ld));
t("홈 JSON-LD 검사는 고객 것만 통과", () => {
  assert.ok(통과(학원.loop, LD_학원));
  assert.ok(통과(아이로그.loop, LD_아이로그));
  assert.equal(통과(학원.loop, LD_아이로그), false);
  assert.equal(통과(아이로그.loop, LD_학원), false);
});
t("글 쓰는 길 — 아이로그는 세션, 쓸 곳이 적혀 있음", () => {
  assert.equal(아이로그.loop.draft, "session");
  assert.match(아이로그.loop.draftWhere, /guides\.ts/);
  assert.equal(아이로그.loop.probes, "variants"); // Step 31 D43 — 송파 넓힘 대신 검색어 변형
  for (const c of [학원, 아이로그]) assert.equal(c.loop.offsite.length, 2);
});

// ── 4. 자기 점검
const 오늘 = "2026-09-30";
const 기본 = { runs: [], posts: [], today: 오늘, 적중: (r) => r.cited || r.mentioned };
t("탐침 기본값(학원) — 검색어 씨앗 3개를 만든다", () => {
  const r = 자기점검({ ...기본, questions: [], rows: [], domain: "robotncoding.com" });
  assert.equal(r.probes.length, 3);
  assert.ok(r.findings.some((f) => f.code === "widen"));
});
t("탐침 끔(아이로그) — 송파 씨앗·넓힘을 안 만든다", () => {
  const r = 자기점검({ ...기본, questions: [{ prompt_id: "q1", stage: "local", text: "송파구 코딩학원" }], rows: [], domain: "ilog.ai.kr", 탐침: false });
  assert.equal(r.probes.length, 0);
  assert.equal(r.findings.some((f) => f.code === "widen"), false);
});
t("검색어형(keyword)은 일반 질문 묶음으로 센다", () => {
  const rows = [];
  for (let i = 0; i < 10; i++) {
    const day = `2026-09-${String(20 + (i % 9)).padStart(2, "0")}`;
    rows.push({ prompt_id: "q1", day, collection_method: "claude-code-headless-websearch", mentioned: false, cited: false, citations: [] });
    rows.push({ prompt_id: "q2", day, collection_method: "claude-code-headless-websearch", mentioned: true, cited: false, citations: [] });
  }
  const r = 자기점검({ ...기본, questions: [{ prompt_id: "q1", stage: "keyword", text: "학원 출결 관리 앱" }, { prompt_id: "q2", stage: "brand", text: "아이로그" }],
    rows, domain: "ilog.ai.kr", 탐침: false });
  const n = r.findings.find((f) => f.code === "narrow");
  assert.ok(n, "narrow 없음");
  assert.match(n.title, /^일반 질문 1개/);
});

// ── 5. 세션 글 일감 제목
t("세션 글 제목", () => assert.equal(세션글제목("아이로그", "학원 출결 관리 앱 뭐가 있어요?"), "세션에서 아이로그 가이드 초안: 「학원 출결 관리 앱 뭐가 있어요?」"));

// ── 6. 측정 예산(Step 32 D45 — 학원 밖 고객 수 k 만큼, 순서 유료 → 학원 → 자사)
const 행 = (o) => ({ answer_pattern: null, measure_active: false, relation: "외부", price: 0, started_on: null, ends_on: null,
  kickoff_on: null, needs_build: "none", site_launch_on: null, cancelled_on: null, approved_n: 0, ...o });
const 학원행 = 행({ id: 1, slug: "robotncoding", name: "학원", domain: "robotncoding.com", relation: "자사", price: 0, started_on: "2026-09-17", ends_on: "2026-10-17", approved_n: 20 });
const 아이로그행 = (n) => 행({ id: 2, slug: "ilog", name: "아이로그", domain: "ilog.ai.kr", relation: "자사", measure_active: true, started_on: "2026-09-30", ends_on: "2026-10-30", approved_n: n });
const 유료행 = 행({ id: 3, slug: "paid", name: "유료", domain: "paid.example", price: 390000, started_on: "2026-09-25", ends_on: "2026-10-24", approved_n: 20 });
// Step 32 D45 — 상한은 고객 수 k 로. k=0·1 은 Step 30 값 그대로여야 한다
t("학원만 있는 날 — k=0 · 40·22·60 그대로", () => {
  assert.equal(고객수(대상고르기([학원행], 오늘)), 0);
  assert.deepEqual(측정상한(0, {}), { claude: 40, reserve: 22, web: 60 });
});
t("아이로그 승인 질문 0개 — k=0", () => assert.equal(고객수(대상고르기([학원행, 아이로그행(0)], 오늘)), 0));
t("아이로그 승인 질문 있음 — k=1 · 60·42·120", () => {
  assert.equal(고객수(대상고르기([학원행, 아이로그행(20)], 오늘)), 1);
  assert.deepEqual(측정상한(1, {}), { claude: 60, reserve: 42, web: 120 });
});
t("유료 고객 — k=1(전과 같음)", () => assert.equal(고객수(대상고르기([학원행, 유료행], 오늘)), 1));
t("순서 유료 → 학원 → 자사", () => {
  assert.deepEqual(대상고르기([아이로그행(20), 학원행, 유료행], 오늘).map((r) => `${r.묶음}:${r.slug}`), ["유료:paid", "학원:robotncoding", "자사:ilog"]);
});

// ── 7. 「세션 대기」 생애주기 — 가짜 q (agent_tasks 를 메모리에 둔다)
const 가짜db = (행들 = []) => {
  const 표 = 행들.map((r) => ({ ...r }));
  const 씀 = [];
  let 다음 = 900;
  const 글 = (s) => String(s ?? "").replace(/[^가-힣a-zA-Z0-9]/g, "");
  const q = async (sql, p = []) => {
    const s = sql.replace(/\s+/g, " ");
    // 질문 글자가 payload.question 이나 묶인 payload.questions 중 하나와 같다(Step 40)
    const 같은 = (r) => r.client_id === p[0] && r.kind === "question-draft"
      && [r.payload?.question, ...(r.payload?.questions ?? [])].some((x) => 글(x) === p[1]);
    if (/^select id, status, dedupe_key/.test(s)) {
      return 표.filter(같은).sort((a, b) => (b.status === "세션 대기") - (a.status === "세션 대기") || a.id - b.id).slice(0, 1)
        .map((r) => ({ id: r.id, status: r.status, dedupe_key: r.dedupe_key, question: r.payload?.question ?? null }));
    }
    if (/^select id, done_at/.test(s)) {
      return 표.filter((r) => 같은(r) && r.status === "완료" && r.done_day >= p[2]).slice(0, 1).map((r) => ({ id: r.id, done_at: r.done_at }));
    }
    if (/^select id, payload from geo\.agent_tasks .*status='세션 대기' order by created_at, id limit 1/.test(s)) {
      return 표.filter((r) => r.client_id === p[0] && r.kind === "question-draft" && r.status === "세션 대기")
        .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || a.id - b.id).slice(0, 1)
        .map((r) => ({ id: r.id, payload: r.payload }));
    }
    씀.push(s);
    if (/^update geo\.agent_tasks set payload = payload \|\| jsonb_build_object\('questions'/.test(s)) {
      const r = 표.find((x) => x.id === p[0]);
      r.payload = { ...r.payload, questions: JSON.parse(p[1]) };
      r.evidence = `${r.evidence ?? ""}${p[2]}`;
      return [];
    }
    if (/^update geo\.agent_tasks set updated_at=now\(\), evidence/.test(s)) {
      const r = 표.find((x) => x.id === p[0]);
      r.evidence = `${r.evidence ?? ""}${p[1]}`;
      return [];
    }
    if (/^update geo\.agent_tasks set status='세션 대기'/.test(s)) {
      const r = 표.find((x) => x.id === p[0]);
      Object.assign(r, { status: "세션 대기", title: p[1], done_at: null });
      return [];
    }
    if (/^insert into geo\.agent_tasks/.test(s)) {
      const 있음 = 표.find((x) => x.client_id === p[0] && x.dedupe_key === p[1]);
      if (있음) { Object.assign(있음, { status: "세션 대기", title: p[2] }); return [{ id: 있음.id }]; }
      const r = { id: ++다음, client_id: p[0], kind: "question-draft", dedupe_key: p[1], title: p[2], status: "세션 대기", payload: JSON.parse(p[5]) };
      표.push(r);
      return [{ id: r.id }];
    }
    if (/^update geo\.agent_tasks set status='완료'/.test(s)) {
      const r = 표.find((x) => x.id === p[0] && x.kind === "question-draft" && x.status === "세션 대기");
      if (!r) return [];
      Object.assign(r, { status: "완료", done_at: "2026-10-02T03:00:00Z", done_day: "2026-10-02" });
      return [{ id: r.id }];
    }
    throw new Error(`시험이 모르는 SQL: ${s.slice(0, 60)}`);
  };
  return { q, 표, 씀 };
};
const 고객 = { id: 2, name: "아이로그" };
const 문항 = { prompt_id: "q15", text: "학원 출결 관리 앱", stage: "keyword", hit: 0, n: 7 };
const 여는값 = (db, x = 문항, DRY = false) => 세션일감열기(db.q, { c: 고객, 설정: 아이로그.loop, x, 경쟁: ["checkbus.co.kr"], 오늘: "2026-09-30", DRY });
await tt("열기 — 없으면 질문 키로 새로, 세션 대기", async () => {
  const db = 가짜db();
  const r = await 여는값(db);
  assert.equal(db.표.length, 1);
  assert.equal(db.표[0].status, "세션 대기");
  assert.equal(db.표[0].dedupe_key, 세션글키("학원 출결 관리 앱"));
  assert.equal(db.표[0].title, "세션에서 아이로그 가이드 초안: 「학원 출결 관리 앱」");
  assert.match(r.말, /새로 만듦/);
});
await tt("열기 — 같은 질문(띄어쓰기·물음표 달라도)이면 있는 일감을 다시 엶, 키 그대로", async () => {
  const db = 가짜db([{ id: 757, client_id: 2, kind: "question-draft", dedupe_key: "qdraft-2d7b9975ae", status: "관찰", payload: { question: "학원 출결관리 앱?" } }]);
  const r = await 여는값(db);
  assert.equal(db.표.length, 1);
  assert.equal(db.표[0].status, "세션 대기");
  assert.equal(db.표[0].dedupe_key, "qdraft-2d7b9975ae");
  assert.equal(r.id, 757);
});
await tt("열기 dry — 안 씀", async () => {
  const db = 가짜db();
  const r = await 여는값(db, 문항, true);
  assert.equal(db.씀.length, 0);
  assert.match(r.말, /^\(dry\)/);
});
await tt("같은질문일감 — 회사 루프가 찾는 것과 같은 일감", async () => {
  const db = 가짜db([{ id: 28, client_id: 2, kind: "question-draft", dedupe_key: "qdraft-ef37aa752c", status: "세션 대기", payload: { question: "학원 관리 프로그램 뭐가 좋은가요?" } }]);
  assert.equal((await 같은질문일감(db.q, 2, "학원 관리 프로그램, 뭐가 좋은가요"))?.dedupe_key, "qdraft-ef37aa752c");
  assert.equal(await 같은질문일감(db.q, 2, "다른 질문"), undefined);
});
t("세션글키 — 질문 글자 기준", () => {
  assert.equal(세션글키("학원 출결 관리 앱"), 세션글키("학원출결관리앱?"));
  assert.notEqual(세션글키("학원 출결 관리 앱"), 세션글키("학원 카톡 알림 프로그램"));
});
await tt("끝냄 — 근거 없으면 거부하고 안 씀", async () => {
  const db = 가짜db();
  await 여는값(db);
  const r = await 세션끝냄(db.q, { id: db.표[0].id, 근거: "  ", 시각: "2026-10-02 12:00", DRY: false });
  assert.equal(r.ok, false);
  assert.equal(db.표[0].status, "세션 대기");
});
await tt("끝냄 dry — 안 씀", async () => {
  const db = 가짜db();
  await 여는값(db);
  const 전 = db.씀.length;
  const r = await 세션끝냄(db.q, { id: db.표[0].id, 근거: "guides.ts 추가·배포", 시각: "2026-10-02 12:00", DRY: true });
  assert.equal(r.ok, true);
  assert.equal(db.씀.length, 전);
  assert.equal(db.표[0].status, "세션 대기");
});
await tt("끝냄 → 판정: run_day 이후 완료만 찾는다", async () => {
  const db = 가짜db();
  await 여는값(db);
  const r = await 세션끝냄(db.q, { id: db.표[0].id, 근거: "guides.ts 추가·배포", 시각: "2026-10-02 12:00", DRY: false });
  assert.equal(r.ok, true);
  assert.equal(db.표[0].status, "완료");
  assert.equal((await 세션완료찾기(db.q, 2, "학원 출결 관리 앱", "2026-09-30"))?.id, db.표[0].id);
  assert.equal(await 세션완료찾기(db.q, 2, "학원 출결 관리 앱", "2026-10-05"), undefined);
});
await tt("끝냄 — 세션 대기가 아니면(이미 완료) 없다고 답함", async () => {
  const db = 가짜db([{ id: 29, client_id: 2, kind: "question-draft", status: "완료", payload: { question: "x" } }]);
  const r = await 세션끝냄(db.q, { id: 29, 근거: "근거", 시각: "2026-10-02 12:00", DRY: false });
  assert.equal(r.ok, false);
});
// ── 8. 고객당 열린 세션 글 1개 — 묶기(Step 40 D60)
const 열린28 = () => ({ id: 28, client_id: 2, kind: "question-draft", dedupe_key: "qdraft-ef37aa752c", status: "세션 대기",
  created_at: "2026-09-17T01:00:00Z", payload: { question: "학원 관리 프로그램 뭐가 좋은가요?" } });
const 묶기값 = (db, 질문, DRY = false) => 세션일감묶기(db.q, { c: 고객, 질문, 출처: "탐침 p3", 오늘: "2026-10-10", DRY });
await tt("묶기 — 열린 것이 있으면 questions 에 대표 질문과 함께 덧붙임·evidence", async () => {
  const db = 가짜db([열린28()]);
  const r = await 묶기값(db, "학원 출결 관리 앱");
  assert.deepEqual(r, { id: 28, 말: "열린 세션 글 일감 #28 에 「학원 출결 관리 앱」 묶음", 묶음: true });
  assert.deepEqual(db.표[0].payload.questions, ["학원 관리 프로그램 뭐가 좋은가요?", "학원 출결 관리 앱"]);
  assert.match(db.표[0].evidence, /2026-10-10 탐침 p3 질문 묶음: 「학원 출결 관리 앱」/);
});
await tt("묶기 — 같은 질문(글자 기준)이면 안 늘어남", async () => {
  const db = 가짜db([열린28()]);
  await 묶기값(db, "학원 출결 관리 앱");
  const 전 = db.씀.length;
  const r = await 묶기값(db, "학원출결 관리앱?");
  assert.equal(r.묶음, true);
  assert.equal(db.표[0].payload.questions.length, 2);
  assert.equal(db.씀.length, 전);
  const r2 = await 묶기값(db, "학원 관리 프로그램, 뭐가 좋은가요");
  assert.equal(db.표[0].payload.questions.length, 2, r2.말);
});
await tt("묶기 — 상한 15 넘으면 안 넣고 evidence 「상한 — 안 묶음」, 묶음 false", async () => {
  const 열 = 열린28();
  열.payload.questions = Array.from({ length: 묶음상한 }, (_, i) => `질문 ${i}`);
  const db = 가짜db([열]);
  const r = await 묶기값(db, "열여섯째 질문");
  assert.equal(r.묶음, false);
  assert.equal(db.표[0].payload.questions.length, 15);
  assert.match(db.표[0].evidence, /상한 — 안 묶음: 「열여섯째 질문」/);
});
await tt("묶기 — 열린 것이 없으면 undefined, dry 는 안 씀", async () => {
  assert.equal(await 묶기값(가짜db(), "학원 출결 관리 앱"), undefined);
  const db = 가짜db([열린28()]);
  const r = await 묶기값(db, "학원 출결 관리 앱", true);
  assert.match(r.말, /^\(dry\)/);
  assert.equal(db.씀.length, 0);
});
await tt("같은질문일감 — 묶인 questions 안의 질문도 찾고, 열린 일감을 먼저", async () => {
  const 닫힌 = { id: 12, client_id: 2, kind: "question-draft", dedupe_key: "qdraft-aaa", status: "닫힘", payload: { question: "학원 출결 관리 앱" } };
  const 열 = 열린28();
  열.payload.questions = [열.payload.question, "학원 출결 관리 앱"];
  const db = 가짜db([닫힌, 열]);
  assert.equal((await 같은질문일감(db.q, 2, "학원 출결관리 앱"))?.id, 28);
});
await tt("세션완료찾기 — 묶인 질문으로도 완료를 찾는다", async () => {
  const 열 = { ...열린28(), status: "완료", done_day: "2026-10-12", done_at: "2026-10-12T03:00:00Z" };
  열.payload = { question: "학원 관리 프로그램 뭐가 좋은가요?", questions: ["학원 관리 프로그램 뭐가 좋은가요?", "학원 출결 관리 앱"] };
  const db = 가짜db([열]);
  assert.equal((await 세션완료찾기(db.q, 2, "학원 출결 관리 앱", "2026-10-10"))?.id, 28);
});
await tt("열기 — 다른 세션 글이 열려 있으면 새로 안 만들고 묶음", async () => {
  const db = 가짜db([열린28()]);
  const r = await 여는값(db);
  assert.equal(r.id, 28);
  assert.equal(db.표.length, 1);
  assert.equal(db.표[0].title, undefined, "대표 일감 제목을 덮어쓰지 않음");
  assert.deepEqual(db.표[0].payload.questions, ["학원 관리 프로그램 뭐가 좋은가요?", "학원 출결 관리 앱"]);
});
await tt("열기 — 묶인 질문으로 이미 열려 있으면 제목 안 덮음·안 씀", async () => {
  const 열 = 열린28();
  열.payload.questions = [열.payload.question, "학원 출결 관리 앱"];
  const db = 가짜db([열]);
  const r = await 여는값(db);
  assert.equal(r.id, 28);
  assert.equal(db.씀.length, 0);
});
await tt("탐침글일감 — 열린 세션 글이 있으면 막지 않고 묶음", async () => {
  const db = 가짜db([열린28()]);
  const r = await 탐침글일감(db.q, { c: 고객, 설정: 아이로그.loop, gap: { prompt_id: "p3", text: "학원 문자 발송 프로그램", radius: "전국", n: 4, root: "q2" }, 곳이름: "Claude", 오늘: "2026-10-10", DRY: false });
  assert.equal(r.id, null);
  assert.match(r.말, /#28 에 「학원 문자 발송 프로그램」 묶음/);
  assert.equal(db.표.length, 1);
  assert.equal(db.표[0].payload.questions.at(-1), "학원 문자 발송 프로그램");
});
// ── 9. 나이로 안 닫음(D60) — daily-agent 의 14일 run 은 「미처리」 판정만, 세션 글 일감은 그대로
t("나이 닫기 제거 — 세션일감닫기 없음 · daily-agent 는 미처리 판정만 · 탐침글일감 은 닫지 않음", () => {
  const 루프 = fs.readFileSync(new URL("./daily-agent.mjs", import.meta.url), "utf8");
  const 세션 = fs.readFileSync(new URL("./session-task.mjs", import.meta.url), "utf8");
  assert.match(루프, /verdict='미처리'/);
  assert.doesNotMatch(루프, /세션일감닫기/);
  assert.doesNotMatch(세션, /세션일감닫기|status='닫힘'/);
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
