// 문서딱 두 번째 자사 레퍼런스(Step 32 D44·D45) 단위 시험 — 가짜 행·글자만, DB·네트워크 없음.
//   node academy/scripts/test-docttak.mjs
// 1) 질문 패널 — 브리프 자동완성 원문만, 17+3  2) 이름 판별 말  3) clients.mjs 덩어리(id·홈 JSON-LD·이름 질문 적중·변형 탐침)
// 4) seed 일반형 점검(아이로그·문서딱)  5) 측정 상한 = 고객 수 k(k=0·1 은 전 값 그대로)
// 하나라도 틀리면 종료코드 1.
import assert from "node:assert/strict";
import fs from "node:fs";
import { CLIENTS, bySlug } from "../clients.mjs";
import * as 문서딱패널 from "./seed-docttak-panel.mjs";
import * as 아이로그패널 from "./seed-ilog-panel.mjs";
import { 패널점검 } from "./seed-panel.mjs";
import { 변형후보, 자기점검 } from "./loop-review.mjs";
import { 대상고르기, 고객수, 측정상한 } from "../measure-targets.mjs";

let fail = 0, pass = 0;
const t = (name, f) => {
  try { f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};
const 문서딱 = bySlug("docttak", CLIENTS), 아이로그 = bySlug("ilog", CLIENTS), 학원 = bySlug("robotncoding", CLIENTS);
const { 패널, 이름말, 파일럿 } = 문서딱패널;

// ── 1. 패널 — 브리프 「측정 요청」 목록에서만
const 브리프 = fs.readFileSync(new URL("../../research/docttak-brief-2026-10-01.md", import.meta.url), "utf8");
const 요청 = 브리프.slice(브리프.indexOf("## 측정 요청"), 브리프.indexOf("같은 질문에서 경쟁 도구"));
const 자동완성 = 요청.split(/\r?\n/).filter((l) => l.startsWith("- ")).flatMap((l) => l.slice(2).split(" / ").map((s) => s.trim()));
t("브리프 자동완성 검색어는 17개", () => assert.equal(자동완성.length, 17));
t("질문 20개 · keyword 17 · brand 3 · 겹침 없음", () => {
  assert.equal(패널.length, 20);
  assert.equal(new Set(패널.map(([, x]) => x)).size, 20);
  const 셈 = 패널.reduce((m, [s]) => ((m[s] = (m[s] ?? 0) + 1), m), {});
  assert.deepEqual(셈, { keyword: 17, brand: 3 });
});
t("검색어형은 브리프 원문 그대로 — 지어낸 말 없음, 17개 전부", () => {
  const kw = 패널.filter(([s]) => s === "keyword").map(([, x]) => x);
  for (const x of kw) assert.ok(자동완성.includes(x), x);
  assert.deepEqual([...kw].sort(), [...자동완성].sort());
});
t("이름 질문 3개는 설계서 꼴 그대로", () => {
  assert.deepEqual(패널.filter(([s]) => s === "brand").map(([, x]) => x),
    ["문서딱 어떤 사이트야?", "docttak.com 이 사이트 뭐 하는 곳이야?", "문서딱 파일 안 올리고 처리돼?"]);
});
t("질문마다 출처가 적혀 있음", () => { for (const [, x, 출처] of 패널) assert.ok(출처?.trim(), x); });
t("도구 5개 모두 질문이 있음", () => {
  const 도구 = { 합치기: /합치기/, "PDF 용량": /pdf 용량/, "사진 용량": /사진 (용량|kb)|증명사진 용량/, 규격: /규격|사이즈/, HWP: /hwp|한글파일/ };
  for (const [이름, re] of Object.entries(도구)) assert.ok(패널.some(([s, x]) => s === "keyword" && re.test(x)), 이름);
});
t("경쟁사 5곳 — 브리프 원문", () => assert.equal(파일럿.competitors, "iLovePDF, Smallpdf, 알PDF, allinpdf, 한컴독스"));
t("0원 리허설 · 문의 주소는 지어내지 않음", () => {
  assert.equal(파일럿.price, 0);
  assert.equal(파일럿.status, "리허설");
  assert.equal(파일럿.contact_email, null);
});
t("새 고객사 칸은 자사", () => assert.equal(문서딱패널.새고객.relation, "자사"));

// ── 2. 이름 판별 말
const 이름 = new RegExp(이름말(), "i");
t("원문은 설계서 그대로 · clients.mjs 한 곳", () => {
  assert.equal(이름말(), "문서딱|docttak(\\.com)?");
  assert.equal(이름말(), 문서딱.answerRe.source);
});
t("이름·도메인을 센다", () => {
  assert.ok(이름.test("무료 도구로는 문서딱, iLovePDF 가 있습니다"));
  assert.ok(이름.test("https://docttak.com/pdf-merge/ 에서 합칠 수 있습니다"));
  assert.ok(이름.test("DOCTTAK 에서"));
});
t("「문서 딱」·남의 도구는 안 센다", () => {
  assert.equal(이름.test("문서 딱 맞게 줄이려면 Smallpdf 를 쓰세요"), false);
  assert.equal(이름.test("iLovePDF·알PDF·한컴독스"), false);
});
t("이름 질문에만 이름이 들어 있음", () => { for (const [s, x] of 패널) assert.equal(이름.test(x), s === "brand", x); });

// ── 3. clients.mjs 덩어리
t("id·slug 가 다른 고객과 안 겹침 · id 3", () => {
  assert.equal(문서딱.id, 3);
  assert.equal(new Set(CLIENTS.map((c) => c.id)).size, CLIENTS.length);
  assert.equal(new Set(CLIENTS.map((c) => c.slug)).size, CLIENTS.length);
});
t("글은 세션 · 쓸 곳은 이 저장소의 제안 자리 · 바깥 행동 2개", () => {
  assert.equal(문서딱.publishes, false);
  assert.equal(문서딱.loop.draft, "session");
  assert.match(문서딱.loop.draftWhere, /^deliverables\/docttak\//);
  assert.equal(문서딱.loop.offsite.length, 2);
});
t("방문·크롤러 기록 장치 안 닮 — 서버 숫자는 문서딱 성장 리포트(Step 36)", () => assert.equal(문서딱.siteLog, "Cloudflare 주간 합계는 문서딱 성장 리포트(봇 포함)"));
// 2026-10-01 curl https://docttak.com/ 의 JSON-LD 앞부분, /pdf-merge/ 의 WebApplication
const LD_홈 = '[{"@context":"https://schema.org","@type":"WebSite","name":"문서딱","url":"https://docttak.com/"},{"@context":"https://schema.org","@type":"Organization","name":"문서딱","url":"https://docttak.com/"}]';
const LD_도구 = '{"@context":"https://schema.org","@type":"WebApplication","name":"PDF 합치기","url":"https://docttak.com/pdf-merge/"}';
const LD_아이로그 = '{"@type":"SoftwareApplication","name":"아이로그","url":"https://ilog.ai.kr"}';
const 통과 = (설정, ld) => 설정.homeLd.every((re) => re.test(ld));
t("홈 JSON-LD 검사 — 실제 홈은 통과, 남의 홈은 실패", () => {
  assert.ok(통과(문서딱.loop, LD_홈));
  assert.equal(통과(문서딱.loop, LD_아이로그), false);
  assert.equal(통과(아이로그.loop, LD_홈), false);
  assert.equal(통과(학원.loop, LD_홈), false);
});
t("도구 페이지 LD(WebApplication 만, Organization 없음)는 홈 검사에 안 맞음", () => assert.equal(통과(문서딱.loop, LD_도구), false));
t("이름 질문 적중은 도구 이름", () => {
  assert.ok(문서딱.loop.brandHit.test("문서딱은 PDF 합치기와 HWP PDF 변환을 무료로 하는 사이트입니다"));
  assert.ok(문서딱.loop.brandHit.test("여권사진 규격을 맞춰 주는 도구입니다"));
  assert.equal(문서딱.loop.brandHit.test("문서딱이라는 사이트는 확인되지 않습니다"), false);
});
const 승인 = 패널.map(([stage, text], i) => ({ prompt_id: `q${i + 1}`, stage, text }));
t("변형 탐침 도구 말은 승인 검색어에서만", () => {
  const v = 변형후보(승인, 문서딱.loop.probeVariants);
  assert.ok(v.length > 0);
  const 승인말 = 승인.filter((x) => x.stage === "keyword").map((x) => x.text);
  for (const x of v) {
    const 도구 = x.text.replace(/ (무료|사이트)$/, "");
    assert.ok(승인말.some((s) => s.includes(도구)), x.text);
  }
});
t("변형 탐침 — 승인 질문과 같은 글은 안 만든다(「pdf 합치기 무료」)", () => {
  const r = 자기점검({ runs: [], posts: [], today: "2026-10-01", 적중: (x) => x.cited || x.mentioned, domain: "docttak.com",
    questions: 승인, rows: [], 탐침: 문서딱.loop.probes, 변형: 문서딱.loop.probeVariants, 새탐침한도: 2 });
  // 「pdf 병합」은 씨앗(원장 2026-10-02) — 하루 한도 2개와 따로 한 번 만든다
  assert.deepEqual(r.probes.map((p) => p.text), ["pdf 병합", "pdf 합치기 사이트", "아이폰 pdf 합치기 무료"]);
  assert.deepEqual(r.probes[0], { source_prompt: null, radius: "변형", text: "pdf 병합", form: "keyword", seed: true });
  assert.equal(r.findings.some((f) => f.code === "widen"), false); // 송파 넓힘 안 씀
});
t("변형 씨앗 — 이미 탐침에 있으면 다시 안 만든다 · 한도 0 이어도 씨앗은 만든다", () => {
  const 기본 = { runs: [], posts: [], today: "2026-10-02", 적중: (x) => x.cited || x.mentioned, domain: "docttak.com",
    questions: 승인, rows: [], 탐침: 문서딱.loop.probes, 변형: 문서딱.loop.probeVariants };
  const 있음 = 자기점검({ ...기본, 새탐침한도: 2,
    probes: [{ prompt_id: "p1", source_prompt: null, radius: "변형", text: "pdf 병합", active: true, form: "keyword" }] });
  assert.equal(있음.probes.some((p) => p.text === "pdf 병합"), false);
  const 영 = 자기점검({ ...기본, 새탐침한도: 0 });
  assert.deepEqual(영.probes.map((p) => p.text), ["pdf 병합"]);
});
t("검색 결과 화면 질의 — 색인 1 · 경쟁 5(브리프 원문) · 브랜드 2", () => {
  const 셈 = 문서딱.queries.reduce((m, x) => ((m[x.kind] = (m[x.kind] ?? 0) + 1), m), {});
  assert.deepEqual(셈, { 색인: 1, 경쟁: 5, 브랜드: 2 });
  for (const x of 문서딱.queries.filter((y) => y.kind === "경쟁")) assert.ok(자동완성.includes(x.q), x.q);
});

// ── 4. seed 일반형
t("seed 점검 — 아이로그·문서딱 둘 다 통과", () => {
  assert.equal(패널점검(아이로그패널), null);
  assert.equal(패널점검(문서딱패널), null);
});
t("seed 점검 — 19개면 멈춤", () => assert.match(패널점검({ ...문서딱패널, 패널: 패널.slice(1) }), /19개/));

// ── 5. 측정 상한 = 고객 수
const 오늘 = "2026-10-01";
const 행 = (o) => ({ answer_pattern: null, measure_active: false, relation: "외부", price: 0, started_on: null, ends_on: null,
  kickoff_on: null, needs_build: "none", site_launch_on: null, cancelled_on: null, approved_n: 0, ...o });
const 학원행 = 행({ id: 1, slug: "robotncoding", name: "학원", domain: "robotncoding.com", relation: "자사", started_on: "2026-09-17", ends_on: "2026-10-17", approved_n: 20 });
const 아이로그행 = 행({ id: 2, slug: "ilog", name: "아이로그", domain: "ilog.ai.kr", relation: "자사", measure_active: true, started_on: "2026-09-30", ends_on: "2026-10-30", approved_n: 20 });
const 문서딱행 = (n) => 행({ id: 3, slug: "docttak", name: "문서딱", domain: "docttak.com", relation: "자사", measure_active: true, started_on: "2026-10-01", ends_on: "2026-10-31", approved_n: n });
t("k=0 → 40·22·60 · k=1 → 60·42·120 (전 값 그대로)", () => {
  assert.deepEqual(측정상한(0, {}), { claude: 40, reserve: 22, web: 60 });
  assert.deepEqual(측정상한(1, {}), { claude: 60, reserve: 42, web: 120 });
});
t("k=2 → 80·62·180 · 측정 아닌 몫은 늘 18", () => {
  assert.deepEqual(측정상한(2, {}), { claude: 80, reserve: 62, web: 180 });
  for (const k of [0, 1, 2, 3]) { const h = 측정상한(k, {}); assert.equal(h.claude - h.reserve, 18); }
});
t("env 숫자가 먼저 · 빈 글자는 없는 것 · reserve ≤ claude", () => {
  assert.deepEqual(측정상한(2, { CLAUDE_DAILY_MAX: "50", CLAUDE_MEASURE_RESERVE: "", WEB_MEASURE_DAILY_MAX: "90" }), { claude: 50, reserve: 50, web: 90 });
  assert.deepEqual(측정상한(0, { CLAUDE_MEASURE_RESERVE: "70" }), { claude: 40, reserve: 40, web: 60 });
});
t("문서딱 승인 0개 — k=1(아이로그만)", () => assert.equal(고객수(대상고르기([학원행, 아이로그행, 문서딱행(0)], 오늘)), 1));
t("문서딱 승인 20개 — k=2", () => assert.equal(고객수(대상고르기([학원행, 아이로그행, 문서딱행(20)], 오늘)), 2));
t("순서 학원 → 아이로그 → 문서딱(시작일 순)", () => {
  assert.deepEqual(대상고르기([문서딱행(20), 아이로그행, 학원행], 오늘).map((r) => `${r.묶음}:${r.slug}`), ["학원:robotncoding", "자사:ilog", "자사:docttak"]);
});
t("문서딱 측정 설정 — 이름 정규식·도메인이 잡힘", () => {
  const [, , d] = 대상고르기([학원행, 아이로그행, 문서딱행(20)], 오늘);
  assert.equal(d.conf.domain, "docttak.com");
  assert.ok(d.conf.answerRe.test("문서딱"));
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
