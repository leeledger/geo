/**
 * 원장 PC 일꾼이 조용한가 — 순수 판정 (Step 23 D2). company.mjs 가 매시 부른다.
 *
 * 9/24~9/29 닷새 동안 PC 작업이 하나도 안 돌았는데 아무도 몰랐다. PC 가 꺼지면 PC 는 경보를 못 낸다.
 * 그래서 서버(GitHub 매시 점검)가 PC 가 남기는 흔적 셋을 본다. 셋 중 가장 최근 것이 한계를 넘으면 조용한 것이다.
 *   heartbeat  tools/heartbeat.mjs 가 매시 geo.settings 'pc_heartbeat' 를 고친 시각
 *   measure    로그아웃 화면 측정(%-web-logged-out)의 마지막 imported_at
 *   local      local-agent 「로컬 에이전트 출근」 마지막 활동
 *
 *   PC무소식({ heartbeat, measure, local }, now) → null (흔적을 하나도 못 읽음) | { 조용함, 시간, 마지막, 흔적 }
 */

export const PC_한계시간 = 24;

const KST = (t) => new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");

export function PC무소식(흔적, now = Date.now(), 한계시간 = PC_한계시간) {
  const 시각 = Object.fromEntries(Object.entries(흔적 ?? {})
    .map(([k, v]) => [k, v ? Date.parse(v instanceof Date ? v.toISOString() : String(v)) : NaN])
    .filter(([, t]) => Number.isFinite(t)));
  const 값 = Object.values(시각);
  if (!값.length) return null;   // 못 읽었으면 판정하지 않는다 — 조용하다고도, 괜찮다고도 안 한다
  const 마지막 = Math.max(...값);
  const 시간 = Math.floor((now - 마지막) / 3600000);
  return { 조용함: now - 마지막 > 한계시간 * 3600000, 시간, 마지막, 흔적: 시각 };
}

/** 일감 본문 — 무엇이 언제 마지막으로 돌았는지 KST 로 */
export function PC무소식글(판정) {
  const 이름 = { heartbeat: "심장박동", measure: "ChatGPT·Gemini·퍼플렉시티 화면 측정", local: "네이버 이관·구글 색인 요청" };
  const 줄 = Object.entries(이름).map(([k, n]) => `${n}: ${판정.흔적[k] ? `${KST(판정.흔적[k])} KST` : "기록 없음"}`);
  return {
    title: `원장 PC 일꾼이 ${판정.시간}시간째 안 돌았습니다`,
    detail: `PC 가 꺼져 있거나 일꾼(pc-runner)이 안 떠 있습니다. PC 를 켜고 로그인하면 일꾼이 떠서 밀린 일을 따라잡습니다.\n마지막 기록 — ${줄.join(" · ")}`,
  };
}
