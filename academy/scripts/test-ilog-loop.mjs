// 아이로그를 학원과 같은 수준으로(Step 30) 단위 시험 — 가짜 행만, DB·네트워크 없음.
//   node academy/scripts/test-ilog-loop.mjs
// 1) 질문 패널 20개 모양  2) 이름 판별 말(오탐)  3) 고객별 루프 설정(이름 질문 적중·홈 JSON-LD)
// 4) 자기 점검 — 탐침 끄기·검색어형 묶음  5) 세션 글 일감 제목  6) 측정 예산 두 배 조건·순서
// 7) 「세션 대기」 생애주기(열기·재사용·끝냄·판정 찾기·14일 닫기·dry) — 가짜 q
// 하나라도 틀리면 종료코드 1.
import assert from "node:assert/strict";
import { bySlug, 세션글제목 } from "../clients.mjs";
import { 패널, 이름말 } from "./seed-ilog-panel.mjs";
import { 자기점검 } from "./loop-review.mjs";
import { 대상고르기, 고객있음, 측정상한 } from "../measure-targets.mjs";
import { 세션일감열기, 세션완료찾기, 세션일감닫기, 세션끝냄, 같은질문일감, 세션글키 } from "./session-task.mjs";

let fail = 0, pass = 0;
const t = (name, f) => {
  try { f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};
const tt = async (name, f) => {
  try { await f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};
const 학원 = bySlug("robotncoding"), 아이로그 = bySlug("ilog");

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

// ── 6. 측정 예산(Arch — 학원 밖에 잴 고객이 있는 날만 두 배, 순서 유료 → 학원 → 자사)
const 행 = (o) => ({ answer_pattern: null, measure_active: false, relation: "외부", price: 0, started_on: null, ends_on: null,
  kickoff_on: null, needs_build: "none", site_launch_on: null, cancelled_on: null, approved_n: 0, ...o });
const 학원행 = 행({ id: 1, slug: "robotncoding", name: "학원", domain: "robotncoding.com", relation: "자사", price: 0, started_on: "2026-09-17", ends_on: "2026-10-17", approved_n: 20 });
const 아이로그행 = (n) => 행({ id: 2, slug: "ilog", name: "아이로그", domain: "ilog.ai.kr", relation: "자사", measure_active: true, started_on: "2026-09-30", ends_on: "2026-10-30", approved_n: n });
const 유료행 = 행({ id: 3, slug: "paid", name: "유료", domain: "paid.example", price: 390000, started_on: "2026-09-25", ends_on: "2026-10-24", approved_n: 20 });
t("학원만 있는 날 — 40·22·60 그대로", () => {
  assert.equal(고객있음(대상고르기([학원행], 오늘)), false);
  assert.deepEqual(측정상한(false, {}), { claude: 40, reserve: 22, web: 60 });
});
t("아이로그 승인 질문 0개 — 두 배 안 함", () => assert.equal(고객있음(대상고르기([학원행, 아이로그행(0)], 오늘)), false));
t("아이로그 승인 질문 있음 — 60·42·120", () => {
  assert.equal(고객있음(대상고르기([학원행, 아이로그행(20)], 오늘)), true);
  assert.deepEqual(측정상한(true, {}), { claude: 60, reserve: 42, web: 120 });
});
t("유료 고객 — 두 배(전과 같음)", () => assert.equal(고객있음(대상고르기([학원행, 유료행], 오늘)), true));
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
    const 같은 = (r) => r.client_id === p[0] && r.kind === "question-draft" && 글(r.payload?.question) === p[1];
    if (/^select id, status, dedupe_key/.test(s)) return 표.filter(같은).sort((a, b) => a.id - b.id).slice(0, 1);
    if (/^select id, done_at/.test(s)) {
      return 표.filter((r) => 같은(r) && r.status === "완료" && r.done_day >= p[2]).slice(0, 1).map((r) => ({ id: r.id, done_at: r.done_at }));
    }
    씀.push(s);
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
    if (/^update geo\.agent_tasks set status='닫힘'/.test(s)) {
      return 표.filter((r) => 같은(r) && r.status === "세션 대기").map((r) => ((r.status = "닫힘"), { id: r.id }));
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
await tt("14일 닫기 — 짝 일감도 닫힘, dry 는 안 씀", async () => {
  const db = 가짜db();
  await 여는값(db);
  assert.deepEqual(await 세션일감닫기(db.q, { clientId: 2, 질문: "학원 출결 관리 앱", 오늘: "2026-10-14", DRY: true }), []);
  assert.equal(db.표[0].status, "세션 대기");
  const 닫음 = await 세션일감닫기(db.q, { clientId: 2, 질문: "학원 출결 관리 앱", 오늘: "2026-10-14", DRY: false });
  assert.deepEqual(닫음, [db.표[0].id]);
  assert.equal(db.표[0].status, "닫힘");
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
