/**
 * 파일럿 보고서의 셈 — DB 없이 가짜 행으로 시험할 수 있는 순수 함수 (Step 26 D6·D7·D18).
 * 약속의 기준은 research/pilot-measurement-sop.md 와 research/paid-pilot-order-form.md 다.
 *
 *   곳       collection_method 하나가 곳 하나다. 방법이 다르면 합치지 않는다
 *   적중     질문×곳마다 「n번 중 k번」. 언급 = 답에 이름, 인용 = 출처에 도메인
 *   브랜드   브랜드 3문항은 방어 지표 — 따로 적고 판정에 안 쓴다
 *   경쟁사   이미 보관한 답 원문에서 센다. 새로 묻지 않는다. 가중치·점수는 만들지 않는다
 */

/** SOP 「곳과 방법」의 네 곳. 이 밖의 방법은 적되 판정에 안 쓴다 */
export const 곳정보 = {
  "chatgpt-web-logged-out": { 이름: "ChatGPT", 방법: "로그아웃 소비자 화면 · 문항마다 새 브라우저 문맥(쿠키·로그인 없음) · 한국어(ko-KR) · 시간대 Asia/Seoul" },
  "perplexity-web-logged-out": { 이름: "Perplexity", 방법: "로그아웃 소비자 화면 · 문항마다 새 브라우저 문맥(쿠키·로그인 없음) · 한국어(ko-KR) · 시간대 Asia/Seoul" },
  "gemini-web-logged-out": { 이름: "Gemini", 방법: "로그아웃 소비자 화면 · 문항마다 새 브라우저 문맥(쿠키·로그인 없음) · 한국어(ko-KR) · 시간대 Asia/Seoul" },
  "claude-code-headless-websearch": { 이름: "Claude", 방법: "Claude Code(Max) 경유 — claude.ai 화면과 다를 수 있음 · 웹 검색 · 한국어 질문" },
};
const 곳순서 = Object.keys(곳정보);
export const 약속한곳 = (method) => method in 곳정보;
export const 곳이름 = (method) => 곳정보[method]?.이름 ?? method;

/** 기준선·최종 창에서 이만큼 날을 못 재면 그 곳은 비교하지 않는다(표본 부족 → 판정 보류). 7일 중 과반 */
export const 최소잰날 = 4;

export const 브랜드문항 = (stage) => stage === "brand" || stage === "브랜드";

export const 날짜들 = (from, to) => {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};

/** 곳 목록 — SOP 네 곳 순서, 그 밖은 뒤에 이름순 */
export function 곳들(rows) {
  // 약속한 네 곳은 못 잰 날에도 늘 싣는다 — 빠진 곳이 표에서 조용히 사라지면 좋은 곳만 고른 보고가 된다(Richard 26)
  const s = new Set(rows.map((r) => r.collection_method));
  return [...곳순서, ...[...s].filter((m) => !곳순서.includes(m)).sort()];
}

export const 창 = (rows, w) => rows.filter((r) => r.d >= w.from && r.d <= w.to);

export function 셈(rows) {
  return { n: rows.length, m: rows.filter((r) => r.mentioned).length, c: rows.filter((r) => r.cited).length };
}

export const 몇번 = (n, k) => `${n}번 중 ${k}번`;
const 퍼센트 = (k, n) => (n ? `${Math.round((k / n) * 100)}%` : "—");
export const 비율글 = (s) => (s.n ? `언급 ${몇번(s.n, s.m)}(${퍼센트(s.m, s.n)}) · 인용 ${s.c}번(${퍼센트(s.c, s.n)})` : "안 잼 — 표본 0");

/** 그 곳을 잰 날과 빠진 날 */
export function 잰날(rows, w) {
  const 잰 = new Set(rows.map((r) => r.d));
  const 전부 = 날짜들(w.from, w.to);
  return { 잰: 전부.filter((d) => 잰.has(d)), 빠진: 전부.filter((d) => !잰.has(d)), 전부 };
}

/** 이름 하나를 글자 그대로 찾는 정규식 — web/lib/answer-pattern.ts 와 같은 규칙(빈칸은 있어도 없어도, & 는 &amp; 도) */
export function 이름정규식(name) {
  const src = String(name).trim().split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/&/g, "(?:&|&amp;)")).join("\\s*");
  return new RegExp(src, "i");
}

export const 경쟁사목록 = (text) => [...new Set(String(text ?? "").split(/[,，]/).map((s) => s.trim()).filter((s) => s.length >= 2))].slice(0, 5);

/**
 * 한 답에서 이름들이 처음 나온 순서. 이름마다 순위(1부터) 또는 null(안 나옴).
 * 이름들: [{ key, re }]. 같은 자리에서 걸리면 목록 순서(우리 먼저)
 */
export function 처음순서(answer, 이름들) {
  const 자리 = 이름들.map((x, i) => {
    const m = x.re.exec(String(answer ?? ""));
    return { key: x.key, at: m ? m.index : -1, i };
  }).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at || a.i - b.i);
  const out = Object.fromEntries(이름들.map((x) => [x.key, null]));
  자리.forEach((x, r) => { out[x.key] = r + 1; });
  return out;
}

/**
 * 원문이 있는 답들에서 이름마다 「n번 중 k번」과 처음 나온 순서 분포.
 * 돌려주는 것: { n, 원문없음, 이름별: { key: { k, 순위: {1: x, 2: y, ...} } } }
 */
export function 점유(rows, 이름들) {
  const 있는 = rows.filter((r) => typeof r.answer === "string" && r.answer.length > 0);
  const 이름별 = Object.fromEntries(이름들.map((x) => [x.key, { k: 0, 순위: {} }]));
  for (const r of 있는) {
    const o = 처음순서(r.answer, 이름들);
    for (const [key, rank] of Object.entries(o)) {
      if (rank == null) continue;
      이름별[key].k++;
      이름별[key].순위[rank] = (이름별[key].순위[rank] ?? 0) + 1;
    }
  }
  return { n: 있는.length, 원문없음: rows.length - 있는.length, 이름별 };
}

const 서수 = ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째"];
export const 순위글 = (순위) => Object.keys(순위).map(Number).sort((a, b) => a - b).map((r) => `${서수[r - 1] ?? `${r}번째`} ${순위[r]}번`).join(", ");
export const 점유칸 = (n, x) => (n ? `${몇번(n, x.k)}${x.k ? ` (${순위글(x.순위)})` : ""}` : "원문 없음");

/**
 * 곳 하나의 기준선 vs 마지막 7일 — 같은 곳·같은 방법끼리만. 성과 17문항만(브랜드 제외).
 * 판정 비율은 언급(답에 이름이 나온 비율) 하나다. 인용은 옆에 나란히 적는 참고다(Arch 2026-09-30, SOP 「성공 판정」).
 * 돌려주는 것: { 곳, 약속, 기준, 끝, 기준날, 끝날, 비교됨, 변화: "늘었다"|"그대로"|"줄었다"|null }
 */
export function 곳비교(rows, method, 기준선, 최종) {
  const mine = rows.filter((r) => r.collection_method === method && !브랜드문항(r.stage));
  const a = 창(mine, 기준선), b = 창(mine, 최종);
  const 기준날 = 잰날(a, 기준선), 끝날 = 잰날(b, 최종);
  const 기준 = 셈(a), 끝 = 셈(b);
  const 비교됨 = 기준날.잰.length >= 최소잰날 && 끝날.잰.length >= 최소잰날;
  let 변화 = null;
  if (비교됨) {
    // 곱셈으로 비교한다(나눗셈 반올림 없이) — 끝.m/끝.n 과 기준.m/기준.n
    const d = 끝.m * 기준.n - 기준.m * 끝.n;
    변화 = d > 0 ? "늘었다" : d < 0 ? "줄었다" : "그대로";
  }
  return { 곳: method, 약속: 약속한곳(method), 기준, 끝, 기준날, 끝날, 비교됨, 변화 };
}

/**
 * 약속한 네 곳을 한 문장에 모두 이름으로 — 좋은 곳만 고른 보고가 되지 않게(Richard 26 막는 항목).
 * 「4곳 중 비교된 m곳, 그중 k곳에서 늘었다 — 늘어난 곳: … · 그대로·줄어든 곳: … · 못 잰 곳: …」
 */
export function 곳문장(비교들) {
  const 약속 = 비교들.filter((x) => x.약속);
  const 비교 = 약속.filter((x) => x.비교됨);
  const 늘 = 비교.filter((x) => x.변화 === "늘었다");
  const 아님 = 비교.filter((x) => x.변화 !== "늘었다");
  const 못 = 약속.filter((x) => !x.비교됨);
  const 이름 = (xs, f = (x) => 곳이름(x.곳)) => (xs.length ? xs.map(f).join(", ") : "없음");
  return `약속한 ${약속.length}곳 중 비교된 ${비교.length}곳, 그중 ${늘.length}곳에서 언급 비율이 늘었다 — `
    + `늘어난 곳: ${이름(늘)} · 그대로·줄어든 곳: ${이름(아님, (x) => `${곳이름(x.곳)}(${x.변화})`)} · `
    + `못 잰 곳: ${이름(못, (x) => `${곳이름(x.곳)}(잰 날 ${x.기준날.잰.length}일·${x.끝날.잰.length}일)`)}`;
}

/**
 * SOP 「성공 판정」 그대로.
 *   성공  약속한 곳 가운데 같은 곳·같은 방법의 7일 언급 비율이 기준선보다 늘었다 — 또는 상담 기록에 AI·검색 유입 문의가 1건 이상
 *   보류  성공이 아니고, 같은 조건의 비교가 없거나(표본 부족 포함) 상담 기록이 비었다 — 또는 30일이 아직 안 끝났다
 *   실패  비교도 있고 상담 기록도 있는데 둘 다 성공 조건이 아니다 → 실패 원인을 적고 갱신을 권하지 않는다
 * 곳 문장(늘어난 곳·그대로·줄어든 곳·못 잰 곳)은 결과와 상관없이 늘 붙는다
 */
export function 판정({ 비교들, 문의, 끝났나 }) {
  const 곳 = 곳문장(비교들);
  const 약속비교 = 비교들.filter((x) => x.약속 && x.비교됨);
  const 늘은곳 = 약속비교.filter((x) => x.변화 === "늘었다");
  const 유입 = Number(문의.search ?? 0);
  if (!끝났나) return { 결과: "판정 보류", 이유: "30일 마지막 7일이 아직 안 끝났다", 곳 };
  if (늘은곳.length || 유입 > 0) {
    const 근거 = [];
    if (늘은곳.length) 근거.push(`${늘은곳.map((x) => 곳이름(x.곳)).join(", ")} 언급 비율이 기준선보다 늘었다`);
    if (유입 > 0) 근거.push(`상담 기록에 AI·검색 유입 문의 ${유입}건`);
    return { 결과: "성공", 이유: 근거.join(" · "), 곳 };
  }
  const 빈것 = [];
  if (!약속비교.length) 빈것.push(`같은 곳·같은 방법으로 두 창을 다 잰 곳이 없다(창마다 ${최소잰날}일 이상)`);
  if (!Number(문의.total ?? 0)) 빈것.push("상담 기록이 비었다");
  if (빈것.length) return { 결과: "판정 보류", 이유: 빈것.join(" · "), 곳 };
  return { 결과: "실패", 이유: "같은 조건의 언급 비율이 늘지 않았고 AI·검색 유입 문의도 없다", 곳 };
}
