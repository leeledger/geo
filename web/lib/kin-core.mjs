/**
 * 지식iN 실제 질문(Step 41) — kin-find(원장 PC 가 kin.naver.com 을 읽음)·marketing-draft(그 질문에 답 초안)·
 * kin-open(질문 페이지에 답을 채워 띄움)·현황판 버튼이 같이 쓰는 순수 함수. q 만 받는다.
 *
 * 등록은 원장이 누른다. 이 파일과 kin-open 에 그 버튼을 찾는 코드는 없다(약관 — 원장 결정 2026-10-10).
 *
 * 화면 읽기 기준은 2026-10-10 kin.naver.com 원문(academy/scripts/fixtures/kin/ — kin-find --look 이 찍은 것)이다.
 * 네이버가 화면을 바꾸면 여기 정규식이 0건을 내고, kin-find 는 「못 읽음」으로 실패를 남긴다(조용히 0 아님).
 */

const 엔티티 = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
const 풀기 = (s) => String(s).replace(/&(#x?[0-9a-f]+|[a-z]+|#39);/gi, (m, k) => {
  if (엔티티[k]) return 엔티티[k];
  if (/^#x/i.test(k)) return String.fromCodePoint(parseInt(k.slice(2), 16));
  if (/^#\d/.test(k)) return String.fromCodePoint(Number(k.slice(1)));
  return m;
});
/** 태그를 벗기고 줄을 남긴다. 화면에만 숨긴 글(blind)은 버린다 */
const 글자 = (html) => 풀기(String(html)
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")
  .replace(/<span class="blind">[\s\S]*?<\/span>/g, "")
  .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, "\n")
  .replace(/<[^>]+>/g, ""))
  .split("\n").map((s) => s.replace(/[\s​]+/g, " ").trim()).filter(Boolean).join("\n");

/** 질문 주소를 한 꼴로 — dirId·docId 만 남긴다(answerNo·qb 는 검색 흔적). 지식iN 질문이 아니면 null */
export function 질문주소(raw) {
  try {
    const u = new URL(풀기(String(raw ?? "")), "https://kin.naver.com");
    if (u.hostname !== "kin.naver.com" || u.pathname !== "/qna/detail.naver") return null;
    const dir = u.searchParams.get("dirId"), doc = u.searchParams.get("docId");
    if (!/^\d{1,12}$/.test(doc ?? "")) return null;
    return `https://kin.naver.com/qna/detail.naver?${/^\d{1,12}$/.test(dir ?? "") ? `dirId=${dir}&` : ""}docId=${doc}`;
  } catch { return null; }
}

/** 검색 목록 주소 — Q&A 만, 최신순 */
export const 목록주소 = (query) => `https://kin.naver.com/search/list.naver?query=${encodeURIComponent(query)}&section=qna&sort=date`;

/**
 * 검색 목록 한 쪽 → [{ url, title, snippet, day, answers }]. day 는 목록에 찍힌 날(마지막 답 날일 수 있다 — 질문 날은 질문 페이지에서).
 * 결과가 없다는 문구가 있으면 { 없음: true }
 */
export function 목록읽기(html) {
  const h = String(html ?? "");
  const 없음 = /검색결과가 없습니다/.test(h);
  const 줄 = [];
  const ul = h.indexOf('<ul class="basic1"');
  if (ul >= 0) {
    const 끝 = h.indexOf("</ul>", ul);
    for (const li of h.slice(ul, 끝 < 0 ? undefined : 끝).split(/<li\b/).slice(1)) {
      const a = /<a href="([^"]+)"[^>]*class="[^"]*_searchListTitleAnchor[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(li);
      const url = a && 질문주소(a[1]);
      if (!url) continue;
      const day = /<dd class="txt_inline">\s*(\d{4})\.(\d{2})\.(\d{2})\.?\s*<\/dd>/.exec(li);
      const n = /답변수\s*(\d+)/.exec(li);
      // 날 다음 첫 <dd> — 답이 없으면 질문 본문 앞부분, 있으면 답 앞부분이다
      const 토막 = /<dd class="txt_inline">[\s\S]*?<\/dd>\s*<dd>([\s\S]*?)<\/dd>/.exec(li);
      줄.push({ url, title: 글자(a[2]), snippet: 토막 ? 글자(토막[1]) : "", day: day ? `${day[1]}-${day[2]}-${day[3]}` : null, answers: n ? Number(n[1]) : null });
    }
  }
  return { 없음: 없음 && !줄.length, 줄 };
}

/** 분야 새 질문 목록 주소(Step 41 KG-41-3) — 최신 질문 순, 한 쪽 20개 */
export const 분야주소 = (dirId, page = 1) => `https://kin.naver.com/qna/list.naver?dirId=${Number(dirId)}${page > 1 ? `&page=${Number(page)}` : ""}`;

/**
 * 분야 새 질문 목록 한 쪽 → [{ url, title, answers, when }]. when 은 작성 글자(「52분 전」「2026.10.09.」) — 날짜풀기로 푼다.
 * 칸 순서: 제목 · 분야 · UP · 답변 · 작성(2026-10-10 원문 fixtures/kin/dir-102.html)
 */
export function 분야읽기(html) {
  const h = String(html ?? "");
  const 줄 = [];
  for (const tr of h.split(/<tr\b/).slice(1)) {
    const a = /<td class="title">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(tr);
    const url = a && 질문주소(a[1]);
    if (!url) continue;
    const 수 = [...tr.matchAll(/<td class="t_num">([\s\S]*?)<\/td>/g)].map((m) => 글자(m[1]).replace(/^UP\s*/, "").trim());
    줄.push({ url, title: 글자(a[2]).replace(/\n/g, " "), answers: /^\d+$/.test(수[1] ?? "") ? Number(수[1]) : null, when: 수[2] ?? null });
  }
  return 줄;
}

/**
 * 질문 페이지 →{ title, body, askedText, answers, adopted } | null(질문 칸을 못 찾음 = 화면이 바뀜)
 * 채택은 「질문자가 채택한 답변입니다」 문구로만 본다
 */
export function 질문읽기(html) {
  const h = String(html ?? "");
  const t = /<div class="endTitleSection">([\s\S]*?)<\/div>/.exec(h);
  if (!t) return null;
  const title = 글자(t[1]).replace(/\n/g, " ");
  const asked = /<span class="blind">작성일<\/span>\s*([^<]+?)\s*<\/span>/.exec(h);
  const bi = h.indexOf('<div class="questionDetail">');
  let body = "";
  if (bi >= 0) {
    const 끝후보 = ['<div class="tagList">', '<div class="contentButtonArea">'].map((s) => h.indexOf(s, bi)).filter((i) => i > 0);
    body = 글자(h.slice(bi, 끝후보.length ? Math.min(...끝후보) : bi + 20000));
  }
  const n = /<span class="_answerCount">\s*(\d+)\s*<\/span>/.exec(h);
  return {
    title, body, askedText: asked ? asked[1].trim() : null,
    answers: n ? Number(n[1]) : 0,
    adopted: /질문자가 채택한 답변입니다/.test(h),
  };
}

const 하루 = 86400000;
const 날더하기 = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 하루).toISOString().slice(0, 10);
/** KST 「YYYY-MM-DD」 */
export const kst날 = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/** 「2026.09.16」「2026.10.10.」「3시간 전」「어제」 → 'YYYY-MM-DD' | null. 몇 분·몇 시간 전은 지금 시각에서 뺀다 */
export function 날짜풀기(text, now = new Date()) {
  const s = String(text ?? "").trim();
  let m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})\.?$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if (/^방금/.test(s)) return kst날(now);
  m = /^(\d+)\s*(분|시간|일)\s*전$/.exec(s);
  if (m) return kst날(new Date(now.getTime() - Number(m[1]) * (m[2] === "분" ? 60000 : m[2] === "시간" ? 3600000 : 하루)));
  if (s === "어제") return 날더하기(kst날(now), -1);
  return null;
}

/** 캡차·차단 화면인가 — 화면 글자(innerText)와 주소로. 우회하지 않는다 */
export const 막힘 = (text, url = "") =>
  /captcha|nidlogin/i.test(String(url)) || /자동입력 방지|자동 입력 방지|보안문자|비정상적인 접근|일시적으로 제한/.test(String(text ?? ""));

/**
 * 도구 낱말(KG-41-5) — 페이지 줄(/여권/ ·/정부24/)만 맞으면 발급 절차 질문까지 걸린다. 도구로 풀 일(사진·규격·용량·파일 꼴)이
 * 같이 있어야 맞는 질문이다. 「여권 발급 서류」는 안 맞고 「여권 사진 규격」은 맞는다
 */
export const 도구말 = /사진|규격|사이즈|용량|kb|픽셀|px|hwpx?|한글파일|pdf|합치|병합|변환|압축/i;
/** 고객 페이지 줄에 맞고 도구 낱말도 있나 → 페이지 줄 | null */
export const 도구맞음 = (글, 맞는페이지) => (도구말.test(글) ? 맞는페이지(글) : null);

/** 현황판 숫자 줄 — 공급이 얇으면 원장이 숫자로 보게(KG-41-6). 돈 실행이 있을 때만 쓴다 */
export const 공급말 = (s) => `찾기 ${s.찾기}번 · 최근 7일 분야 목록에서 읽은 질문 ${s.읽음}개 · 맞는 질문 ${s.맞음}개 · 이미 채택돼 놓침 ${s.놓침}개`;

/**
 * 현황판 지식iN 공급 한 줄(Richard Must Fix b) — 못 잰 것을 0 으로 띄우지 않는다.
 *   runs7  [{ status, read, matched, note }]  최근 7일 kin_runs, 최신 먼저
 *   놓침   최근 7일 「채택된 답 있음」 질문 수
 *   마지막  최근 7일 밖이라도 마지막 찾기 KST 'YYYY-MM-DD' | null
 * 실행이 한 번도 없던 고객이면 null(줄 없음)
 */
export function 공급상태(runs7, 놓침, 마지막) {
  if (!runs7.length) return 마지막 ? `지식iN 최근 7일 안 돌았습니다(마지막 찾기 ${마지막})` : null;
  if (runs7[0].status === "막힘") return "지식iN 캡차로 멈춤 — 원장님이 한 번 로그인 창에서 풀어 주세요";
  const 돈 = runs7.filter((r) => r.status === "돎");
  if (!돈.length) return `지식iN 최근 7일 찾기 ${runs7.length}번 다 못 돎 — 마지막: ${runs7[0].note || runs7[0].status}`;
  return `지식iN ${공급말({ 찾기: 돈.length, 읽음: 돈.reduce((a, r) => a + Number(r.read), 0), 맞음: 돈.reduce((a, r) => a + Number(r.matched), 0), 놓침 })}`;
}

/**
 * 후보로 둘 질문인가 → null(된다) | 안 되는 까닭.
 *   x       질문읽기 결과 + asked('YYYY-MM-DD'|null)
 *   오늘    KST 'YYYY-MM-DD'
 *   맞는페이지 (글) → 고객 페이지 줄 | null   (marketing.pages — 제목·본문이 고객 도구로 풀리는 것). 도구 낱말도 있어야 한다
 * 7일 안 = 오늘 포함 7일(오늘−6 이후)
 */
export function 후보거름(x, 오늘, 맞는페이지) {
  if (!x) return "질문을 못 읽음";
  if (!x.asked) return "질문 날짜 모름";
  if (x.asked < 날더하기(오늘, -6)) return "7일 지남";
  if (x.adopted) return "채택된 답 있음";
  if (x.answers >= 3) return `답 ${x.answers}개`;
  if (!도구맞음(`${x.title}\n${x.body}`, 맞는페이지)) return "도구와 안 맞음";
  return null;
}

/**
 * 오늘 답 쓸 질문 — 하루 1건. 오늘 질문이 붙은 지식iN 글(초안이든 버림이든 — 호출을 썼다)이 있으면 안 쓴다.
 *   오늘글  [{ kin_question_id }]   오늘 만든 jisikin 행
 *   후보들  [{ id, asked_at('YYYY-MM-DD'), status }]
 * → { id } | { why }
 */
export function 답차례(오늘글, 후보들, 오늘) {
  if (오늘글.some((r) => r.kin_question_id != null)) return { why: "오늘 이미 실제 질문에 답 1건을 썼습니다" };
  const 남은 = 후보들.filter((x) => x.status === "후보" && x.asked_at >= 날더하기(오늘, -6))
    .sort((a, b) => b.asked_at.localeCompare(a.asked_at) || Number(a.id) - Number(b.id));
  return 남은.length ? { id: Number(남은[0].id) } : { why: "7일 안 후보 질문이 없습니다" };
}

/** 답 입력칸·클립보드에 넣을 글 — 마크다운 굵게·소제목 표시를 뗀다(지식iN 에디터는 마크다운을 모른다) */
export const 붙일글 = (md) => String(md ?? "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/\r/g, "").trim();

// ─────────────────────────────────────────── 현황판 「이 질문에 답하기」 → open-kin(로컬 대기) → login-poll → kin-open
/** login-poll 이 받아도 되는 payload 인가 → { post } | null */
export function kin요청검사(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const post = Number(p.post);
  return Number.isInteger(post) && post > 0 ? { post } : null;
}

const kst분 = (d = new Date()) => d.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);

/**
 * 버튼 한 번 — 질문이 붙은 지식iN 초안만. 이미 로컬 대기·실행 중이면 그대로(두 번 눌러도 창 하나).
 * 실행 중이 15분 넘게 그대로면(login-poll 이 죽었으면) 다시 받는다 — 창 상한이 12분이다
 * → { ok: true, 이미, id } | { ok: false, err }
 */
export async function kin창요청(q, postId, now = new Date()) {
  const [m] = await q(`select m.id, m.client_id, m.title from geo.marketing_posts m join geo.kin_questions k on k.id = m.kin_question_id
     where m.id = $1 and m.channel = 'jisikin' and m.status = '초안'`, [postId]);
  if (!m) return { ok: false, err: "not-kin" };
  const rows = await q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
       values ($1, 'deliver', 'open-kin', $2, $3, '원장 PC 가 지식iN 질문 페이지를 열고 답을 채웁니다(현황판 버튼). 등록은 원장님이 누릅니다.', '로컬 대기', 5, $4::jsonb)
       on conflict (client_id, dedupe_key) do update set status = '로컬 대기', payload = excluded.payload, last_error = '', done_at = null, updated_at = now()
        where geo.agent_tasks.status not in ('로컬 대기', '실행 중')
           or (geo.agent_tasks.status = '실행 중' and geo.agent_tasks.updated_at < now() - interval '15 minutes')
       returning id`,
    [m.client_id, `open-kin-${Number(m.id)}`, `지식iN 답 창: ${m.title}`.slice(0, 300), JSON.stringify({ sticky: true, post: Number(m.id), at: kst분(now) })]);
  if (!rows.length) {
    const [x] = await q(`select id from geo.agent_tasks where client_id = $1 and dedupe_key = $2`, [m.client_id, `open-kin-${Number(m.id)}`]);
    return { ok: true, 이미: true, id: x?.id ?? null };
  }
  return { ok: true, 이미: false, id: rows[0].id };
}

/** 회사 루프(매시) — PC 가 안 집어 간 답 창 요청을 실패로. 규칙은 로그인 창과 같다(30분 로컬 대기 · 20분 실행 중) */
export async function 오래된kin요청닫기(q) {
  return q(`update geo.agent_tasks set status = '실패', updated_at = now(),
         last_error = case when status = '로컬 대기' then 'PC 가 안 켜져 있었습니다' else '창 열기가 끝을 못 알렸습니다' end
       where kind = 'open-kin' and ((status = '로컬 대기' and updated_at < now() - interval '30 minutes')
                                 or (status = '실행 중' and updated_at < now() - interval '20 minutes'))
       returning id, client_id, payload, last_error`);
}

/** 카드에 띄울 답 창 상태 한 줄 — open-kin 일감의 상태·last_error·evidence(마지막 줄, 앞 「YYYY-MM-DD HH:MM 」 뗌) */
export function 창상태말(status, lastError, evidence) {
  const 끝줄 = String(evidence ?? "").split("\n").filter(Boolean).pop()?.replace(/^\d{4}-\d\d-\d\d \d\d:\d\d /, "") ?? "";
  if (status === "로컬 대기") return lastError ? `PC 에 요청함 — ${lastError}` : "PC 에 요청함 — 1~2분 안에 창이 뜹니다(PC 가 켜져 있어야 합니다)";
  if (status === "실행 중") return "PC 에 질문 페이지가 떠 있습니다 — 답을 읽고 원장님이 올려 주세요";
  if (status === "완료") return 끝줄 || "창을 띄웠습니다";
  return lastError || 끝줄 || status;
}

/** kin-open 출력 → 카드에 띄울 한 줄. 「✓ 답 채움」이 없으면 클립보드만 */
export const 채움말 = { 됨: "답 입력칸에 채웠습니다 — 읽고 「등록」을 눌러 주세요", 클립보드만: "입력칸을 못 찾아 클립보드에만 넣었습니다" };
export function 창결과(out) {
  const s = String(out ?? "");
  if (/^✓ 답 채움/m.test(s)) return { ok: true, 말: 채움말.됨 };
  if (/^✓ 클립보드/m.test(s)) return { ok: true, 말: 채움말.클립보드만 };
  return { ok: false, 말: (/^✗ (.+)$/m.exec(s)?.[1] ?? "창을 못 열었습니다").slice(0, 200) };
}
