// 계약 뒤 순서(Step 54) 단위 시험 — web/lib/onboard-core.mjs, 입력 꾸러미만. DB·네트워크 없음.
//   node academy/scripts/test-onboard-core.mjs
// 갈래: 진단 통과·파일럿 없음 · 구축 연 날 전후 · 세팅 기준선 전 개시 · 도메인 담당 셋 · 고객 느림 · 취소 · 자사 리허설 · 블로그 계정 · 빙←구글 · 숫자 없음 · KST · 환불 문장 · 폼 검사.
// 하나라도 틀리면 종료코드 1.
import fs from "node:fs";
import assert from "node:assert/strict";
import { 착수순서, onboard입력검사 } from "../../web/lib/onboard-core.mjs";

let fail = 0, pass = 0;
const t = (name, f) => {
  try { f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};

const 오늘 = "2026-10-17";
const 더하기 = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** 체크리스트() 모양 — 사이트에 빠진 것 2가지 · GSC 원장 몫 */
const 세팅줄 = (덮어 = {}) => [
  { id: "site", 칸: "사이트 열림", 상태: "됨", 사람말: "https://a.kr/ 가 열립니다(200)" },
  { id: "robots", 칸: "AI 크롤러 허용(robots)", 상태: "됨", 사람말: "AI 검색 로봇을 막는 줄이 없습니다" },
  { id: "sitemap", 칸: "사이트맵", 상태: "기다림", 사람말: "지금은 열리지 않습니다(404) — 「고칠 것」에 넣었습니다" },
  { id: "llms", 칸: "llms.txt", 상태: "기다림", 사람말: "지금은 없습니다(404) — 「고칠 것」에 넣었습니다" },
  { id: "jsonld", 칸: "홈 JSON-LD", 상태: "됨", 사람말: "홈에 Organization" },
  { id: "keyfile", 칸: "IndexNow 키 파일", 상태: "해당없음", 사람말: "우리가 색인 알림을 보내지 않는 고객입니다" },
  // Step 55b(D232) — 보낼글(고객에게)과 고칠것(기술 목록, 원장·세션만)이 나뉜다
  { id: "send", 칸: "고객 담당에게 보낼 것", 상태: "사람", 사람말: "2가지 빠졌습니다(사이트맵 · llms.txt) — 아래 글로 관리자 아이디를 받으면 우리가 고칩니다",
    보낼글: "안녕하세요, 미소치과 담당자님. 홈페이지에서 손볼 곳이 있어 저희가 직접 고치려고 합니다. 홈페이지 관리자 아이디를 알려 주시거나, 홈페이지를 만든 업체 연락처를 알려 주세요.",
    고칠것: "미소치과 사이트(https://a.kr)에서 고칠 것 2가지\n1. 사이트맵…\n2. llms.txt…" },
  { id: "gsc", 칸: "구글 서치콘솔 권한", 상태: "사람", 사람말: "원장 PC 가 아직 안 봤습니다. 권한을 받아야 구글 색인 요청을 돌릴 수 있습니다", 할일: "고객에게 …" },
  { id: "measure", 칸: "AI 측정(파일럿·질문 승인)", 상태: "기다림", 사람말: "…" },
  { id: "offsite", 칸: "바깥 글", 상태: "해당없음", 사람말: "꺼짐" },
].map((x) => (덮어[x.id] ? { ...x, ...덮어[x.id] } : x));

const 질문 = (n승인) => Array.from({ length: 20 }, (_, i) => ({ position: i + 1, approved: i < n승인 }));
const 업무 = (needs, 기한 = {}) => ["intake", "questions", "inquiry-sheet", "measure-start", "local-audit", "manual-baseline", "baseline-report",
  ...(needs === "none" ? [] : ["site-launch"]), "content-draft", "content-approve", "content-publish", "manual-day30", "final-report", "renewal"]
  .map((code) => ({ code, status: "대기", due_on: 기한[code] ?? 더하기(오늘, 3) }));

const 입력 = ({ row = {}, onboard, pilot = null, ...rest } = {}) => ({
  row: { id: 9, slug: "miso", name: "미소치과", domain: "a.kr", relation: "외부", status: "active", started_on: "2026-10-01", crawl_key: "ck",
    config: { v: 1, ...(onboard ? { onboard } : {}) }, ...row },
  derived: {}, 세팅줄: 세팅줄(), pilot,
  tasks: pilot ? 업무(pilot.needs_build) : [], questions: pilot ? 질문(0) : [], content: pilot ? [{ status: "주제 선정" }] : [],
  ai: [], checks: [], audits: [], 로그인일감: [], 크롤: null,
  ...rest,
});
const 파일럿 = (덮어 = {}) => ({ id: "p-1", status: "진행", needs_build: "none", paid_on: "2026-10-10", started_on: "2026-10-10", ends_on: "2026-11-08",
  refund_terms_sent_on: "2026-10-10", inquiry_key: "k-1", ...덮어 });
const 줄 = (r, stage, id) => r.단계.find((s) => s.id === stage)?.줄.find((x) => x.id === id);
const 순서 = (r) => r.단계.map((s) => s.id).join(",");
const NONE = "contract,receive,site,kickoff,baseline,run30,day30";
const BUILD = "contract,receive,kickoff,baseline,site,run30,day30";

t("1 진단 통과·파일럿 없음 → none 순서 · contract.pilot 원장님 몫", () => {
  const r = 착수순서(입력(), 오늘);
  assert.equal(순서(r), NONE);
  const p = 줄(r, "contract", "pilot");
  assert.equal(p.상태, "원장님 몫");
  assert.equal(p.사람말, "계약이 되면 파일럿 시작 칸을 넣습니다 — 필요한 준비도 거기서 고릅니다");
  assert.equal(p.링크, "/admin/clients/miso#pilot");
  assert.deepEqual(r.단계.find((s) => s.id === "contract").줄.map((x) => x.id), ["refund", "paid", "invoice", "pilot"]);
  assert.deepEqual(r.단계.find((s) => s.id === "kickoff").줄.map((x) => x.id), ["questions", "first-measure", "inquiry-sheet"]);
  assert.deepEqual(r.단계.find((s) => s.id === "baseline").줄.map((x) => x.id), ["local-audit", "manual-baseline", "baseline-report"]);
  assert.deepEqual(r.단계.find((s) => s.id === "run30").줄.map((x) => x.id), ["period", "content-draft", "content-approve", "content-publish"]);
  assert.deepEqual(r.단계.find((s) => s.id === "day30").줄.map((x) => x.id), ["manual-day30", "final-report", "renewal"]);
  assert.deepEqual(r.단계.find((s) => s.id === "site").줄.map((x) => x.id), ["site", "robots", "sitemap", "llms", "jsonld", "keyfile", "send"]);
  assert.equal(r.다음고비, null);
});

t("2 구축·연 날 없음 → 세팅·구축 순서 · 세팅줄 전부 해당없음 · launch 원장님 몫", () => {
  const r = 착수순서(입력({ pilot: 파일럿({ needs_build: "build" }) }), 오늘);
  assert.equal(순서(r), BUILD);
  const site = r.단계.find((s) => s.id === "site").줄;
  assert.deepEqual(site.map((x) => x.id), ["site", "robots", "sitemap", "llms", "jsonld", "keyfile", "send", "draft", "launch", "crawl"]);
  for (const id of ["site", "robots", "sitemap", "llms", "jsonld", "keyfile", "send"]) {
    assert.equal(줄(r, "site", id).상태, "해당없음", id);
    assert.equal(줄(r, "site", id).사람말, "사이트를 연 뒤 점검합니다");
  }
  assert.equal(줄(r, "site", "launch").상태, "원장님 몫");
  assert.equal(줄(r, "site", "crawl").상태, "아직");
  assert.equal(줄(r, "run30", "period").사람말, "사이트 연 날 미입력 — 30일 아직 안 셈");
  const setup = 착수순서(입력({ pilot: 파일럿({ needs_build: "setup" }) }), 오늘);
  assert.equal(순서(setup), BUILD);
  assert.deepEqual(setup.단계.find((s) => s.id === "site").줄.map((x) => x.id).slice(-2), ["report", "launch"]);
  assert.equal(줄(setup, "site", "sitemap").상태, "도는 중", "세팅은 사이트가 있으니 세팅줄 그대로");
});

t("3 구축·연 날 있음·크롤 12 → 세팅줄 살아남 · crawl 근거 12 / 못읽음 → 못 읽음", () => {
  const p = 파일럿({ needs_build: "build", kickoff_on: "2026-09-20", baseline_sent_at: "2026-09-27T03:00:00Z", site_launch_on: "2026-10-01", started_on: "2026-10-01", ends_on: "2026-10-30" });
  const r = 착수순서(입력({ pilot: p, 크롤: { n7: 12, last: "2026-10-16T16:10:00Z" } }), 오늘);
  assert.equal(줄(r, "site", "site").상태, "됨");
  assert.equal(줄(r, "site", "send").상태, "원장님 몫");
  const c = 줄(r, "site", "crawl");
  assert.equal(c.근거, "12");
  assert.match(c.사람말, /최근 7일 12번 · 마지막 10\/17/);
  const 못 = 줄(착수순서(입력({ pilot: p, 크롤: "못읽음" }), 오늘), "site", "crawl");
  assert.equal(못.상태, "못 읽음");
  assert.ok(!/\d/.test(`${못.사람말}${못.근거 ?? ""}`), 못.사람말);
  const 없음 = 줄(착수순서(입력({ pilot: p, 크롤: null }), 오늘), "site", "crawl");
  assert.equal(없음.사람말, "방문 기록 없음");
  assert.equal(줄(r, "run30", "period").사람말, "10/1~10/30 · 남은 13일");
  // D219 — DB started_on·ends_on 이 낡아도(연 날 전 임시 착수+29) 30일은 연 날부터 센다(pilot-plan.mjs 파일럿일정: 시작 + 29)
  const 낡음 = 착수순서(입력({ pilot: { ...p, started_on: "2026-09-20", ends_on: "2026-10-19" }, 크롤: null }), 오늘);
  assert.equal(줄(낡음, "run30", "period").사람말, "10/1~10/30 · 남은 13일");
  assert.equal(줄(낡음, "day30", "manual-day30").사람말, "30일 끝(10/30)에 합니다");
});

t("4 세팅·연 날 < 착수+7 → 띠 경고", () => {
  const p = 파일럿({ needs_build: "setup", kickoff_on: "2026-10-10", site_launch_on: "2026-10-14" });
  const r = 착수순서(입력({ pilot: p }), 오늘);
  assert.ok(r.띠.some((x) => x.includes("전후 비교가 깨집니다")), r.띠.join(" | "));
  const ok = 착수순서(입력({ pilot: { ...p, site_launch_on: "2026-10-17" } }), 오늘);
  assert.ok(!ok.띠.some((x) => x.includes("전후 비교")), "착수+7 이면 경고 없음");
});

t("5 도메인 담당 고객/우리/모름 → send 줄 누가·보낼글 셋 다름", () => {
  // dns 「우리」면 체크리스트 send 는 기다림 + 고칠것(보낼글 없음, 55b)
  const 우리줄 = 세팅줄({ send: { 상태: "기다림", 사람말: "우리가 고칩니다: 사이트맵 · llms.txt", 보낼글: undefined } });
  const 셋 = ["고객", "우리", "모름"].map((dns) => 줄(착수순서({ ...입력({ onboard: { dns } }), ...(dns === "우리" ? { 세팅줄: 우리줄 } : {}) }, 오늘), "site", "send"));
  assert.deepEqual(셋.map((x) => x.누가), ["원장님", "Claude 세션", "원장님"]);
  assert.equal(셋[0].보낼글, "안녕하세요, 미소치과 담당자님. 홈페이지에서 손볼 곳이 있어 저희가 직접 고치려고 합니다. 홈페이지 관리자 아이디를 알려 주시거나, 홈페이지를 만든 업체 연락처를 알려 주세요.");
  assert.equal(셋[1].보낼글, undefined);
  assert.match(셋[1].사람말, /우리가 직접 고칩니다 — 빠진 2가지를/);
  assert.match(셋[1].근거, /^미소치과 사이트\(https:\/\/a\.kr\)에서 고칠 것 2가지/);
  assert.equal(셋[2].보낼글, "안녕하세요, 미소치과 담당자님.\n홈페이지 관리자 아이디를 알려 주시거나, 홈페이지를 만든 업체 연락처를 알려 주세요. 손볼 곳은 저희가 직접 고칩니다.");
  assert.equal(new Set(셋.map((x) => `${x.누가}|${x.보낼글}`)).size, 3);
  assert.equal(줄(착수순서(입력(), 오늘), "receive", "dns").상태, "원장님 몫", "안 고르면 원장님 몫");
});

t("6 intake 기한 오늘−4 → 4일째 + 재촉 글 · 오늘+1 → 기한 M/D, 보낼글 없음", () => {
  const p = 파일럿();
  const 늦음 = 입력({ pilot: p });
  늦음.tasks = 업무("none", { intake: 더하기(오늘, -4) });
  const x = 줄(착수순서(늦음, 오늘), "receive", "intake");
  assert.equal(x.상태, "고객 기다림");
  assert.match(x.사람말, /4일째/);
  assert.match(x.보낼글, /^안녕하세요, 미소치과 담당자님\.\n사업자 정보와/);
  assert.match(x.보낼글, /답장으로 보내 주시거나/);
  assert.ok(!/늦|서두르|놓치/.test(x.보낼글), "불안 팔지 않음");
  const r = 착수순서(늦음, 오늘);
  assert.equal(r.요약.고객최장일 >= 4, true);
  const 이름 = 입력({ pilot: p });
  이름.tasks = 업무("none", { intake: 더하기(오늘, 1) });
  const y = 줄(착수순서(이름, 오늘), "receive", "intake");
  assert.match(y.사람말, /기한 10\/18/);
  assert.equal(y.보낼글, undefined);
});

t("7 진단 통과·승인 안 옴 → 30일은 M/D 에 끝납니다", () => {
  const x = 줄(착수순서(입력({ pilot: 파일럿() }), 오늘), "kickoff", "questions");
  assert.equal(x.상태, "고객 기다림");
  assert.match(x.사람말, /승인 0\/20/);
  assert.match(x.사람말, /승인이 늦어도 30일은 11\/8 에 끝납니다\(신청서 8행\)/);
  const b = 줄(착수순서(입력({ pilot: 파일럿({ needs_build: "build" }) }), 오늘), "kickoff", "questions");
  assert.ok(!b.사람말.includes("30일은"), "구축은 30일이 연 날부터라 이 말 없음");
});

t("8 취소 → 띠 취소 · 모든 줄 해당없음 · 금액 없음 → 금액 미입력", () => {
  const r = 착수순서(입력({ pilot: 파일럿({ cancelled_on: "2026-10-12" }) }), 오늘);
  assert.equal(r.띠[0], "10/12 취소 · 금액 미입력");
  const 전부 = r.단계.flatMap((s) => s.줄);
  assert.ok(전부.every((x) => x.상태 === "해당없음" && !x.보낼글), 전부.find((x) => x.상태 !== "해당없음")?.id);
  assert.equal(r.다음고비, null);
  const 금액 = 착수순서(입력({ pilot: 파일럿({ cancelled_on: "2026-10-12", refund_amount: 195000 }) }), 오늘);
  assert.equal(금액.띠[0], "10/12 취소 · 돌려드린 금액 195,000원");
});

t("9 자사·리허설 → 계약 줄 해당없음 · 리허설 띠", () => {
  const r = 착수순서(입력({ row: { relation: "자사" }, pilot: 파일럿({ status: "리허설" }) }), 오늘);
  assert.ok(r.단계.find((s) => s.id === "contract").줄.every((x) => x.상태 === "해당없음"));
  assert.deepEqual(r.띠, ["리허설 — 계약 줄은 없습니다"]);
  const 늦음 = 입력({ row: { relation: "자사" }, pilot: 파일럿({ status: "리허설" }) });
  늦음.tasks = 업무("none", { intake: 더하기(오늘, -9) });
  assert.equal(줄(착수순서(늦음, 오늘), "receive", "intake").보낼글, undefined, "자사엔 재촉 글 없음");
  const 자사만 = 착수순서(입력({ row: { relation: "자사" } }), 오늘);
  assert.ok(자사만.단계.find((s) => s.id === "contract").줄.every((x) => x.상태 === "해당없음"));
});

t("10 블로그 받음 — 저장일 없음 / 로그인 일감 열림 / 못읽음", () => {
  const a = 줄(착수순서(입력({ onboard: { blog: "받음" } }), 오늘), "receive", "blog");
  assert.equal(a.상태, "원장님 몫");
  assert.match(a.사람말, /node tools\/save-login\.mjs naver-miso/);
  const b = 줄(착수순서(입력({ onboard: { blog: "받음", blogSavedOn: "2026-10-05" }, 로그인일감: [{ dedupe_key: "naver-session-soon", title: "네이버 로그인이 곧 풀립니다", status: "사람 대기" }] }), 오늘), "receive", "blog");
  assert.equal(b.상태, "원장님 몫");
  assert.match(b.사람말, /네이버 로그인이 곧 풀립니다/);
  const c = 줄(착수순서(입력({ onboard: { blog: "받음", blogSavedOn: "2026-10-05" }, 로그인일감: "못읽음" }), 오늘), "receive", "blog");
  assert.equal(c.상태, "못 읽음");
  const d = 줄(착수순서(입력({ onboard: { blog: "받음", blogSavedOn: "2026-10-05" } }), 오늘), "receive", "blog");
  assert.equal(d.상태, "됨");
  assert.match(d.사람말, /10\/5/);
});

t("11 빙 아직 — 구글 안 됨 → 아직 / 구글 됨 → 원장님 몫", () => {
  const a = 줄(착수순서(입력({ onboard: { bing: "아직" } }), 오늘), "receive", "bing");
  assert.equal(a.상태, "아직");
  const 됨 = 입력({ onboard: { bing: "아직" } });
  됨.세팅줄 = 세팅줄({ gsc: { 상태: "됨", 사람말: "권한을 받았다고 표시했습니다", 할일: undefined } });
  const b = 줄(착수순서(됨, 오늘), "receive", "bing");
  assert.equal(b.상태, "원장님 몫");
  assert.match(b.사람말, /가져오기/);
});

t("12 측정·손 확인 비었음 → 아직 측정 없음 · 출력 어디에도 % 없음", () => {
  const p = 파일럿({ questions_approved_at: "2026-10-12T01:00:00Z" });
  const r = 착수순서(입력({ pilot: p }), 오늘);
  assert.match(줄(r, "kickoff", "first-measure").사람말, /아직 측정 없음/);
  const k = 착수순서(입력({ pilot: { ...p, kickoff_on: "2026-10-13" } }), 오늘);
  assert.match(줄(k, "baseline", "manual-baseline").사람말, /손 확인 기록 없음/);
  assert.match(줄(k, "baseline", "local-audit").사람말, /점검 칸 기록 없음/);
  for (const x of [r, k]) {
    const 글 = JSON.stringify({ 요약: x.요약, 다음고비: x.다음고비, 단계: x.단계 });
    assert.ok(!/\d+\s*%/.test(글), 글.match(/.{20}\d+\s*%.{10}/)?.[0]);
  }
  assert.ok(!/\d+\s*%/.test(JSON.stringify(r)), "착수 전 띠도 % 없음");
  // 측정이 있으면 받은 숫자만
  const m = 착수순서(입력({ pilot: { ...p, kickoff_on: "2026-10-13" }, ai: [{ day: "2026-10-09", n: 40 }, { day: "2026-10-11", n: 80 }, { day: "2026-10-16", n: 80 }] }), 오늘);
  assert.equal(줄(m, "kickoff", "first-measure").사람말, "착수 10/13 · 마지막 측정 10/16 · 최근 7일 160건");
  assert.equal(m.다음고비, "기준선 보고 10/20");
});

t("기록표 주소 = https://cited.kr/record/ (D218)", () => {
  const x = 줄(착수순서(입력({ pilot: 파일럿() }), 오늘), "kickoff", "inquiry-sheet");
  const 주소 = x.보낼글.split("\n").at(-1);
  assert.ok(주소.startsWith("https://cited.kr/record/"), 주소);
  assert.equal(주소, "https://cited.kr/record/k-1");
  const 넘김 = 줄(착수순서({ ...입력({ pilot: 파일럿() }), site: "https://cited.kr" }, 오늘), "kickoff", "inquiry-sheet");
  assert.ok(넘김.보낼글.endsWith("https://cited.kr/record/k-1"));
});

t("서치어드바이저 확인 파일 보냄 — 보낸 날 기록이 없어 일수·재촉 글 없음 (D220)", () => {
  const x = 줄(착수순서(입력({ pilot: 파일럿({ paid_on: "2026-10-01" }), onboard: { naverSa: "확인파일보냄", dns: "고객" } }), 오늘), "receive", "naversa");
  assert.equal(x.상태, "고객 기다림");
  assert.ok(!/\d+일째|기한/.test(x.사람말), x.사람말);
  assert.equal(x.보낼글, undefined);
  assert.equal(x.일수, undefined);
});

t("13 KST 경계 — UTC 10/16 15:30 = KST 10/17 00:30", () => {
  const now = Date.UTC(2026, 9, 16, 15, 30);
  const x = 입력({ pilot: 파일럿() });
  x.tasks = 업무("none", { intake: "2026-10-13" });
  assert.match(줄(착수순서(x, now), "receive", "intake").사람말, /4일째/);
  const 전날 = Date.UTC(2026, 9, 16, 14, 59);
  assert.match(줄(착수순서(x, 전날), "receive", "intake").사람말, /3일째/);
  const b = 착수순서(입력({ pilot: 파일럿({ kickoff_on: "2026-10-10", baseline_sent_at: "2026-10-16T15:30:00Z" }) }), 오늘);
  assert.equal(줄(b, "baseline", "baseline-report").사람말, "10/17 보냈습니다");
});

t("14 띠 환불 세 문장 = pilot-plan.ts refundGuide 글자", () => {
  const 원문 = fs.readFileSync(new URL("../../web/lib/pilot-plan.ts", import.meta.url), "utf8");
  const 몸 = /export function refundGuide[\s\S]*?\n}/.exec(원문)?.[0] ?? "";
  const 문장 = [...몸.matchAll(/return "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(문장.length, 3, 몸);
  const 띠들 = [
    착수순서(입력({ pilot: 파일럿() }), 오늘).띠,
    착수순서(입력({ pilot: 파일럿({ kickoff_on: "2026-10-12" }) }), 오늘).띠,
    착수순서(입력({ pilot: 파일럿({ kickoff_on: "2026-10-12", baseline_sent_at: "2026-10-16T01:00:00Z" }) }), 오늘).띠,
  ];
  문장.forEach((s, i) => assert.ok(띠들[i].includes(`지금 취소하면: ${s}`), `${s} ↔ ${띠들[i].join(" | ")}`));
});

t("15 onboard입력검사 — 모르는 값·javascript:·201자·2026-13-01 거부 / 정상 통과", () => {
  const 정상 = { dns: "우리", naverSa: "확인파일보냄", bing: "아직", blog: "받음", migrateState: "진행", migrate: "on", noChannels: "",
    ch_blog: "https://blog.naver.com/miso", ch_place: "", ch_sns: "http://instagram.com/miso", blogSavedOn: "2026-10-05", draftShownOn: "", setupReportOn: "" };
  const r = onboard입력검사(정상);
  assert.ok(r.ok, r.오류.join(" / "));
  assert.deepEqual(r.칸, { dns: "우리", naverSa: "확인파일보냄", bing: "아직", blog: "받음", migrateState: "진행", migrate: true, noChannels: false,
    channels: { blog: "https://blog.naver.com/miso", place: null, sns: "http://instagram.com/miso" }, blogSavedOn: "2026-10-05", draftShownOn: null, setupReportOn: null });
  assert.ok(!onboard입력검사({ ...정상, dns: "누구" }).ok);
  assert.ok(!onboard입력검사({ ...정상, ch_blog: "javascript:alert(1)" }).ok);
  assert.ok(!onboard입력검사({ ...정상, ch_sns: `https://a.kr/${"a".repeat(201 - 13)}` }).ok);
  assert.equal(`https://a.kr/${"a".repeat(201 - 13)}`.length, 201);
  assert.ok(onboard입력검사({ ...정상, ch_sns: `https://a.kr/${"a".repeat(200 - 13)}` }).ok, "200자는 통과");
  assert.ok(!onboard입력검사({ ...정상, blogSavedOn: "2026-13-01" }).ok);
  assert.ok(!onboard입력검사({ ...정상, migrate: "yes" }).ok);
  assert.ok(onboard입력검사({}).ok, "빈 폼은 전부 비움으로 통과");
});

t("요약 · 다음 고비 · 사람말에 영문 상태값 없음", () => {
  const r = 착수순서(입력({ pilot: 파일럿({ kickoff_on: "2026-10-12" }) }), 오늘);
  assert.ok(r.요약.원장 >= 1 && r.요약.고객 >= 1);
  assert.equal(r.다음고비, "기준선 보고 10/19");
  const 글 = r.단계.flatMap((s) => s.줄.map((x) => x.사람말)).join(" ");
  assert.ok(!/\b(none|setup|build|pending|done|todo)\b/.test(글), 글.match(/\b(none|setup|build|pending|done|todo)\b/)?.[0]);
});

console.log(`${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
