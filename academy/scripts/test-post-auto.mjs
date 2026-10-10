// 학원 주 1편 자동 글(Step 43) 단위 시험 — web/lib/post-auto-core.mjs. DB·claude·네트워크 없음(DB 는 가짜 q).
//   node academy/scripts/test-post-auto.mjs
// 하나라도 틀리면 종료코드 1.
import assert from "node:assert/strict";
import {
  주제키, 학원사실필요, 후보모으기, 거르기, 재료모으기, 재료판정, 주장뽑기, 창찾기, 판정읽기, 문장지우기, 본문해시,
  다음행동, 관점읽기, 글기록말, 발행가능, 발행, 내리기, 다듬기검사, 이번주글SQL, 묵은초안SQL, 학원표지,
} from "../../web/lib/post-auto-core.mjs";

let fail = 0, pass = 0;
const 시험들 = [];
const t = (name, f) => 시험들.push([name, f]);

const 일 = 86400000;
const NOW = Date.parse("2026-10-10T03:00:00Z"); // 토 12:00 KST
const iso = (ms) => new Date(ms).toISOString();

/** 가짜 q — 호출 SQL·인자를 기록하고, 처리기가 rows 를 준다 */
const 가짜 = (처리 = () => []) => {
  const 호출 = [];
  const q = async (sql, params = []) => {
    호출.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    const r = 처리(sql, params);
    if (r instanceof Error) throw r;
    return r ?? [];
  };
  return { q, 호출 };
};

// ── 주제키
t("주제키 — 물음표·공백 차이 → 같은 키 · 종류별 머리", () => {
  assert.equal(주제키({ 질문: "송파 코딩학원 어디가 좋아요?" }), 주제키({ 질문: "송파  코딩학원 어디가좋아요 ？" }));
  assert.match(주제키({ 질문: "x" }), /^q:[0-9a-f]{10}$/);
  assert.match(주제키({ 검색어: "송파 코딩학원" }), /^serp:[0-9a-f]{10}$/);
  assert.equal(주제키({ bank: "ai-sukje" }), "bank:ai-sukje");
});

// ── 후보모으기
const 신호처리 = (sql) => {
  if (sql.includes("ai_measurements")) return [{ prompt_text: "송파 초등 코딩학원 어디가 좋아요?", 엔진: 4, 날: "2026-10-08" }];
  if (sql.includes("question-draft")) return [
    { payload: { question: "송파 초등 코딩학원 어디가 좋아요", sources: ["a.kr", "b.kr"] } },
    { payload: { question: "로봇 코딩 몇 살부터?", sources: [] } },
  ];
  if (sql.includes("serp_checks")) return [{ query: "잠실 코딩학원" }];
  return [];
};
t("후보모으기 — A·B·C·D 각 1건 + 같은 질문 A+B → 한 후보 점수 합", async () => {
  const { q, 호출 } = 가짜(신호처리);
  const 은행 = [{ id: "banghak", title: "방학에 코딩 특강, 시키는 게 맞나요?", category: "학부모안내", season: "방학전" },
    { id: "done", title: "이미 쓴 것", slug: "x" }];
  const { 후보, 못읽음 } = await 후보모으기(q, { client: 1, 은행, now: NOW });
  assert.deepEqual(못읽음, []);
  assert.equal(후보.length, 4);
  const 합친 = 후보.find((c) => c.신호.includes("A"));
  assert.deepEqual(합친.신호, ["A", "B"]);
  assert.equal(합친.점수, 30 + 4 + 25);
  assert.match(합친.이유, /AI 답 4곳 중 0곳이 우리를 안 부름\(10\/8 잼\) · 경쟁 쪽 2곳이 대신 인용됨/);
  assert.ok(후보.some((c) => c.신호[0] === "C" && c.점수 === 20 && c.키.startsWith("serp:")));
  const 은행후보 = 후보.find((c) => c.신호[0] === "D");
  assert.equal(은행후보.점수, 10);                       // 10월은 방학전이 아니다
  assert.equal(은행후보.학원사실필요, true);              // 특강
  assert.equal(후보[0], 합친);                            // 점수순
  // brand stage 제외 — SQL 에 걸려 있어야 한다
  assert.match(호출.find((c) => c.sql.includes("ai_measurements")).sql, /coalesce\(stage, ''\) <> 'brand'/);
});
t("후보모으기 — 신호 하나를 못 읽어도 나머지로 · 못읽음에 남김", async () => {
  const { q } = 가짜((sql) => (sql.includes("serp_checks") ? new Error("없는 표") : 신호처리(sql)));
  const { 후보, 못읽음 } = await 후보모으기(q, { now: NOW });
  assert.deepEqual(못읽음, ["검색 순위"]);
  assert.equal(후보.length, 2);
});
t("후보모으기 — 철이 맞으면 +5", async () => {
  const { q } = 가짜(() => []);
  const { 후보 } = await 후보모으기(q, { 은행: [{ id: "y", title: "영재원 준비, 코딩이 도움이 되나요?", season: "영재원모집" }], now: NOW });
  assert.equal(후보[0].점수, 15);
});

// ── 거르기
const 후보 = (제목, 키 = 주제키({ 질문: 제목 }), 덧 = {}) => ({ 키, 제목, 신호: ["A"], 이유: "", 점수: 30, 학원사실필요: 학원사실필요(제목), ...덧 });
t("거르기 — 발행 키 영구 · 버림 8주 안/밖 · 재료부족 4주", () => {
  const a = 후보("가 질문이요?"), b = 후보("나 질문이요?"), c = 후보("다 질문이요?"), d = 후보("라 질문이요?");
  const 기록 = [
    { topic_key: a.키, kind: "발행", at: iso(NOW - 400 * 일) },
    { topic_key: b.키, kind: "버림", at: iso(NOW - 50 * 일) },
    { topic_key: c.키, kind: "버림", at: iso(NOW - 60 * 일) },
    { topic_key: d.키, kind: "재료부족", at: iso(NOW - 20 * 일) },
  ];
  const { 남은것, 뺀것 } = 거르기([a, b, c, d], 기록, [], { now: NOW });
  assert.deepEqual(남은것.map((x) => x.제목), ["다 질문이요?"]);
  assert.equal(뺀것.length, 3);
  assert.match(뺀것[0].왜, /이미 발행한 주제/);
  assert.match(뺀것[1].왜, /8주 뒤/);
  assert.match(뺀것[2].왜, /4주 뒤/);
  // 재료부족 4주 밖은 다시 후보
  assert.equal(거르기([d], [{ topic_key: d.키, kind: "재료부족", at: iso(NOW - 30 * 일) }], [], { now: NOW }).남은것.length, 1);
});
t("거르기 — 28일 낱말 2개 겹침 제외 · 1개는 통과 · 왜는 날짜와 제목", () => {
  const 최근 = [{ title: "코딩으로 대학 가나요? 2027학년도 국민대 알고리즘우수자 전형, 10명 신설됐습니다", tags: ["코딩 입시"], published_at: "2026-10-05T02:41:59Z" }];
  const 겹침 = 거르기([후보("국민대 알고리즘우수자 전형 준비는 언제부터?")], [], 최근, { now: NOW });
  assert.equal(겹침.남은것.length, 0);
  assert.match(겹침.뺀것[0].왜, /^10\/5 「코딩으로 대학 가나요\? 2027학…」 글과 겹침\(국민대·알고리즘우수자·전형\)$/);
  assert.equal(거르기([후보("국민대 캠퍼스 투어 해볼까요?")], [], 최근, { now: NOW }).남은것.length, 1);
  // 조사가 붙어도 같은 낱말 — 「대학에」 = 「대학」
  assert.equal(거르기([후보("코딩으로 대학에 갈 수 있나요")], [], 최근, { now: NOW }).남은것.length, 0);
});
t("거르기 — 같은 제목(정규화)의 발행 글이 있으면 제외", () => {
  const r = 거르기([후보("엔트리와 스크래치, 어느 걸로 시작해야 하나요?")], [], [], { now: NOW, 모든제목: ["엔트리와 스크래치 어느 걸로 시작해야 하나요"] });
  assert.equal(r.남은것.length, 0);
  // 기간과 상관없이 제목 낱말 3개 이상 같으면 같은 질문
  const 같은 = 거르기([후보("바이브 코딩이 뭐야? 아이도 배울 수 있어?")], [], [], { now: NOW, 모든제목: ["바이브 코딩이 뭐야? 아이도 배울 수 있을까요?"] });
  assert.equal(같은.남은것.length, 0);
  assert.match(같은.뺀것[0].왜, /같은 질문/);
  assert.equal(거르기([후보("AI가 쓴 코드가 틀렸습니다. 아이는 찾을 수 있을까요?")], [], [], { now: NOW, 모든제목: ["AI가 코드를 다 짜주는데, 아이한테 코딩을 가르칠 필요가 있나요?"] }).남은것.length, 1);
});
t("학원사실필요 — 과정·모집·특강·반 / 교육과정·일반·반드시는 아님", () => {
  for (const s of ["겨울방학 특강 시키나요?", "중등 파이썬 과정은 뭘 배우나요?", "주말반 있나요?", "반 인원은 몇 명?", "신입생 모집 언제?"]) assert.equal(학원사실필요(s), true, s);
  for (const s of ["2022 개정 교육과정 정보 시수", "일반고에서 코딩 입시", "반드시 해야 하나요", "AI 교과서 도입"]) assert.equal(학원사실필요(s), false, s);
});

// ── 재료 관문
t("재료 관문 — 학원사실필요 + m·i 0 → 재료부족 · p# 만 → 재료부족 · m 있으면 재료 · 아니면 사실", () => {
  const 과정 = { 학원사실필요: true };
  assert.equal(재료판정(과정, { m: [], i: [], p: [] }).결과, "재료부족");
  const p만 = 재료판정(과정, { m: [], i: [], p: [{ 라벨: "p1" }] });
  assert.equal(p만.결과, "재료부족");
  assert.match(p만.왜, /옛 글/);
  assert.equal(재료판정(과정, { m: [{}], i: [], p: [] }).결과, "재료");
  assert.equal(재료판정(과정, { m: [], i: [{}], p: [] }).결과, "재료");
  assert.equal(재료판정({ 학원사실필요: false }, { m: [], i: [], p: [] }).결과, "사실");
});
t("재료모으기 — 비공개이유 글은 p# 에서 빠짐(SQL·코드 두 번) · 수업 낱말 문단만 · 연도 붙임", async () => {
  const { q, 호출 } = 가짜((sql) => {
    if (sql.includes("academy.materials")) return [{ id: "u1", kind: "상담", said: "엔트리 끝나면 뭐 해요?", context: "초3", day: "2026-10-01" }];
    if (sql.includes("academy.inquiries")) return [];
    if (sql.includes("academy.posts")) return [
      { slug: "old", title: "코딩학원의 선택", body: "## 소개\n\n반포교육원 수업 이야기입니다.", 내림: true, 연도: 2024 },
      { slug: "ok", title: "대회 후기", body: "## 소개\n\n정보올림피아드 대회에 나갔습니다.\n\n날씨가 좋았습니다.", 내림: false, 연도: 2025 },
    ];
    return [];
  });
  const r = await 재료모으기(q, 1);
  assert.equal(r.m[0].라벨, "m1");
  assert.equal(r.p.length, 1);
  assert.equal(r.p[0].라벨, "p1");
  assert.match(r.p[0].원문, /^\(2025년 글 「대회 후기」\) 정보올림피아드/);
  assert.match(호출.find((c) => c.sql.includes("academy.posts")).sql, /not \(coalesce\(p\.review_notes, '\{\}'::jsonb\) \? '비공개이유'\)/);
});

// ── 주장뽑기
const 국민대 = [
  "국민대가 2027학년도 수시에 알고리즘우수자 전형을 새로 만들었습니다. 모집인원은 10명입니다. 국민대 2027학년도 대학입학전형계획에 따르면 국제인재 전형 15명과 함께 신설됐습니다. 1단계에서 서류 100%로 모집인원의 3배수를 걸러내고, 2단계에서 1단계 성적 70%에 면접 30%를 더합니다.",
  "",
  "## 평가 방식이 알려주는 것",
  "",
  "상장을 모아 제출하면 끝나는 구조가 아닙니다. 서류를 읽은 사람이 면접에서 되묻습니다. 무엇을 만들었고 왜 그 방법으로 풀었는지 본인 입으로 설명해야 넘어갑니다.",
  "",
  "1. 첫째 항목입니다",
  "",
  "## 출처",
  "",
  "- 국민대 (https://admission.kookmin.ac.kr)",
].join("\n");
t("주장뽑기 — 2027학년도·10명·국민대·신설 잡힘 · 목록 번호·「n단계」 제외 · 숫자 없는 판단 문장·출처 절 대상 아님", () => {
  const 주장 = 주장뽑기(국민대);
  const 문장 = (s) => 주장.find((x) => x.문장.startsWith(s));
  assert.ok(문장("국민대가 2027학년도").숫자.includes("2027"));
  assert.ok(문장("국민대가 2027학년도").고유명사.includes("국민대"));
  assert.deepEqual(문장("모집인원은 10명").숫자, ["10"]);
  assert.ok(문장("국민대 2027학년도 대학입학전형계획").제도어.includes("신설"));
  const 단계 = 문장("1단계에서");
  assert.deepEqual(단계.숫자, ["100", "3", "70", "30"]);   // 1단계·2단계의 1·2 는 빠진다
  assert.ok(단계.빌린말.고유명사.includes("국민대"));       // 이름이 없어 같은 문단 앞 문장에서 빌림
  assert.equal(문장("상장을 모아"), undefined);
  assert.equal(문장("첫째 항목"), undefined);               // 목록 번호
  assert.ok(!주장.some((x) => x.문장.includes("kookmin")));   // 출처 절
});

// ── 창찾기
t("창찾기 — 1,500·전각 숫자 · 공백 무시 · 300자 안 이름 없으면 없음", () => {
  const 주장 = { 숫자: ["1500"], 고유명사: ["교육부"], 제도어: [] };
  assert.equal(창찾기("교육부 발표에 따르면 정원은 1,500명이다.", 주장).length, 1);
  assert.equal(창찾기("교 육 부 발표에 따르면 정원은 １５００명이다.", 주장).length, 1);
  assert.deepEqual(창찾기(`정원은 1500명이다.${"가".repeat(400)}교육부`, 주장), []);
  assert.deepEqual(창찾기("교육부 발표 정원 15000명", 주장), []);       // 15000 안의 1500 은 아니다
  assert.deepEqual(창찾기("교육부 발표 정원 2000명", 주장), []);        // 숫자 없음
  assert.deepEqual(창찾기("정원 10명", { 숫자: ["10"], 고유명사: [], 제도어: [] }), []); // 주장에 이름·제도어가 없음
  // 숫자 없는 주장 — 이름과 제도어가 한 창에
  assert.equal(창찾기("중앙대는 SW인재전형을 폐지했다", { 숫자: [], 고유명사: ["중앙대"], 제도어: ["폐지"] }).length, 1);
  assert.deepEqual(창찾기(`중앙대${"가".repeat(400)}폐지`, { 숫자: [], 고유명사: ["중앙대"], 제도어: ["폐지"] }), []);
  // 창은 600자를 안 넘고 3개까지
  const 긴 = Array.from({ length: 6 }, () => `교육부 1500명 ${"나".repeat(700)}`).join("");
  const 창 = 창찾기(긴, 주장);
  assert.equal(창.length, 3);
  assert.ok(창.every((w) => w.replace(/\s/g, "").length <= 600));
});

// ── 판정 파서
t("판정 파서 — 근거가 창 밖 → 없음 · 15자 안 되는 근거 → 없음 · 공백 달라도 창 안이면 맞음 · JSON 깨짐 → 못읽음", () => {
  const 대상 = [{ id: "s1", 창들: ["국민대 알고리즘우수자 전형 모집인원 10명"] }, { id: "s2", 창들: ["광운대 소프트웨어우수인재 전형은 72명을 선발한다"] }, { id: "s3", 창들: ["국민대학교 입학처"] }];
  const r = 판정읽기('```json\n{"판정":[{"id":"s1","판정":"맞음","근거":"알고리즘우수자전형 모집인원 10명"},{"id":"s2","판정":"맞음","근거":"광운대 소프트웨어우수인재 전형은 80명을 선발한다"},{"id":"s3","판정":"맞음","근거":"국민대학"}]}\n```', 대상);
  assert.equal(r.get("s1").판정, "맞음");
  assert.equal(r.get("s2").판정, "없음");
  assert.match(r.get("s2").왜, /원문에 없음/);
  assert.equal(r.get("s3").판정, "없음");
  assert.match(r.get("s3").왜, /너무 짧음/);
  assert.equal(r.못읽음, false);
  const 깨짐 = 판정읽기("{판정: [", 대상);
  assert.equal(깨짐.못읽음, true);
  assert.ok([...깨짐.values()].every((x) => x.판정 === "없음"));
  assert.equal(판정읽기('{"판정":[]}', 대상).get("s1").판정, "없음");            // 빠진 판정
  assert.equal(판정읽기('{"판정":[{"id":"s1","판정":"모름"}]}', 대상).get("s1").판정, "없음");
});

// ── 문장지우기
t("문장지우기 — 문단 < 80자 → 문단째 · 빈 절 → 소제목째 · 첫문단지움 감지", () => {
  const 첫 = "첫 문단입니다. 이 문장은 지웁니다. " + "가".repeat(90);
  const body = [첫, "## 절 하나", "지울 문단 하나뿐인 문장입니다.", "## 절 둘", "남는 문단입니다. " + "나".repeat(100)].join("\n\n");
  const r = 문장지우기(body, ["이 문장은 지웁니다.", "지울 문단 하나뿐인 문장입니다."]);
  assert.ok(!r.body.includes("이 문장은 지웁니다"));
  assert.ok(r.body.startsWith("첫 문단입니다."));
  assert.ok(!r.body.includes("## 절 하나"));
  assert.ok(r.body.includes("## 절 둘"));
  assert.equal(r.첫문단지움, false);
  assert.ok(r.지운것.some((s) => s.startsWith("(빈 절 소제목)")));
  const 짧은첫 = 문장지우기(["머리 문장입니다. 지울 문장입니다.", "## 절", "본문 " + "다".repeat(100)].join("\n\n"), ["지울 문장입니다."]);
  assert.equal(짧은첫.첫문단지움, true);                      // 남은 첫 문단이 80자 미만 → 문단째
  assert.ok(짧은첫.지운것.includes("(문단째) 머리 문장입니다."));
  const 그대로 = 문장지우기(body, []);
  assert.equal(그대로.body, body);
});

// ── 본문해시
t("본문해시 — 이미지 줄을 더해도 같음 · 글자 하나 바뀌면 다름", () => {
  const a = "첫 문단.\n\n## 절\n\n둘째 문단.";
  const b = "첫 문단.\n\n![도해](/blog/img/x/a.svg)\n\n## 절\n\n둘째 문단.";
  assert.equal(본문해시(a), 본문해시(b));
  assert.notEqual(본문해시(a), 본문해시(a.replace("둘째", "셋째")));
});

// ── 다음행동
t("다음행동 — 1·2회 실패 → 내일다시 · 3회 → 버림 · 한도 → 미룸 · 같은 날 두 번째 → 미룸 · 통과", () => {
  assert.equal(다음행동({ 회차: 1, 결과: "실패" }), "내일다시");
  assert.equal(다음행동({ 회차: 2, 결과: "실패" }), "내일다시");
  assert.equal(다음행동({ 회차: 3, 결과: "실패" }), "버림");
  assert.equal(다음행동({ 회차: 3, 결과: "한도" }), "미룸");
  assert.equal(다음행동({ 회차: 2, 결과: "미룸" }), "미룸");
  assert.equal(다음행동({ 회차: 1, 결과: "통과", 오늘감수있음: true }), "미룸");
  assert.equal(다음행동({ 회차: 1, 결과: "통과" }), "통과");
});

// ── 원장 관점 파서
t("원장 관점 파서 — 말리기 인용이 본문에 없음 → 실패 · 본문에 없는 걸림 → 버리고 기록 · 깨짐 → 실패", () => {
  const body = "앞 문장입니다. 대회 상장만 모으는 준비는 하지 마세요. 우리 학원으로 오세요.";
  const 통과 = 관점읽기('{"걸림":[{"문장":"없는 문장","종류":"광고"}],"말리기":"대회 상장만 모으는 준비는 하지 마세요."}', body);
  assert.equal(통과.통과, true);
  assert.equal(통과.버린걸림.length, 1);
  assert.equal(관점읽기('{"걸림":[],"말리기":"이런 문장은 본문에 없습니다"}', body).통과, false);
  const 걸림 = 관점읽기('{"걸림":[{"문장":"우리 학원으로 오세요.","종류":"학원홍보마무리"}],"말리기":"대회 상장만 모으는 준비는 하지 마세요."}', body);
  assert.equal(걸림.통과, false);
  assert.match(걸림.왜, /학원홍보마무리/);
  assert.equal(관점읽기("문제 없습니다", body).통과, false);
});

// ── 글기록말
const 금지 = /[A-Za-z_]{3,}|[{}[\]"]|null|undefined/;
t("글기록말 — 영문 키·JSON 조각 없음 · 우선순위(못냄 > 발행 > 감수 > 버림 > 고름)", () => {
  const 월 = "2026-10-05T01:00:00Z";
  const 줄들 = [
    글기록말([{ kind: "감수", attempt: 2, passed: false, why: "출처에 없는 숫자 1곳(국민대 정원)", at: 월 }], NOW),
    글기록말([{ kind: "발행", why: "「코딩으로 대학 가나요?」", at: "2026-10-06T00:00:00Z" }, { kind: "감수", attempt: 1, passed: true, at: 월 }], NOW),
    글기록말([{ kind: "못냄", why: "주제 2개 다 3번 걸림", at: 월 }, { kind: "발행", at: 월 }], NOW),
    글기록말([{ kind: "고름", why: "AI 답 4곳 중 0곳이 우리를 안 부름", at: 월 }], NOW),
    글기록말([{ kind: "재료부족", at: 월 }, { kind: "재료부족", at: 월 }], NOW),
    글기록말([{ kind: "내림", why: "원장 내림", at: "2026-10-09T00:00:00Z" }], NOW),
  ];
  assert.equal(줄들[0], "이번 주 글: 감수 2/3회 — 출처에 없는 숫자 1곳(국민대 정원)");
  assert.equal(줄들[1], "10/6 자동 발행 — 「코딩으로 대학 가나요?」");
  assert.equal(줄들[2], "이번 주 못 냄 — 주제 2개 다 3번 걸림");
  assert.match(줄들[3], /^이번 주 글: 주제 고름/);
  assert.equal(줄들[4], "이번 주 글: 주제 2개가 재료 부족으로 미뤄짐");
  assert.equal(줄들[5], "최근 7일 원장이 내린 글 1편");
  for (const s of 줄들) assert.ok(!금지.test(s), s);
  assert.equal(글기록말([{ kind: "감수", at: "2026-09-28T00:00:00Z" }], NOW), null); // 지난주
  // N일째 미룸 — 감수 기록이 2일 넘게 없으면(Should Fix)
  const 묵음 = 글기록말([], NOW, { 만든날: "2026-10-04T23:00:00Z", 마지막감수: null });
  assert.equal(묵음, "초안이 5일째 감수가 안 됨(한 번도 안 봄) — 14일이면 놓아줌");
  assert.match(글기록말([{ kind: "감수", attempt: 2, passed: false, why: "걸림", at: "2026-10-09T22:00:00Z" }], NOW, { 만든날: "2026-10-05T00:00:00Z", 마지막감수: "2026-10-09T22:00:00Z" }), /· 초안 5일째 감수 중/);
  assert.ok(!금지.test(묵음));
});

// ── 이번 주 글 SQL
t("이번 주 글 — 발행 기준(published_at) + 감수 중 초안(주제 있음·내리지 않음) · created_at 아님", () => {
  assert.match(이번주글SQL, /published_at >=/);
  assert.match(이번주글SQL, /\? '주제'/);
  assert.match(이번주글SQL, /'비공개이유'/);
  assert.ok(!/created_at >=/.test(이번주글SQL));
  assert.match(이번주글SQL, /created_at > now\(\) - interval '14 days'/);   // 14일 넘은 감수 중 초안은 막지 않는다(D97)
  assert.match(묵은초안SQL, /created_at <= now\(\) - interval '14 days'/);
});

// ── 다듬기검사
t("다듬기검사 — 숫자·소제목·링크·길이", () => {
  const 전 = "## 절\n\n10명을 뽑습니다. [출처](https://a.kr) 문장이 깁니다 문장이 깁니다.";
  assert.equal(다듬기검사(전, 전.replace("깁니다.", "깁니다!")), null);
  assert.match(다듬기검사(전, 전.replace("10명", "12명")), /숫자/);
  assert.match(다듬기검사(전, 전.replace("## 절", "## 다른")), /소제목/);
  assert.match(다듬기검사(전, "짧음"), /길이/);
  // 출처 대조 뒤에 바뀐 이름·제도어는 대조를 안 거친 사실이다 — 다듬은 글을 버린다(Must Fix 1)
  const 제도 = "## 절\n\n국민대가 알고리즘우수자 전형을 신설했습니다. 모집은 10명입니다. 문장이 깁니다 문장이 깁니다.";
  assert.match(다듬기검사(제도, 제도.replace("신설", "폐지")), /제도어/);
  assert.match(다듬기검사(제도, 제도.replace("국민대가", "서울대가")), /기관 이름/);
});

// ── 발행가능
const 글행 = (덧 = {}) => ({ body: "본문.\n\n![a](/blog/img/s/a.svg)", published: false, notes: {}, 그림: true, 내림: false, 빠진그림: false, ...덧 });
const 발행q = (행, 스위치 = "on") => 가짜((sql) => {
  if (sql.includes("from academy.posts")) return 행 ? [행] : [];
  if (sql.includes("post_auto_publish")) return 스위치 instanceof Error ? 스위치 : 스위치 === null ? [] : [{ value: 스위치 }];
  return [];
}).q;
t("발행가능 — 해시 다름·스위치 off·못 읽음·그림 없음·비공개이유 → false+왜 · 원장 버튼은 감수 없이 true", async () => {
  const 감수 = (body) => ({ 감수: { 통과: true, 해시: 본문해시(body) } });
  const 좋은 = 글행();
  좋은.notes = 감수(좋은.body);
  assert.deepEqual(await 발행가능(발행q(좋은), "s", { 자동: true }), { ok: true, 왜: "" });
  assert.match((await 발행가능(발행q({ ...좋은, notes: 감수("다른 본문") }), "s", { 자동: true })).왜, /본문이 바뀜/);
  assert.match((await 발행가능(발행q(좋은, "off"), "s", { 자동: true })).왜, /스위치/);
  assert.match((await 발행가능(발행q(좋은, null), "s", { 자동: true })).왜, /스위치/);
  assert.match((await 발행가능(발행q(좋은, new Error("x")), "s", { 자동: true })).왜, /스위치/);
  assert.match((await 발행가능(발행q({ ...좋은, 그림: false }), "s", { 자동: true })).왜, /도해/);
  assert.match((await 발행가능(발행q({ ...좋은, 내림: true }), "s", { 자동: true })).왜, /내린 글/);
  assert.match((await 발행가능(발행q({ ...좋은, 빠진그림: true }), "s")).왜, /저장 안 된/);
  assert.match((await 발행가능(발행q({ ...좋은, notes: {} }), "s", { 자동: true })).왜, /통과하지 않음/);
  assert.deepEqual(await 발행가능(발행q({ ...좋은, notes: {} }, "off"), "s"), { ok: true, 왜: "" });
});

// ── 발행 (원장 버튼 회귀 — publishDraft 가 하던 일 그대로)
t("발행 — 원장 버튼: 같은 조건 update → announce 일감 → review 완료 → 「원장 승인 발행」 · 주제 없으면 기록 안 함", async () => {
  const { q, 호출 } = 가짜((sql) => (sql.startsWith("update academy.posts") ? [{ client_id: 1, title: "제목", 주제키: null }] : []));
  const r = await 발행(q, "s", { 누가: "원장" });
  assert.equal(r.ok, true);
  const s = 호출.map((c) => c.sql);
  assert.match(s[0], /^update academy\.posts set published=true, published_at=now\(\)/);
  assert.match(s[0], /position\('!\[' in body\) > 0/);
  assert.match(s[0], /\? '비공개이유'/);
  assert.match(s[0], /academy\.post_images/);
  assert.match(s[1], /insert into geo\.agent_tasks .* 'announce'/);
  assert.deepEqual(JSON.parse(호출[1].params[4]), { slug: "s", sticky: true });
  assert.match(호출[1].params[3], /원장이 사실 확인 후 발행/);
  assert.match(s[2], /update geo\.agent_tasks set status='완료'/);
  assert.deepEqual(호출[2].params, [1, "review-s", "\n원장 확인 후 발행"]);
  assert.match(s[3], /insert into geo\.agent_activity/);
  assert.equal(호출[3].params[1], "원장 승인 발행");
  assert.equal(호출[3].params[3], "제목 (/blog/s)");
  assert.equal(호출.length, 4);
});
t("발행 — 자동: 활동 「자동 감수 통과 발행」 + post_reviews '발행' · 조건 안 맞으면 아무것도 안 함", async () => {
  const { q, 호출 } = 가짜((sql) => (sql.startsWith("update academy.posts") ? [{ client_id: 1, title: "제목", 주제키: "q:abc" }] : []));
  await 발행(q, "s", { 누가: "자동" });
  assert.equal(호출[3].params[1], "자동 감수 통과 발행");
  assert.match(호출[0].sql, /review_notes->'감수'->>'통과' = 'true'/);
  assert.equal(호출[0].params[1], true);
  assert.match(호출[4].sql, /insert into academy\.post_reviews/);
  assert.equal(호출[4].params[3], "발행");
  const 빈 = 가짜(() => []);
  assert.deepEqual(await 발행(빈.q, "s"), { ok: false });
  assert.equal(빈.호출.length, 1);
});

// ── 내리기
t("내리기 — published=false·비공개이유 → '내림' → 활동 → announce-removal → 네이버 사람 일감(SQL 순서)", async () => {
  const { q, 호출 } = 가짜((sql) => (sql.startsWith("update academy.posts") ? [{ client_id: 1, title: "제목", naver_log_no: "224", 주제키: "q:abc" }] : []));
  const r = await 내리기(q, "s", { 이유: "옛 지점 이야기", 블로그: "force11", now: NOW });
  assert.equal(r.ok, true);
  const s = 호출.map((c) => c.sql);
  assert.match(s[0], /set published=false/);
  assert.match(s[0], /'비공개이유'/);
  assert.equal(호출[0].params[1], "원장 내림 10/10: 옛 지점 이야기");
  assert.match(s[1], /academy\.post_reviews/);
  assert.equal(호출[1].params[3], "내림");
  assert.match(s[2], /geo\.agent_activity/);
  assert.match(s[3], /'announce-removal'/);
  assert.match(s[4], /'사람 대기'/);
  assert.equal(호출[4].params[4], "https://blog.naver.com/force11/224");
  // 네이버 글 없음 → 사람 일감 없음 · 이유 없음 → 「이유 안 적음」
  const 둘 = 가짜((sql) => (sql.startsWith("update academy.posts") ? [{ client_id: 1, title: "t", naver_log_no: null, 주제키: "" }] : []));
  await 내리기(둘.q, "s", { now: NOW });
  assert.equal(둘.호출.length, 4);
  assert.match(둘.호출[0].params[1], /이유 안 적음$/);
  assert.equal(둘.호출[1].params[2], "slug:s");
});

// ── (a) 출처 대조 — 가짜 fetch·가짜 판정 모델
const 기사 = `<html><head><script>var x=1;</script></head><body><nav>메뉴 2026-10-10</nav><article>
  <p>국민대 알고리즘우수자 전형은 10명을 선발하며, 1단계 서류 100%로 3배수를 뽑는다.</p>
  <p>광운대 소프트웨어우수인재 전형은 72명을 선발한다. ${"기사 본문이 이어진다. ".repeat(20)}</p></article></body></html>`;
const 응답 = (html, 종류 = "text/html; charset=utf-8") => new Response(html, { status: 200, headers: { "content-type": 종류 } });
const 가짜fetch = (지도) => async (u) => {
  const v = 지도[u];
  if (v instanceof Error) throw v;
  return v ?? new Response("없음", { status: 404 });
};
/** 창 안의 첫 30자를 근거로 「맞음」이라 답하는 판정 모델 — 근거가 창 부분문자열이라 통과한다 */
const 다맞음 = async (prompt) => {
  const 판정 = [...prompt.matchAll(/^# (s\d+)\n문장: .*\n창 1: (.+)$/gm)].map((m) => ({ id: m[1], 판정: "맞음", 근거: m[2].slice(0, 30) }));
  return { ok: true, text: JSON.stringify({ 판정 }) };
};
const 글몸 = (숫자) => [
  `국민대 알고리즘우수자 전형은 모집인원이 ${숫자}명입니다. 광운대 소프트웨어우수인재 전형은 72명을 뽑습니다. ${"이 문단은 판단을 적는 문단입니다. ".repeat(4)}`,
  "## 무엇을 볼까",
  "서류와 면접으로 사람을 봅니다. 상장을 모아 내면 끝나는 구조가 아닙니다. ".repeat(45),
  "## 출처",
  "- [기사](https://news.example/a)",
].join("\n\n");
t("출처 대조 — 같은 본문 「10명」→「12명」 가짜 초안: 그 문장 없음으로 지움 · 나머지 맞음", async () => {
  const { 출처대조 } = await import("./fact-check.mjs");
  const r = await 출처대조({ title: "t", body: 글몸(12) }, { 출처: ["https://news.example/a"] }, { fetch: 가짜fetch({ "https://news.example/a": 응답(기사) }), 클로드: 다맞음 });
  const 틀린 = r.문장.find((x) => x.문장.includes("12명"));
  assert.equal(틀린.판정, "없음");
  assert.ok(r.지운것.some((s) => s.includes("12명")));
  assert.equal(r.문장.find((x) => x.문장.includes("72명")).판정, "맞음");
  assert.equal(r.출처표[0].상태, "읽음");
  assert.ok(r.출처표[0].맞음 >= 1);
  const 맞는 = await 출처대조({ title: "t", body: 글몸(10) }, { 출처: ["https://news.example/a"] }, { fetch: 가짜fetch({ "https://news.example/a": 응답(기사) }), 클로드: 다맞음 });
  assert.equal(맞는.결과, "통과");
  assert.equal(맞는.지운것.length, 0);
});
t("출처 대조 — 라벨 없는 학원 1인칭 문장(저희 반·상담에서)은 주장 목록과 상관없이 지움 · 라벨 있으면 재료가 창", async () => {
  const { 출처대조 } = await import("./fact-check.mjs");
  const 몸 = 글몸(10).replace("## 무엇을 볼까", "저희 반 아이들은 스크래치로 시작합니다. 상담에서 학부모는 대부분 학년부터 묻습니다. 정보 수업에서 배우는 내용과 다릅니다.\n\n## 무엇을 볼까");
  const r = await 출처대조({ title: "t", body: 몸 }, { 출처: ["https://news.example/a"] }, { fetch: 가짜fetch({ "https://news.example/a": 응답(기사) }), 클로드: 다맞음 });
  const 저희 = r.문장.find((x) => x.문장.startsWith("저희 반"));
  assert.equal(저희.종류, "학원");
  assert.equal(저희.판정, "없음");
  assert.ok(r.지운것.some((x) => x.includes("저희 반")));
  assert.ok(r.지운것.some((x) => x.includes("상담에서")));
  assert.ok(!r.문장.some((x) => x.문장.startsWith("정보 수업에서")));            // 학교 수업은 표지 아님
  const 라벨 = await 출처대조({ title: "t", body: 몸 }, { 출처: ["https://news.example/a"], 재료표: [{ 라벨: "i1", 원문: "저희 반 아이들은 스크래치로 시작합니다 — 원장 상담 기록" }],
    주장: [{ 문장: "저희 반 아이들은 스크래치로 시작합니다.", 종류: "학원", 재료: ["i1"] }] }, { fetch: 가짜fetch({ "https://news.example/a": 응답(기사) }), 클로드: 다맞음 });
  assert.equal(라벨.문장.find((x) => x.문장.startsWith("저희 반")).판정, "맞음");
  assert.ok(학원표지.test("우리 학원 수업에서는") && !학원표지.test("학교 수업에서 배운다"));
});
t("출처 대조 — 판정 답을 못 읽으면 지우지 않고 미룸 + 답 원문 앞 500자", async () => {
  const { 출처대조 } = await import("./fact-check.mjs");
  const r = await 출처대조({ title: "t", body: 글몸(10) }, { 출처: ["https://news.example/a"] }, { fetch: 가짜fetch({ "https://news.example/a": 응답(기사) }), 클로드: async () => ({ ok: true, text: "죄송합니다, 판정할 수 없습니다" }) });
  assert.equal(r.결과, "미룸");
  assert.equal(r.답원문, "죄송합니다, 판정할 수 없습니다");
  assert.equal(r.지운것.length, 0);
});
t("출처 대조 — PDF·HTML 아님 = 못 읽음 · 전부 네트워크 오류 = 미룸 · 판정 한도 = 미룸", async () => {
  const { 출처대조, 출처가져오기 } = await import("./fact-check.mjs");
  // PDF 는 텍스트층을 읽는다(D96) — 글자층 있음 → 읽음 · 없음(스캔본) → 못 읽음 · 5MB 넘음 → 못 읽음 · octet-stream 도 머리로 알아봄
  const 글자층 = async () => ({ 글: "국제인재 전형 15명 신설. ".repeat(20), 쪽수: 3 });
  const 읽은PDF = await 출처가져오기("https://x/a.pdf", { fetch: async () => 응답("%PDF-1.4", "application/pdf"), pdf: 글자층 });
  assert.equal(읽은PDF.상태, "읽음");
  assert.equal(읽은PDF.PDF, true);
  assert.equal((await 출처가져오기("https://x/d.php", { fetch: async () => 응답("%PDF-1.4", "application/octet-stream"), pdf: 글자층 })).상태, "읽음");
  const 스캔 = await 출처가져오기("https://x/a.pdf", { fetch: async () => 응답("%PDF-1.4", "application/pdf"), pdf: async () => ({ 글: " ", 쪽수: 9 }) });
  assert.match(스캔.왜, /스캔본/);
  assert.equal(스캔.상태, "못 읽음");
  const 큰 = await 출처가져오기("https://x/a.pdf", { fetch: async () => 응답(`%PDF-${"x".repeat(5 * 1024 * 1024 + 10)}`, "application/pdf"), pdf: 글자층 });
  assert.match(큰.왜, /5MB/);
  assert.equal((await 출처가져오기("https://x/b", { fetch: async () => 응답("{}", "application/json") })).상태, "못 읽음");
  const dns = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
  assert.equal((await 출처가져오기("https://x/c", { fetch: async () => { throw dns; } })).상태, "네트워크");
  const 막힘 = await 출처대조({ title: "t", body: 글몸(10) }, { 출처: ["https://news.example/a"] }, { fetch: async () => { throw dns; }, 클로드: 다맞음 });
  assert.equal(막힘.결과, "미룸");
  const 한도 = await 출처대조({ title: "t", body: 글몸(10) }, { 출처: ["https://news.example/a"] }, { fetch: 가짜fetch({ "https://news.example/a": 응답(기사) }), 클로드: async () => ({ ok: false, 한도: true }) });
  assert.equal(한도.결과, "미룸");
});
t("출처 대조 — 판정 모델이 근거를 지어내면 없음 → 지워서 짧아지면 실패", async () => {
  const { 출처대조 } = await import("./fact-check.mjs");
  const 지어냄 = async (prompt) => ({ ok: true, text: JSON.stringify({ 판정: [...prompt.matchAll(/^# (s\d+)$/gm)].map((m) => ({ id: m[1], 판정: "맞음", 근거: "원문에 없는 그럴듯한 문장입니다" })) }) });
  const r = await 출처대조({ title: "t", body: 글몸(10) }, { 출처: ["https://news.example/a"] }, { fetch: 가짜fetch({ "https://news.example/a": 응답(기사) }), 클로드: 지어냄, 최소: 3000 });
  assert.ok(r.문장.every((x) => x.판정 === "없음"));
  assert.equal(r.결과, "실패");
  assert.match(r.왜, /첫 문단|못 미침/);
});

// ── (b) AI 티 규칙표 · (d) 가림
const { 티찾기, 가림찾기, AI티줄, 원장규칙 } = await import("./review-gates.mjs");
const 규칙표 = [
  ["서론", "서론으로 여는 말"],
  ["먼저 / 다음으로 / 마지막으로", "순서를 까는 연결어 세트"],
  ["결론에서 그대로 다시", "결론에서 앞 말 반복"],
  ["목록 남발", "목록 남발"],
  ["빈 강조", "빈 강조"],
  ["흐리게 끝내기", "흐린 마무리"],
  ["숫자를 피하는 말", "숫자를 피하는 말"],
  ["과장된 형용사", "과장 형용사"],
  ["양비론", "양비론"],
  ["구체가 없는 일반론", "일반론 문단"],
  ["아무나 쓸 수 있는 말", "아무나 쓰는 도입"],
];
t("AI 티 규칙표 — CLAUDE.md 「AI 가 쓴 티」 줄마다 잡는 규칙 이름이 있고, 그 이름이 slop-rules 에 있다", async () => {
  const fs = await import("node:fs");
  const md = fs.readFileSync(new URL("../../CLAUDE.md", import.meta.url), "utf8");
  const 줄들 = AI티줄(md);
  assert.ok(줄들.length >= 11, `AI 티 줄 ${줄들.length}개`);
  const 규칙src = fs.readFileSync(new URL("./slop-rules.mjs", import.meta.url), "utf8");
  for (const 줄 of 줄들) {
    const 짝 = 규칙표.find(([열쇠]) => 줄.includes(열쇠));
    assert.ok(짝, `규칙 없는 줄: ${줄}`);
    assert.ok(규칙src.includes(짝[1]), `slop-rules 에 「${짝[1]}」 없음`);
  }
  assert.ok(원장규칙(md), "절대 규칙 6줄을 못 읽음");
});
const 좋은글 = [
  "국민대가 2027학년도에 알고리즘우수자 전형을 새로 만들었습니다. 모집인원은 10명이고 서류와 면접으로 뽑습니다. 코딩 대회 상장을 모으는 준비와는 결이 다릅니다.",
  "## 무엇을 보나",
  "서류를 읽은 사람이 면접에서 되묻습니다. 무엇을 만들었고 왜 그렇게 풀었는지 본인 입으로 설명해야 넘어갑니다. 대회 실적만 쌓는 준비는 하지 마세요. 설명할 수 있는 결과물 하나가 낫습니다.",
  "## 초등 학부모라면",
  "지금 초등학생이 치를 입시는 2030년대입니다. 전형 이름은 몇 년 단위로 바뀝니다. 이름을 외우기보다 아이가 만든 것을 말로 설명하게 해 보는 쪽이 남습니다. 스크래치로 만든 게임 하나도 됩니다.",
].join("\n\n").repeat(1).padEnd(1600, " 스크래치로 만든 결과물을 설명하는 연습이 남습니다.");
t("AI 티 — 「우리 학원으로 오세요」로 닫으면 (b) 실패 · 제목 질문형 아님 · 소제목 5개", () => {
  const 끝홍보 = `${좋은글}\n\n궁금하시면 체험 수업으로 우리 학원으로 오세요. 아이에게 맞는 반을 같이 찾아 드립니다. 상담은 언제든 열려 있습니다. 편하게 연락 주세요.`;
  assert.ok(티찾기("코딩으로 대학 가나요?", 끝홍보).some((x) => x.startsWith("학원 홍보로 닫기")));
  assert.ok(티찾기("2027학년도 국민대 전형 10명 신설", 좋은글).some((x) => x.startsWith("제목이 질문형이 아님")));
  const 소제목많음 = `${좋은글}\n\n${Array.from({ length: 4 }, (_, i) => `## 절 ${i}\n\n${"판단을 적는 문단입니다. 스크래치 결과물을 설명합니다. ".repeat(3)}`).join("\n\n")}`;
  assert.ok(티찾기("코딩으로 대학 가나요?", 소제목많음).some((x) => /^소제목 \d+개/.test(x)));
  assert.ok(티찾기("코딩으로 대학 가나요?", `${좋은글}\n\n- 하나\n- 둘\n\n가운데 문단입니다. 스크래치 결과물을 설명합니다. 이 문단은 길이를 채우려고 판단을 적습니다. 판단을 적습니다.\n\n- 셋\n- 넷`).some((x) => x.startsWith("목록 남발")));
});
t("가림 — DB 고객 이름 → 실패 · 「로보티즈키즈랩」 → 실패 · 「로보티즈 드림」 → 통과 · 자기 글 링크는 통과", () => {
  const 말들 = ["아이로그", "ilog.kr"];
  assert.deepEqual(가림찾기("아이로그 같은 앱을 씁니다", 말들), ["아이로그"]);
  assert.deepEqual(가림찾기("예전 로보티즈키즈랩 반포교육원 시절", 말들), ["로보티즈키즈랩", "반포교육원"]);
  assert.deepEqual(가림찾기("로보티즈 드림 키트로 시작합니다. 자세한 건 /blog/koding-kurikyulleom-sunseo 에", 말들), []);
});

for (const [name, f] of 시험들) {
  try { await f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${String(e.message).split("\n").filter(Boolean).slice(0, 4).join(" ")}`); }
}
console.log(`${fail ? "✗" : "✓"} test-post-auto: ${pass} 통과 · ${fail} 실패`);
process.exitCode = fail ? 1 : 0;
