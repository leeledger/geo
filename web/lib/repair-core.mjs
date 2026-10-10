/**
 * 자동 코드 수리(Step 42) — repair.mjs·현황판(agents.ts·client-status.ts)·아침 보고(pm-report.mjs)가 같이 쓰는 판정.
 * 의존성 0. repair.yml 은 academy 에 pg 만 깐다 — 이 파일은 아무것도 import 하지 않는다. DB 는 q 만 받는다.
 *
 * 멈춤은 geo.settings 두 키다. repair_paused='true' 가 멈춤이고(옛 키 — 사람이 'false' 로 푸는 길 그대로),
 * repair_pause 는 왜 멈췄는지 JSON 이다. 'true' 인데 JSON 이 없으면 이유를 모르는 옛 멈춤(legacy) — 사람만 푼다.
 *
 * 화면 문구에 「켜기」「켤지」「원장님 결정」을 쓰지 않는다(D79). 수리안 만들기는 스위치와 무관하게 돈다(D72).
 */

const 하루 = 86400000;

/** 무거운 멈춤을 가벼운 것이 못 덮는다(D74). revert-failed = 깨진 코드가 main 에 남았을 수 있다 */
export const 멈춤무게 = { "revert-failed": 3, legacy: 3, "revert-twice": 2, "review-fail-3": 1 };
const 무게 = (p) => 멈춤무게[p?.kind] ?? 3;   // 모르는 종류는 무겁게 — 스스로 풀리면 안 된다

/** 지금 멈춤 위에 새 멈춤이 오면 무엇을 남기나. 같은 무게면 새것(마지막 되돌림 시각이 뒤로 간다) */
export function 멈춤합치기(지금, 새것) {
  if (!지금) return 새것;
  return 무게(새것) >= 무게(지금) ? 새것 : 지금;
}

/** geo.settings 두 값 → 멈춤 객체 | null. 'true' 가 아니면 멈춤 아님(repair_pause 는 무시) */
export function 멈춤읽기(pausedValue, pauseJson) {
  if (pausedValue !== "true") return null;
  try {
    const p = JSON.parse(String(pauseJson ?? ""));
    if (p && typeof p === "object" && typeof p.kind === "string") return p;
  } catch { /* 이유 없는 옛 멈춤 */ }
  return { kind: "legacy", reason: "이유가 안 남은 옛 멈춤" };
}

const 시각 = (v) => { const t = Date.parse(String(v ?? "")); return Number.isFinite(t) ? t : null; };

/** 스스로 다시 시작해도 되는 가장 이른 시각(ms) | null(사람만) */
export function 재개시각(pause) {
  if (!pause) return null;
  if (pause.kind === "revert-twice") { const t = 시각(pause.last_revert_at) ?? 시각(pause.at); return t === null ? null : t + 7 * 하루; }
  if (pause.kind === "review-fail-3") { const t = 시각(pause.at); return t === null ? null : t + 7 * 하루; }
  return null;
}

/** 날짜는 KST 로(CLAUDE.md 함정 — 러너는 UTC) */
export function KST월일(t) {
  return new Date(t).toLocaleDateString("en-US", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });
}

/**
 * 멈춤을 스스로 풀어도 되나.
 *   revertsSince — 마지막 되돌림 뒤 되돌림·되돌림 실패 수, recurring — 합친 수리 중 신호가 재발한 수
 */
export function 재개판정(pause, { revertsSince = 0, recurring = 0 } = {}, now = Date.now()) {
  if (!pause) return { ok: false, why: "멈춰 있지 않음" };
  const t = 재개시각(pause);
  if (t === null) {
    return { ok: false, why: pause.kind === "legacy" ? "이유가 안 남은 옛 멈춤 — 사람이 풀 때까지" : "되돌리기 실패 — 사람이 main 확인" };
  }
  if (now < t) return { ok: false, why: `${KST월일(t)} 이후에 다시 본다` };
  if (pause.kind === "revert-twice") {
    if (revertsSince > 0) return { ok: false, why: `마지막 되돌림 뒤 또 되돌림 ${revertsSince}번` };
    if (recurring > 0) return { ok: false, why: `합친 수리 중 신호 재발 ${recurring}건` };
    return { ok: true, why: "마지막 되돌림 뒤 7일 동안 되돌림·재발 없음" };
  }
  return { ok: true, why: "검토 연속 불합격 멈춤 뒤 7일 지남" };
}

/** rows = 마지막 재개 뒤 검토받은 수리 최근 3행(최신 먼저). 3행 전부 검토 불합격이면 멈춘다(D75) */
export function 연속불합격(rows) {
  return Array.isArray(rows) && rows.length === 3 && rows.every((r) => r?.status === "검토 불합격");
}

/** 승인 대기 7일(168시간) 넘으면 만료(D78) */
export function 만료인가(row, now = Date.now()) {
  const t = 시각(row?.created_at instanceof Date ? row.created_at.toISOString() : row?.created_at);
  return row?.status === "승인 대기" && t !== null && now - t > 168 * 3600000;
}

/**
 * 측정·판정 숫자에 닿는 스크립트 — 고치면 카드에 「숫자에 닿음」. 손 목록이다(KG-42-3).
 * 근거(2026-10-10 grep, insert/update 대상 표): ai-measure → ai_measurements·ai_probe_measurements · check-index → serp_checks ·
 * import-ai-measurements → ai_measurements · growth-import → growth_reports · rescan → scans·site_pages ·
 * daily-agent → ai_probe_questions(무엇을 잴지) · loop-grow → ai_probe_questions·pilot_questions.
 * 나머지(bing-check·openai-gap·who-wins·query-audit·scout·loop-review·api-cost)는 표에 안 쓰지만 사람이 읽는 숫자를 계산한다
 */
export const 숫자경로 = ["ai-measure", "check-index", "bing-check", "import-ai-measurements", "openai-gap", "who-wins", "query-audit",
  "rescan", "growth-import", "scout", "loop-review", "api-cost", "daily-agent", "loop-grow"];
export function 숫자닿음(files) {
  return (files ?? []).some((f) => {
    const m = /^academy\/scripts\/([^/]+)\.mjs$/.exec(String(f).replace(/\\/g, "/").replace(/^\.?\//, ""));
    return !!m && 숫자경로.includes(m[1]);
  });
}

/**
 * 무인 합치기(견습 5건 뒤 스스로 합치기)는 REPAIR_ENABLED=1 과 REPAIR_UNATTENDED=1 이 둘 다일 때만(D80 — 원장 「합치기는 늘 승인」).
 * REPAIR_ENABLED=1 만으로는 승인된 합치기만 된다. 견습끝 = repair.mjs 무인허용().ok
 */
export function 무인합치기(env, 견습끝, needs_owner) {
  return env?.REPAIR_ENABLED === "1" && env?.REPAIR_UNATTENDED === "1" && 견습끝 === true && !needs_owner;
}

const 멈춤말 = {
  "revert-failed": "자동 되돌리기가 실패함",
  "revert-twice": "7일 안에 두 번 되돌림",
  "review-fail-3": "검토에서 연속 3번 떨어짐",
  legacy: "이유가 안 남은 옛 멈춤",
};

/**
 * 현황판·아침 보고 한 줄. 우선순위 paused > waiting > making > none
 *   paused·pause  멈춤읽기 결과, pending  승인 대기 수, queue  수리 대기 코드 일감 수, switchOn  비상 스위치(null = 모름)
 */
export function 수리상태({ paused = false, pause = null, pending = 0, queue = 0, switchOn = null } = {}) {
  if (paused) {
    const p = pause ?? { kind: "legacy" };
    const t = 재개시각(p);
    const 다음 = t !== null ? `${KST월일(t)} 이후 재발 없으면 수리안 만들기 다시 시작`
      : p.kind === "legacy" ? "사람이 풀어야 다시 시작"
      : "되돌리기가 실패해 사람이 main 을 확인해야 다시 시작";
    return { kind: "paused", text: `스스로 멈춤 — ${멈춤말[p.kind] ?? 멈춤말.legacy} · ${다음}` };
  }
  if (pending > 0) {
    const text = `승인 기다림 ${pending}건${queue > 0 ? ` · 수리안 만들 것 ${queue}건` : ""}${switchOn === false ? " · 비상 스위치가 꺼져 있어 합치기가 막혀 있음" : ""}`;
    return { kind: "waiting", text };
  }
  if (queue > 0) return { kind: "making", text: `수리안 만드는 중 — ${queue}건 대기, 매일 06:50 1건` };
  return { kind: "none", text: "고칠 것 없음" };
}

/** 수리상태 입력을 DB 에서. 세 화면(현황판·고객 상태·아침 보고)이 같은 셈을 쓴다 */
export async function 수리입력(q) {
  const s = Object.fromEntries((await q(`select key, value from geo.settings where key in ('repair_paused','repair_pause','repair_switch')`, []))
    .map((r) => [r.key, r.value]));
  const [{ n: pending }] = await q(`select count(*)::int n from geo.repairs where status = '승인 대기'`, []);
  const [{ n: queue }] = await q(`select count(*)::int n from geo.agent_tasks
    where kind = 'investigate' and status = '수리 대기' and payload->'diagnosis'->>'분류' = 'code'`, []);
  const pause = 멈춤읽기(s.repair_paused, s.repair_pause);
  return { paused: !!pause, pause, pending, queue, switchOn: s.repair_switch === "1" ? true : s.repair_switch === "0" ? false : null };
}
