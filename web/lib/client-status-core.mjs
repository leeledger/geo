/**
 * 고객 상태 칸 문장(Step 40 D63) — 순수 함수. DB 는 client-status.ts 가 읽는다. 시험 academy/scripts/test-client-status.mjs.
 *
 * 원장이 고객 탭을 열면 맨 위에서 「이번 주 실제로 한 일 / 밀린 일·며칠째」를 사람 말로 읽는다.
 * 숫자는 받은 것만 쓴다. 0 인 것은 안 적고, 측정 말고 다 0 이면 0 이라고 적는다.
 */

/** 'YYYY-MM-DD' 둘 사이 날 수(b − a) */
const 날차 = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const 날더하기 = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** 'YYYY-MM-DD' → 'M/D' */
export const 월일 = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
/** 0일째는 「오늘」 */
const 며칠째 = (n) => (n === 0 ? "오늘" : `${n}일째`);

/** 오늘(KST) 'YYYY-MM-DD' */
export const 오늘KST = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
/**
 * DB 시각 글자(`2026-09-17 13:29:47.96+00` 꼴이나 ISO)가 KST 날짜로 오늘에서 며칠 전인가. 못 읽으면 null.
 * DB 시각은 UTC 로 온다 — KST 날짜로 바꿔 센다(00:49 KST 가 전날로 세이지 않게)
 */
export const 며칠전 = (ts, 오늘) => {
  const t = Date.parse(String(ts ?? "").replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  return Number.isNaN(t) ? null : Math.max(0, 날차(오늘KST(t), 오늘));
};

/** 이번 주 = 어제까지 7일(KST). 오늘 'YYYY-MM-DD' → { from, to } */
export const 이번주 = (오늘) => ({ from: 날더하기(오늘, -7), to: 날더하기(오늘, -1) });

/**
 * raw = {
 *   name,
 *   measure,                       AI 답변 측정 수
 *   posts,                         사이트 글 발행
 *   outside: { blog, jisikin, cafe }  바깥 글 올림
 *   guides,                        고객 사이트에 반영한 가이드 글(question-draft 완료)
 *   gsc, bing, naver,              구글 색인 요청 · 빙 주소 제출 · 네이버 이관
 *   lastTouch,                     손댄 마지막 날 'YYYY-MM-DD' | null (전체 기간, 측정 제외)
 *   backlog: { owner, session, local, repair, failed }  각 { n, oldest: 'YYYY-MM-DD' } | 없음. session 은 q(묶인 질문 수)도
 *   repairOff                      자동 코드 수리 스위치가 꺼져 있나
 * }
 * 돌려주는 것 { 제목, 뱃지: '돎'|'느림'|'멈춤', 한일, 손댄날, 밀린일: string[] }
 */
export function 상태문장(raw, 오늘) {
  const { from, to } = 이번주(오늘);
  const o = raw.outside ?? {};
  const 일 = [
    ["AI 답변 측정", raw.measure, "번"],
    ["사이트 글 발행", raw.posts, "편"],
    ["블로그 글 올림", o.blog, "편"],
    ["지식iN 글 올림", o.jisikin, "편"],
    ["카페 글 올림", o.cafe, "편"],
    ["고객 사이트에 가이드 글 반영", raw.guides, "편"],
    ["구글 색인 요청", raw.gsc, "건"],
    ["빙 주소 제출", raw.bing, "건"],
    ["네이버 블로그로 옮김", raw.naver, "편"],
  ].filter(([, n]) => n > 0).map(([말, n, 단위]) => `${말} ${n}${단위}`);
  const 측정말고 = [raw.posts, o.blog, o.jisikin, o.cafe, raw.guides, raw.gsc, raw.bing, raw.naver].every((n) => !n);
  const 끝말 = "글·색인·사이트 반영은 0건입니다.";
  const 한일 = 측정말고 ? (일.length ? `${일.join(" · ")}. ${끝말}` : 끝말) : 일.join(" · ");

  const 손댄지 = raw.lastTouch ? 날차(raw.lastTouch, 오늘) : null;
  const 손댄날 = raw.lastTouch
    ? `고객 사이트나 바깥에 실제로 손댄 마지막 날 ${월일(raw.lastTouch)} (${손댄지 === 0 ? "오늘" : `${손댄지}일 전`})`
    : "아직 없습니다";

  const b = raw.backlog ?? {};
  const 나이 = (x) => (x?.oldest ? Math.max(0, 날차(x.oldest, 오늘)) : 0);
  const 밀린일 = [];
  if (b.owner?.n) 밀린일.push(`원장님 — ${b.owner.n}건 · 가장 오래된 것 ${며칠째(나이(b.owner))}`);
  if (b.session?.n) 밀린일.push(`Claude 세션 — 가이드 글 ${b.session.n}편(묶인 질문 ${b.session.q ?? b.session.n}개) · ${며칠째(나이(b.session))}`);
  if (b.local?.n) 밀린일.push(`원장 PC — ${b.local.n}건 · ${며칠째(나이(b.local))} (PC 가 켜져 있어야 움직입니다)`);
  if (b.repair?.n) 밀린일.push(`자동 코드 수리 — ${b.repair.n}건 · ${며칠째(나이(b.repair))} (${raw.repairOff ? "수리가 꺼져 있어 안 움직입니다" : "매일 06:50 에 1건씩"})`);
  if (b.failed?.n) 밀린일.push(`자동 작업 실패 — ${b.failed.n}건 · ${며칠째(나이(b.failed))}`);

  // 뱃지 — 손댄 날이 없으면(한 번도 손 안 댐) 멈춤
  const 가장밀린 = Math.max(0, ...["owner", "session", "local", "repair", "failed"].filter((k) => b[k]?.n).map((k) => 나이(b[k])));
  const 늦음 = Math.max(손댄지 ?? Infinity, 가장밀린);
  const 뱃지 = 늦음 >= 14 ? "멈춤" : 늦음 >= 7 ? "느림" : "돎";

  return {
    제목: `${raw.name} · 이번 주 (${월일(from)}~${월일(to)})`,
    뱃지,
    한일,
    손댄날,
    밀린일: 밀린일.length ? 밀린일 : ["밀린 일 없습니다"],
  };
}
