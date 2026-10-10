// 검색 판정·색인 알림 결과·감사 R5 제외 표(Step 40) 단위 시험 — 가짜 행만, DB·네트워크 없음.
//   node academy/scripts/test-serp-judge.mjs
// fixture 는 10/6~10/10 실제 꼴: 10/6·8·9 는 bing 만 쟀고, 10/7·10/10 은 bing·naver·naver_all 을 쟀다.
// 하나라도 틀리면 종료코드 1.
import assert from "node:assert/strict";
import { 검색판정, 색인결과, R5제외 } from "../serp-judge.mjs";

let fail = 0, pass = 0;
const t = (name, f) => {
  try { f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};

const 브랜드 = ["문서딱", "문서딱 계약서"];
const 경쟁 = ["계약서 자동 작성", "전자계약 무료", "임대차 계약서 양식"];
const 행 = (day, engine, kind, query, hit) => ({ day, engine, kind, query, hit });
/** 하루 측정. engines 마다 brandHit·rivalHit(검색어 → hit) */
const 그날 = (day, engines, { brandHit = {}, rivalHit = {} } = {}) => engines.flatMap((e) => [
  ...브랜드.map((q) => 행(day, e, "브랜드", q, e !== "bing" && (brandHit[q] ?? true))),
  ...경쟁.map((q) => 행(day, e, "경쟁", q, e !== "bing" && (rivalHit[q] ?? false))),
]);
const 네엔진 = ["bing", "naver", "naver_all"];

// 10/10 아침 — 오늘 네이버를 아직 안 쟀다. 최신 날(10/9)은 bing 만
const 아침 = [
  ...그날("2026-10-04", 네엔진),
  ...그날("2026-10-06", ["bing"]),
  ...그날("2026-10-07", 네엔진),
  ...그날("2026-10-08", ["bing"]),
  ...그날("2026-10-09", ["bing"]),
];

t("bing 만 잰 날이 최신이어도 7일 안 네이버 hit 면 브랜드 안 빠짐", () => {
  const r = 검색판정(아침, "2026-10-10", { 마지막적중일: null, 첫측정일: "2026-09-25" });
  assert.deepEqual(r.brandMiss, []);
});
t("브랜드 — 모든 엔진 최신 행이 안 나옴일 때만 빠짐, 엔진 목록", () => {
  const rows = [...아침, ...그날("2026-10-10", 네엔진, { brandHit: { "문서딱 계약서": false } })];
  const r = 검색판정(rows, "2026-10-10", {});
  assert.deepEqual(r.brandMiss, [{ query: "문서딱 계약서", engines: ["bing", "naver", "naver_all"] }]);
});
t("같은 날 두 번 쟀으면 한 번이라도 나온 것을 나온 것으로", () => {
  const rows = [행("2026-10-10", "naver", "브랜드", "문서딱", false), 행("2026-10-10", "naver", "브랜드", "문서딱", true)];
  assert.deepEqual(검색판정(rows, "2026-10-10", {}).brandMiss, []);
});
t("경쟁 won 은 검색어 기준(엔진 수 아님)", () => {
  const rows = [...아침, ...그날("2026-10-10", 네엔진, { rivalHit: { "전자계약 무료": true } })];
  const r = 검색판정(rows, "2026-10-10", { 마지막적중일: "2026-10-10", 첫측정일: "2026-09-25" });
  assert.deepEqual(r.rival, { won: 1, total: 3, zeroDays: null });
});
t("경쟁 0 — zeroDays 는 마지막으로 나온 날부터", () => {
  const r = 검색판정(아침, "2026-10-10", { 마지막적중일: "2026-09-30", 첫측정일: "2026-09-25" });
  assert.deepEqual(r.rival, { won: 0, total: 3, zeroDays: 10 });
});
t("경쟁 0 — 나온 적이 없으면 첫 측정일부터", () => {
  const r = 검색판정(아침, "2026-10-10", { 마지막적중일: null, 첫측정일: "2026-09-25" });
  assert.equal(r.rival.zeroDays, 15);
});
t("경쟁 0 — 기준일을 모르면 zeroDays null", () => {
  assert.equal(검색판정(아침, "2026-10-10", {}).rival.zeroDays, null);
});
t("7일 안 네이버 경쟁 hit 이 있으면 bing 만 잰 최신 날에도 won 유지", () => {
  const rows = [...그날("2026-10-07", 네엔진, { rivalHit: { "계약서 자동 작성": true } }), ...그날("2026-10-09", ["bing"])];
  assert.equal(검색판정(rows, "2026-10-10", { 마지막적중일: "2026-10-07" }).rival.won, 1);
});
t("7일 안 행 0 → null(판정 안 함)", () => {
  assert.equal(검색판정([], "2026-10-10", {}), null);
  assert.equal(검색판정(undefined, "2026-10-10", {}), null);
});

// ── 색인 알림 결과
t("색인결과 — 접수", () => assert.equal(색인결과("  Bing   HTTP 200 접수됨", true), "접수"));
t("색인결과 — 키없음(종료코드 0 이어도)", () => assert.equal(색인결과("문서딱\n  키 설정이 없습니다. 건너뜁니다.", true), "키없음"));
t("색인결과 — 실패", () => {
  assert.equal(색인결과("  Bing   HTTP 403 실패", true), "실패");
  assert.equal(색인결과("접수됨", false), "실패");
  assert.equal(색인결과(undefined, false), "실패");
});

// ── 감사 R5 제외
t("R5제외 — bytedance·duckduckgo 만, 사유 있음", () => {
  assert.deepEqual(Object.keys(R5제외).sort(), ["bytedance", "duckduckgo"]);
  assert.match(R5제외.bytedance, /감시 안 함/);
  assert.match(R5제외.duckduckgo, /빙/);
  assert.equal(R5제외.openai, undefined);
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
