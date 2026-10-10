/**
 * 검색 노출 판정·색인 알림 결과·감사 R5 제외 표 — 순수 함수만(Step 40). DB·네트워크 없음 → test-serp-judge.mjs 로 시험.
 *
 * 왜 「가장 최근 날」 하나가 아니냐면:
 *   측정은 날마다 엔진 일부만 잴 수 있다(10/6·8·9 는 bing 만). 최근 날 하나만 보면 bing 만 잰 날에
 *   브랜드·경쟁이 전부 0 이 되어 일감이 열리고, 네이버를 잰 날 닫힌다 — 깜빡임.
 *   그래서 (검색어, 엔진)마다 최근 7일 안 가장 늦은 1행으로 판정한다.
 */

const 일수 = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/**
 * rows = 최근 7일 serp_checks `{ query, engine, kind, day: 'YYYY-MM-DD', hit }`. 오늘 = KST 'YYYY-MM-DD'.
 * 마지막적중일 = 경쟁 검색어 hit 이 하나라도 있던 마지막 날(전체 기록) · 첫측정일 = 경쟁 측정 첫날. 둘 다 없으면 null.
 * 돌려주는 것 null(7일 안 행 0 — 판정 안 함) 또는
 *   { brandMiss: [{ query, engines }], rival: { won, total, zeroDays } }
 *   zeroDays 는 won 0 일 때만 숫자(아니면 null). 기준일을 모르면 null
 */
export function 검색판정(rows, 오늘, { 마지막적중일 = null, 첫측정일 = null } = {}) {
  if (!rows?.length) return null;
  // (검색어, 엔진)마다 가장 늦은 날. 같은 날 여러 번 쟀으면 한 번이라도 나온 것을 나온 것으로
  const 최신 = new Map();
  for (const r of rows) {
    const k = `${r.kind}\u0000${r.query}\u0000${r.engine}`;
    const o = 최신.get(k);
    if (!o || r.day > o.day) 최신.set(k, { ...r, hit: !!r.hit });
    else if (r.day === o.day && r.hit) o.hit = true;
  }
  const 검색어별 = (kind) => {
    const m = new Map();
    for (const r of 최신.values()) {
      if (r.kind !== kind) continue;
      if (!m.has(r.query)) m.set(r.query, []);
      m.get(r.query).push(r);
    }
    return m;
  };
  const brandMiss = [...검색어별("브랜드")]
    .filter(([, l]) => l.every((r) => !r.hit))
    .map(([query, l]) => ({ query, engines: l.map((r) => r.engine).sort() }));
  const 경쟁 = [...검색어별("경쟁").values()];
  const won = 경쟁.filter((l) => l.some((r) => r.hit)).length;
  const 기준 = 마지막적중일 ?? 첫측정일;
  const zeroDays = won === 0 && 기준 ? 일수(기준, 오늘) : null;
  return { brandMiss, rival: { won, total: 경쟁.length, zeroDays } };
}

/**
 * indexnow.mjs 출력 → "접수" | "키없음" | "실패".
 * 키없음은 실패가 아니다 — 그 고객은 저장소가 배포 때 색인 알림을 보낸다(문서딱). 실패로 세면 3회 뒤 사람 대기로 간다
 */
export function 색인결과(out, ok) {
  const s = String(out ?? "");
  if (/키 설정이 없습니다/.test(s)) return "키없음";
  return ok && /접수됨/.test(s) ? "접수" : "실패";
}

/**
 * 감사 R5(크롤러 커버리지)에서 감시하지 않는 크롤러와 그 이유. 이유가 풀림 사유로 감사 출력에 매일 남는다(D59).
 * audit.mjs 는 import 하면 본체가 돌아 시험이 못 부른다 — 그래서 여기 둔다
 */
export const R5제외 = {
  duckduckgo: "덕덕고 결과는 빙 색인 기반 — 빙 커버리지로 대신 봄",
  bytedance: "바이트댄스(중국 Doubao)는 한국 학부모가 안 씀 — 감시 안 함",
};
