// 고객 상태 칸 문장(Step 40 D63) 단위 시험 — web/lib/client-status-core.mjs, 가짜 숫자만.
//   node academy/scripts/test-client-status.mjs
// 아이로그 꼴(측정만 · 손댄 날 9/18 · 세션 1편 질문 12개 23일 → 멈춤) · 문서딱 꼴 · 학원 꼴 · 학원 실데이터 꼴(오래된 원장님 몫 + 최근 발행 → 돌고 있음) · 전부 빈 것 · 뱃지 경계 6/7/13/14일.
// 뱃지는 손댄 날만으로 정한다(KG-40-4 결정) — 밀린 일 나이는 뱃지를 안 바꾼다.
// 하나라도 틀리면 종료코드 1.
import assert from "node:assert/strict";
import { 상태문장, 이번주, 며칠전 } from "../../web/lib/client-status-core.mjs";
import { 주별칸 } from "../../web/lib/growth-core.mjs";

let fail = 0, pass = 0;
const t = (name, f) => {
  try { f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};

const 오늘 = "2026-10-10";
const 빈 = { measure: 0, posts: 0, outside: { blog: 0, jisikin: 0, cafe: 0 }, guides: 0, gsc: 0, bing: 0, naver: 0, touched: {}, backlog: {} };

t("이번 주 = 어제까지 7일", () => assert.deepEqual(이번주(오늘), { from: "2026-10-03", to: "2026-10-09" }));

t("아이로그 꼴 — 측정만 · 9/18 · 세션 1편 질문 12개 23일 → 멈춤", () => {
  const s = 상태문장({ ...빈, name: "아이로그", measure: 42, touched: { post: "2026-09-18" },
    backlog: { session: { n: 1, q: 12, oldest: "2026-09-17" } } }, 오늘);
  assert.deepEqual(s, {
    제목: "아이로그 · 이번 주 (10/3~10/9)",
    뱃지: "멈춤",
    한일: "AI 답변 측정 42번. 글·색인·사이트 반영은 0건입니다.",
    손댄날: "고객 사이트나 바깥에 실제로 손댄 마지막 날 9/18 (22일 전)",
    밀린일: ["Claude 세션 — 가이드 글 1편(묶인 질문 12개) · 23일째"],
  });
});

t("문서딱 꼴 — 색인 있음 · 원장님·세션 밀림 · 수리 승인 기다림", () => {
  const s = 상태문장({ ...빈, name: "문서딱", measure: 41, gsc: 10, bing: 8, touched: { post: "2026-10-09" },
    backlog: { owner: { n: 1, oldest: "2026-10-08" }, session: { n: 1, q: 6, oldest: "2026-10-02" }, repair: { n: 2, oldest: "2026-10-01" } },
    repairText: "승인 기다림 1건 · 수리안 만들 것 2건" }, 오늘);
  assert.equal(s.한일, "AI 답변 측정 41번 · 구글 색인 요청 10건 · 빙 주소 제출 8건");
  assert.equal(s.손댄날, "고객 사이트나 바깥에 실제로 손댄 마지막 날 10/9 (1일 전)");
  assert.deepEqual(s.밀린일, [
    "원장님 — 1건 · 가장 오래된 것 2일째",
    "Claude 세션 — 가이드 글 1편(묶인 질문 6개) · 8일째",
    "자동 코드 수리 — 2건 · 9일째 (승인 기다림 1건 · 수리안 만들 것 2건)",
  ]);
  assert.equal(s.뱃지, "돌고 있음", "밀린 일 9일째여도 어제 손댔으면 돌고 있음");
});

t("학원 꼴 — 글·블로그 옮김·바깥 글 · 원장 PC · 실패 · 수리안 만드는 중", () => {
  const s = 상태문장({ ...빈, name: "로봇&코딩학원", measure: 41, posts: 1, naver: 1, gsc: 15, bing: 8,
    outside: { blog: 2, jisikin: 0, cafe: 1 }, guides: 0, touched: { post: "2026-10-10" },
    backlog: { local: { n: 2, oldest: "2026-10-08" }, failed: { n: 1, oldest: "2026-10-10" }, repair: { n: 1, oldest: "2026-10-09" } },
    repairText: "수리안 만드는 중 — 1건 대기, 매일 06:50 1건" }, 오늘);
  assert.equal(s.한일, "AI 답변 측정 41번 · 사이트 글 발행 1편 · 블로그 글 올림 2편 · 카페 글 올림 1편 · 구글 색인 요청 15건 · 빙 주소 제출 8건 · 네이버 블로그로 옮김 1편");
  assert.equal(s.손댄날, "고객 사이트나 바깥에 실제로 손댄 마지막 날 10/10 (오늘)");
  assert.deepEqual(s.밀린일, [
    "원장 PC — 2건 · 2일째 (PC 가 켜져 있어야 움직입니다)",
    "자동 코드 수리 — 1건 · 1일째 (수리안 만드는 중 — 1건 대기, 매일 06:50 1건)",
    "자동 작업 실패 — 1건 · 오늘",
  ]);
  assert.equal(s.뱃지, "돌고 있음");
});

t("전부 빈 것 — 0 이라고 적고, 손댄 날 없음 → 아직 시작 전", () => {
  const s = 상태문장({ ...빈, name: "새 고객" }, 오늘);
  assert.equal(s.한일, "글·색인·사이트 반영은 0건입니다.");
  assert.equal(s.손댄날, "아직 없습니다");
  assert.deepEqual(s.밀린일, ["밀린 일 없습니다"]);
  assert.equal(s.뱃지, "아직 시작 전");
});

t("세션 묶인 질문 수가 없으면 편 수로", () => {
  const s = 상태문장({ ...빈, name: "x", touched: { post: 오늘 }, backlog: { session: { n: 1, oldest: 오늘 } } }, 오늘);
  assert.deepEqual(s.밀린일, ["Claude 세션 — 가이드 글 1편(묶인 질문 1개) · 오늘"]);
});

// 학원 실데이터 꼴(10/10 운영 DB) — 원장님 몫 3건 23일째 · 원장 PC 18일째 · 수리 10일째인데 10/9 발행·색인·네이버 이관
t("학원 실데이터 꼴 — 오래된 사람 대기 + 최근 발행 → 돌고 있음, 밀린 일 줄에는 보임", () => {
  const s = 상태문장({ ...빈, name: "로봇&코딩학원", measure: 41, posts: 1, gsc: 15, bing: 8, naver: 1, touched: { post: "2026-10-09" },
    backlog: { owner: { n: 3, oldest: "2026-09-17" }, local: { n: 2, oldest: "2026-09-22" }, repair: { n: 3, oldest: "2026-09-30" } } }, 오늘);
  assert.equal(s.뱃지, "돌고 있음");
  assert.equal(s.밀린일[0], "원장님 — 3건 · 가장 오래된 것 23일째");
  assert.equal(s.밀린일[1], "원장 PC — 2건 · 18일째 (PC 가 켜져 있어야 움직입니다)");
});

// 뱃지 경계 — 손댄 날 기준. 밀린 일 나이는 뱃지를 안 바꾼다
const 손댄 = (d) => 상태문장({ ...빈, name: "x", touched: { post: d  }}, 오늘).뱃지;
const 밀린 = (d) => 상태문장({ ...빈, name: "x", touched: { post: 오늘 }, backlog: { owner: { n: 1, oldest: d }, session: { n: 1, oldest: d } } }, 오늘).뱃지;
t("뱃지 — 손댄 날 6일 돌고 있음 · 7일 느림 · 13일 느림 · 14일 멈춤", () => {
  assert.deepEqual(["2026-10-04", "2026-10-03", "2026-09-27", "2026-09-26"].map(손댄), ["돌고 있음", "느림", "느림", "멈춤"]);
});
t("뱃지 — 밀린 일 6·7·13·14일이어도 오늘 손댔으면 돌고 있음", () => {
  assert.deepEqual(["2026-10-04", "2026-10-03", "2026-09-27", "2026-09-26"].map(밀린), ["돌고 있음", "돌고 있음", "돌고 있음", "돌고 있음"]);
});

t("색인만 돌고 한 달 글 없음 → 멈춤(자동 색인 요청은 손댄 것이 아니다)", () => {
  const s = 상태문장({ ...빈, name: "x", measure: 41, gsc: 15, bing: 8, naver: 0, touched: { post: "2026-09-08", outside: null, guide: null } }, 오늘);
  assert.equal(s.뱃지, "멈춤");
  assert.equal(s.손댄날, "고객 사이트나 바깥에 실제로 손댄 마지막 날 9/8 (32일 전)");
  assert.match(s.한일, /구글 색인 요청 15건/);
});
t("손댄 날 — 글·바깥 글·가이드 반영 중 가장 늦은 날", () => {
  const s = 상태문장({ ...빈, name: "x", touched: { post: "2026-09-08", outside: "2026-10-08", guide: "2026-09-18" } }, 오늘);
  assert.equal(s.손댄날, "고객 사이트나 바깥에 실제로 손댄 마지막 날 10/8 (2일 전)");
  assert.equal(s.뱃지, "돌고 있음");
});

// 주별 요약 표 칸(D64) — 문서딱 꼴(기록 장치 없음·글은 고객 저장소)은 0 이 아니라 안 셈/안 잼
t("주별칸 — 문서딱 꼴 tracked false → 안 셈·안 잼", () => {
  assert.deepEqual(주별칸({ crawl: false, posts: false }, { posts: 0, search: 0, ai: 0, other: 0, cov: [0, 0, 0] }), { 글: "안 셈", 방문: "안 잼", 색인: "안 잼" });
});
t("주별칸 — 학원 꼴 tracked true → 숫자", () => {
  assert.deepEqual(주별칸({ crawl: true, posts: true }, { posts: 1, search: 12, ai: 30, other: 2, cov: [40, null, 5] }), { 글: "1편", 방문: "12 / 30 / 2", 색인: "40 / — / 5" });
  assert.equal(주별칸({ crawl: true, posts: true }, { posts: undefined, search: null, ai: null, other: null, cov: null }).글, "확인 못함");
});

t("며칠전 — DB 시각 글자를 KST 날짜로", () => {
  assert.equal(며칠전("2026-09-17 13:29:47.961393+00", 오늘), 23);
  assert.equal(며칠전("2026-10-09T15:49:00Z", 오늘), 0, "00:49 KST 는 오늘");
  assert.equal(며칠전("모름", 오늘), null);
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
