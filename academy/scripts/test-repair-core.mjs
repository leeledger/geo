// 자동 코드 수리 판정(Step 42) 단위 시험 — web/lib/repair-core.mjs. DB·git·claude 없음.
//   node academy/scripts/test-repair-core.mjs
// 멈춤 합치기(무거운 쪽 유지) · 재개 시각·판정 · 연속 불합격 · 7일 만료 · 숫자에 닿음 · 무인 합치기 문(D80) · 현황판 문구.
// 하나라도 틀리면 종료코드 1.
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  멈춤합치기, 멈춤읽기, 재개시각, 재개판정, 연속불합격, 만료인가, 숫자경로, 숫자닿음, 무인합치기, 수리상태,
} from "../../web/lib/repair-core.mjs";

let fail = 0, pass = 0;
const t = (name, f) => {
  try { f(); pass++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`); }
};

const 시 = 3600000, 일 = 24 * 시;
const T0 = Date.parse("2026-10-01T00:00:00Z");
const iso = (ms) => new Date(ms).toISOString();
const 실패 = { kind: "revert-failed", reason: "되돌리기 실패 (수리 3)", at: iso(T0) };
const 두번 = { kind: "revert-twice", reason: "7일에 되돌림 2번", at: iso(T0), last_revert_at: iso(T0) };
const 불합격 = { kind: "review-fail-3", reason: "검토 연속 3번 불합격", at: iso(T0) };

// ── 멈춤합치기
t("멈춤합치기 — revert-failed 위 revert-twice·review-fail-3 → revert-failed 유지", () => {
  assert.equal(멈춤합치기(실패, 두번).kind, "revert-failed");
  assert.equal(멈춤합치기(실패, 불합격).kind, "revert-failed");
});
t("멈춤합치기 — review-fail-3 위 revert-twice → revert-twice", () => {
  assert.equal(멈춤합치기(불합격, 두번).kind, "revert-twice");
});
t("멈춤합치기 — 옛 멈춤(legacy) 위 가벼운 멈춤 → legacy 유지 · 멈춤 없음 → 새것", () => {
  assert.equal(멈춤합치기(멈춤읽기("true", null), 불합격).kind, "legacy");
  assert.equal(멈춤합치기(null, 불합격).kind, "review-fail-3");
});
t("멈춤읽기 — 'true' 아니면 멈춤 아님 · JSON 없음/깨짐 → legacy", () => {
  assert.equal(멈춤읽기("false", JSON.stringify(두번)), null);
  assert.equal(멈춤읽기(undefined, undefined), null);
  assert.equal(멈춤읽기("true", undefined).kind, "legacy");
  assert.equal(멈춤읽기("true", "{깨짐").kind, "legacy");
  assert.equal(멈춤읽기("true", JSON.stringify(두번)).kind, "revert-twice");
});

// ── 재개시각
t("재개시각 — revert-twice = 마지막 되돌림+7일 · review-fail-3 = at+7일 · revert-failed/legacy = null", () => {
  assert.equal(재개시각({ ...두번, at: iso(T0 - 일), last_revert_at: iso(T0) }), T0 + 7 * 일);
  assert.equal(재개시각(불합격), T0 + 7 * 일);
  assert.equal(재개시각(실패), null);
  assert.equal(재개시각(멈춤읽기("true", null)), null);
});

// ── 재개판정
const 없음 = { revertsSince: 0, recurring: 0 };
t("재개판정 — 6일 23시간 false", () => assert.equal(재개판정(두번, 없음, T0 + 7 * 일 - 시).ok, false));
t("재개판정 — 7일 + 되돌림 0 + 재발 0 → true", () => assert.equal(재개판정(두번, 없음, T0 + 7 * 일 + 1).ok, true));
t("재개판정 — 7일 + 그 뒤 되돌림 1 → false", () => assert.equal(재개판정(두번, { revertsSince: 1, recurring: 0 }, T0 + 8 * 일).ok, false));
t("재개판정 — 7일 + 재발 1 → false", () => assert.equal(재개판정(두번, { revertsSince: 0, recurring: 1 }, T0 + 8 * 일).ok, false));
t("재개판정 — review-fail-3 7일 → true · 6일 → false", () => {
  assert.equal(재개판정(불합격, 없음, T0 + 7 * 일 + 1).ok, true);
  assert.equal(재개판정(불합격, 없음, T0 + 6 * 일).ok, false);
});
t("재개판정 — revert-failed 30일 false (사람이 main 확인)", () => {
  const r = 재개판정(실패, 없음, T0 + 30 * 일);
  assert.equal(r.ok, false);
  assert.equal(r.why, "되돌리기 실패 — 사람이 main 확인");
});
t("재개판정 — legacy 30일 false", () => assert.equal(재개판정(멈춤읽기("true", null), 없음, T0 + 30 * 일).ok, false));

// ── 연속불합격
const 행 = (status) => ({ id: 1, status, note: "" });
t("연속불합격 — 3 fail true", () => assert.equal(연속불합격([행("검토 불합격"), 행("검토 불합격"), 행("검토 불합격")]), true));
t("연속불합격 — 2 fail + 승인 대기 false", () => assert.equal(연속불합격([행("검토 불합격"), 행("승인 대기"), 행("검토 불합격")]), false));
t("연속불합격 — 2행 false", () => assert.equal(연속불합격([행("검토 불합격"), 행("검토 불합격")]), false));

// ── 만료인가
const 지금 = Date.parse("2026-10-10T00:00:00Z");
t("만료인가 — 167시간 false · 169시간 true · 합침 false", () => {
  assert.equal(만료인가({ status: "승인 대기", created_at: iso(지금 - 167 * 시) }, 지금), false);
  assert.equal(만료인가({ status: "승인 대기", created_at: iso(지금 - 169 * 시) }, 지금), true);
  assert.equal(만료인가({ status: "승인 대기", created_at: new Date(지금 - 169 * 시) }, 지금), true, "pg 는 Date 로 준다");
  assert.equal(만료인가({ status: "합침", created_at: iso(지금 - 300 * 시) }, 지금), false);
});

// ── 숫자닿음
t("숫자닿음 — ai-measure true · write-draft false · 확정 목록 전부 true", () => {
  assert.equal(숫자닿음(["academy/scripts/ai-measure.mjs"]), true);
  assert.equal(숫자닿음(["academy/scripts/write-draft.mjs"]), false);
  assert.equal(숫자닿음([]), false);
  for (const n of 숫자경로) assert.equal(숫자닿음([`academy/scripts/${n}.mjs`]), true, n);
});
t("숫자경로 — 목록의 파일이 전부 저장소에 있다", () => {
  for (const n of 숫자경로) assert.ok(fs.existsSync(new URL(`./${n}.mjs`, import.meta.url)), `${n}.mjs 없음`);
});

// ── 무인 합치기 문(D80) — 「합치기는 늘 승인」
t("무인합치기 — REPAIR_ENABLED=1 · UNATTENDED 빈 값 · 승인 5건(견습 끝) → 무인 합치기 안 됨", () => {
  assert.equal(무인합치기({ REPAIR_ENABLED: "1", REPAIR_UNATTENDED: "" }, true, false), false);
  assert.equal(무인합치기({ REPAIR_ENABLED: "1" }, true, false), false);
});
t("무인합치기 — 둘 다 1 + 견습 끝 → 무인 · 견습 안 끝남/needs_owner/스위치 0 → 안 됨", () => {
  assert.equal(무인합치기({ REPAIR_ENABLED: "1", REPAIR_UNATTENDED: "1" }, true, false), true);
  assert.equal(무인합치기({ REPAIR_ENABLED: "1", REPAIR_UNATTENDED: "1" }, false, false), false);
  assert.equal(무인합치기({ REPAIR_ENABLED: "1", REPAIR_UNATTENDED: "1" }, true, true), false);
  assert.equal(무인합치기({ REPAIR_ENABLED: "", REPAIR_UNATTENDED: "1" }, true, false), false);
});

// ── 수리상태
const 금지 = /켜|원장님 결정/;
t("수리상태 — 고칠 것 없음", () => assert.deepEqual(수리상태({ pending: 0, queue: 0 }), { kind: "none", text: "고칠 것 없음" }));
t("수리상태 — 만드는 중", () => assert.deepEqual(수리상태({ pending: 0, queue: 2 }), { kind: "making", text: "수리안 만드는 중 — 2건 대기, 매일 06:50 1건" }));
t("수리상태 — 승인 기다림 · 만들 것 · 스위치 꺼짐", () => {
  assert.equal(수리상태({ pending: 1, queue: 0, switchOn: true }).text, "승인 기다림 1건");
  assert.equal(수리상태({ pending: 2, queue: 3, switchOn: null }).text, "승인 기다림 2건 · 수리안 만들 것 3건");
  assert.equal(수리상태({ pending: 1, queue: 1, switchOn: false }).text, "승인 기다림 1건 · 수리안 만들 것 1건 · 비상 스위치가 꺼져 있어 합치기가 막혀 있음");
});
t("수리상태 — paused 가 pending 보다 앞 · 재개 날짜", () => {
  const s = 수리상태({ paused: true, pause: 두번, pending: 2, queue: 1 });
  assert.equal(s.kind, "paused");
  assert.equal(s.text, "스스로 멈춤 — 7일 안에 두 번 되돌림 · 10/8 이후 재발 없으면 수리안 만들기 다시 시작");
});
t("수리상태 — revert-failed 는 사람이 main 확인", () => {
  assert.equal(수리상태({ paused: true, pause: 실패 }).text, "스스로 멈춤 — 자동 되돌리기가 실패함 · 되돌리기가 실패해 사람이 main 을 확인해야 다시 시작");
});
t("수리상태 — KST 날짜 (UTC 15:30 → 다음 날)", () => {
  const p = { kind: "review-fail-3", at: "2026-10-03T15:30:00Z" };   // +7일 = 10/10 15:30 UTC = 10/11 00:30 KST
  assert.match(수리상태({ paused: true, pause: p }).text, / · 10\/11 이후 /);
});
t("수리상태 — 「켜」「원장님 결정」 미포함", () => {
  for (const x of [{}, { queue: 1 }, { pending: 1, switchOn: false }, { paused: true, pause: 두번 }, { paused: true, pause: 실패 }, { paused: true, pause: null }]) {
    assert.ok(!금지.test(수리상태(x).text), 수리상태(x).text);
  }
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
