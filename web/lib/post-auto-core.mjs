/**
 * 학원 주 1편 자동 글(Step 43) — 주제 고르기·재료 관문·출처 대조·발행·내리기의 판정을 한 곳에 둔다.
 * auto-post.mjs·company.mjs·fact-check.mjs·검토 화면(draft-actions.ts·drafts.ts)·현황판·아침 보고가 이 파일만 쓴다.
 *
 * 의존성 0 (node:crypto 는 내장). DB 는 q(sql, params) → rows 만 받는다 — repair-core 꼴.
 *
 * 원칙: 애매하면 안 나간다. 파싱 실패·근거가 창 밖·스위치 못 읽음은 전부 「안 됨」 쪽으로 떨어진다(D81·D89).
 */
import crypto from "node:crypto";

const 하루 = 86400000;
const sha1 = (s) => crypto.createHash("sha1").update(String(s)).digest("hex");

// ─────────────────────────────────────────── 날짜 (KST — 러너는 UTC, CLAUDE.md 함정)
export const KST날 = (t = Date.now()) => new Date(t).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
export const KST월일 = (t) => {
  const d = KST날(typeof t === "number" ? t : Date.parse(String(t)));
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
};
/** 이번 주 월요일 00:00 KST (ms) */
export function 주시작(now = Date.now()) {
  const k = new Date(now + 9 * 3600000);
  const 요일 = (k.getUTCDay() + 6) % 7; // 월=0
  return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - 요일) - 9 * 3600000;
}
const 주시작SQL = `(date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')`;

// ─────────────────────────────────────────── 주제
const 질문정규화 = (s) => String(s ?? "").replace(/[\s?？]/g, "");

/** 같은 주제를 두 번 쓰지 않게 하는 열쇠. 질문은 띄어쓰기·물음표를 지우고 본다 */
export function 주제키(c) {
  if (c?.bank) return `bank:${c.bank}`;
  if (c?.검색어) return `serp:${sha1(질문정규화(c.검색어)).slice(0, 10)}`;
  return `q:${sha1(질문정규화(c?.질문)).slice(0, 10)}`;
}

/**
 * 학원만 아는 사실(과정·모집·특강·반)을 요구하는 주제인가. 「교육과정」은 나라 교육과정이라 뺀다.
 * 「반」은 낱말 끝에 붙은 것만(주말반·방학반) — 일반·절반·반드시는 아니다
 */
export function 학원사실필요(제목, 분류 = "") {
  const t = `${분류} ${제목}`.replace(/교육과정/g, "");
  if (/과정|모집|특강/.test(t)) return true;
  return /(?<![일절])반(?=$|[^가-힣]|[을이은에도과와의])/.test(t);
}

/** topics.json season → 맞는 달. 대략이다 — 학사 일정이 바뀌면 여기만 고친다 */
export const 철 = { 학기초: [2, 3, 8, 9], 학기중: [4, 5, 6, 10, 11], 방학전: [6, 7, 11, 12], 영재원모집: [9, 10, 11], 대회시즌: [4, 5, 6, 7] };

/**
 * 네 신호를 모아 후보를 만든다(D83). 같은 열쇠는 한 후보로 합치고 점수를 더한다.
 *   A 안 불린 질문 30+엔진 수 · B 경쟁이 이기는 질문 25 · C 지는 검색어 20 · D 주제 은행 10(+철 5)
 * 신호 하나를 못 읽어도 나머지로 간다 — 못 읽은 것은 못읽음[] 에 남긴다(0건과 다르다)
 */
export async function 후보모으기(q, { client = 1, 은행 = [], now = Date.now() } = {}) {
  const 표 = new Map();
  const 못읽음 = [];
  const 더하기 = (키, 제목, 신호, 이유, 점수, 덧 = {}) => {
    const 있던 = 표.get(키);
    if (있던) {
      있던.점수 += 점수;
      if (!있던.신호.includes(신호)) 있던.신호.push(신호);
      있던.이유 = `${있던.이유} · ${이유}`;
      Object.assign(있던, { ...덧, ...있던 });
      return;
    }
    표.set(키, { 키, 제목, 신호: [신호], 이유, 점수, 학원사실필요: 학원사실필요(제목, 덧.분류 ?? ""), ...덧 });
  };

  try {
    const rows = await q(
      `select prompt_text, count(distinct engine)::int 엔진, max(measured_on)::text 날
         from academy.ai_measurements
        where client_id = $1 and measured_on >= ((now() at time zone 'Asia/Seoul')::date - 14)
          and coalesce(stage, '') <> 'brand' and coalesce(prompt_text, '') <> ''
        group by prompt_text
       having bool_or(coalesce(mentioned, false) or coalesce(cited, false)) = false`, [client]);
    for (const r of rows) {
      더하기(주제키({ 질문: r.prompt_text }), r.prompt_text, "A",
        `AI 답 ${r.엔진}곳 중 0곳이 우리를 안 부름(${KST월일(`${r.날}T12:00:00+09:00`)} 잼)`, 30 + Number(r.엔진 || 0));
    }
  } catch { 못읽음.push("AI 답 측정"); }

  try {
    const rows = await q(
      `select payload from geo.agent_tasks
        where client_id = $1 and kind = 'question-draft' and status in ('대기','관찰') and payload ? 'question'`, [client]);
    for (const r of rows) {
      const 질문 = String(r.payload?.question ?? "").trim();
      if (!질문) continue;
      const 곳 = Array.isArray(r.payload?.sources) ? r.payload.sources.map(String) : [];
      더하기(주제키({ 질문 }), 질문, "B",
        곳.length ? `경쟁 쪽 ${곳.length}곳이 대신 인용됨(${곳.slice(0, 3).join(", ")})` : "경쟁 쪽이 대신 인용됨", 25, { 경쟁출처: 곳 });
    }
  } catch { 못읽음.push("경쟁 질문 일감"); }

  try {
    // write-draft.mjs 의 지는 검색어 SQL 그대로 — 엔진 하나라도 잡혔으면 진 게 아니다
    const rows = await q(
      `select query from academy.serp_checks
        where client_id = $1 and kind = '경쟁' and checked_at > now() - interval '7 days'
        group by query having bool_or(hit) = false`, [client]);
    for (const r of rows) {
      더하기(주제키({ 검색어: r.query }), r.query, "C", `검색 「${r.query}」에서 7일 내내 안 보임`, 20);
    }
  } catch { 못읽음.push("검색 순위"); }

  const 달 = Number(KST날(now).slice(5, 7));
  for (const t of 은행 ?? []) {
    if (!t?.id || t.slug) continue;
    const 맞음 = (철[t.season] ?? []).includes(달);
    더하기(주제키({ bank: t.id }), t.title, "D", `주제 은행${맞음 ? ` · 지금 철(${t.season})` : ""}`, 10 + (맞음 ? 5 : 0),
      { 분류: t.category ?? "", 각도: t.angle ?? "", 태그: t.tags ?? [] });
  }
  const 후보 = [...표.values()].sort((a, b) => b.점수 - a.점수);
  return { 후보, 못읽음 };
}

export const STOP = new Set(["학원", "추천", "코딩", "초등", "교실"]);
/** 핵심 낱말 — 2자 이상, write-draft STOP 불용어 제외 */
export const 낱말 = (s) => [...new Set(String(s ?? "").split(/\s+/)
  .map((w) => w.replace(/[^가-힣a-zA-Z0-9]/g, "")).filter((w) => w.length >= 2 && !STOP.has(w)))];
/** 조사가 붙은 낱말도 같은 말로 본다(「대학」·「대학에」). 라틴 글자만인 말(AI)은 똑같을 때만 */
const 같은낱말 = (a, b) => {
  if (a === b) return true;
  const [짧, 긴] = a.length <= b.length ? [a, b] : [b, a];
  if (/^[A-Za-z0-9]+$/.test(짧)) return false;
  return 짧.length >= 2 && 긴.startsWith(짧);
};
const 제목정규화 = (s) => String(s ?? "").replace(/[^가-힣a-zA-Z0-9]/g, "").toLowerCase();

/**
 * 후보를 거른다(D83).
 *   기록     post_reviews [{topic_key, kind, at}]
 *   최근글   최근 28일 발행 글(내린 글 포함) [{title, tags, published_at}]
 *   모든제목 지금까지 발행한 글 제목
 */
export function 거르기(후보들, 기록 = [], 최근글 = [], { now = Date.now(), 모든제목 = [] } = {}) {
  const 남은것 = [];
  const 뺀것 = [];
  const 모든 = new Set(모든제목.map(제목정규화));
  for (const c of 후보들) {
    const 내것 = 기록.filter((r) => r.topic_key === c.키);
    const 지남 = (r) => now - Date.parse(String(r.at));
    if (내것.some((r) => r.kind === "발행")) { 뺀것.push({ 제목: c.제목, 왜: "이미 발행한 주제" }); continue; }
    const 버림 = 내것.find((r) => r.kind === "버림" && 지남(r) < 56 * 하루);
    if (버림) { 뺀것.push({ 제목: c.제목, 왜: `${KST월일(버림.at)} 3번 걸려 버린 주제 — 8주 뒤 다시 봄` }); continue; }
    const 부족 = 내것.find((r) => r.kind === "재료부족" && 지남(r) < 28 * 하루);
    if (부족) { 뺀것.push({ 제목: c.제목, 왜: `${KST월일(부족.at)} 재료가 모자라 미룸 — 4주 뒤 다시 봄` }); continue; }
    if (모든.has(제목정규화(c.제목))) { 뺀것.push({ 제목: c.제목, 왜: "같은 제목의 글이 이미 있음" }); continue; }
    const 내낱말 = 낱말(c.제목);
    let 겹침 = null;
    for (const p of 최근글) {
      const 그낱말 = 낱말(`${p.title} ${(p.tags ?? []).join(" ")}`);
      const 같은 = 내낱말.filter((w) => 그낱말.some((x) => 같은낱말(w, x)));
      if (같은.length >= 2) { 겹침 = { p, 같은 }; break; }
    }
    if (겹침) {
      const 제목 = String(겹침.p.title);
      뺀것.push({ 제목: c.제목, 왜: `${KST월일(겹침.p.published_at)} 「${제목.length > 18 ? `${제목.slice(0, 18)}…` : 제목}」 글과 겹침(${겹침.같은.slice(0, 3).join("·")})` });
      continue;
    }
    남은것.push(c);
  }
  return { 남은것, 뺀것 };
}

// ─────────────────────────────────────────── 재료 관문 (D84)
const 수업낱말 = /수업|대회|합격|커리큘럼/;

/**
 * 학원만 아는 사실의 근거는 DB 셋뿐 — 라벨을 붙여 쓰기에 넘긴다.
 *   m# academy.materials 안 쓴 것 · i# academy.inquiries said 비지 않은 것
 *   p# 원장 글(이관 글이거나 원장 승인 발행) 중 수업·대회·합격·커리큘럼 낱말 든 문단, 발행 연도를 붙여 최대 8개.
 *      내린 글(비공개이유)은 SQL 과 여기서 두 번 뺀다 — 9/28 옛 지점 글이 다시 근거가 되면 안 된다
 */
export async function 재료모으기(q, client = 1) {
  const m = (await q(
    `select id, kind, said, coalesce(context, '') context, day::text day from academy.materials
      where client_id = $1 and cardinality(used_in) = 0 order by day desc limit 12`, [client]))
    .map((r, i) => ({ 라벨: `m${i + 1}`, id: r.id, 원문: `${r.said}${r.context ? ` (${r.context})` : ""}`, 날: r.day }));
  const i = (await q(
    `select id, day::text day, said from academy.inquiries
      where client_id = $1 and coalesce(btrim(said), '') <> '' order by day desc limit 12`, [client]))
    .map((r, n) => ({ 라벨: `i${n + 1}`, id: r.id, 원문: r.said, 날: r.day }));
  const 글 = await q(
    `select p.slug, p.title, p.body, (coalesce(p.review_notes, '{}'::jsonb) ? '비공개이유') 내림,
            extract(year from coalesce(p.published_at, p.created_at) at time zone 'Asia/Seoul')::int 연도
       from academy.posts p
      where p.client_id = $1 and p.published
        and not (coalesce(p.review_notes, '{}'::jsonb) ? '비공개이유')
        and (p.source_url is not null
             or exists (select 1 from geo.agent_activity a where a.client_id = p.client_id and a.action = '원장 승인 발행'
                          and a.summary like '%(/blog/' || p.slug || ')%'))
      order by p.published_at desc nulls last`, [client]);
  const p = [];
  for (const r of 글) {
    if (r.내림) continue;
    for (const 문단 of String(r.body ?? "").replace(/\r/g, "").split(/\n{2,}/)) {
      const t = 문단.trim();
      if (!t || /^#{1,4}\s/.test(t) || /^!\[/.test(t) || !수업낱말.test(t)) continue;
      if (p.length >= 8) break;
      p.push({ 라벨: `p${p.length + 1}`, 원문: `(${r.연도}년 글 「${r.title}」) ${t}`, 연도: r.연도, slug: r.slug });
    }
  }
  return { m, i, p };
}

/** 이 후보를 무슨 글로 쓰나. 과정 글은 지금 재료(m·i)가 있어야 쓴다 — p# 만으로는 안 쓴다(옛 글은 옛 사실) */
export function 재료판정(후보, 라벨들) {
  const 지금재료 = (라벨들?.m?.length ?? 0) + (라벨들?.i?.length ?? 0);
  if (후보?.학원사실필요) {
    if (!지금재료) {
      return { 결과: "재료부족", 왜: 라벨들?.p?.length ? "원장 옛 글 문단만 있음 — 과정 글은 재료표·상담 말이 있어야 씀" : "재료표·상담 말이 하나도 없음" };
    }
    return { 결과: "재료", 왜: `재료 ${지금재료}개로 씀` };
  }
  return { 결과: "사실", 왜: "바깥 사실로 씀" };
}

/** 이번 주(KST) 발행된 글 또는 감수 중(주제 있음·미발행·내리지 않음) 초안 — 주 1편 확인(D88) */
export const 이번주글SQL = `select slug, published from academy.posts
  where client_id = $1 and (
    (published and published_at >= ${주시작SQL})
    or (not published and coalesce(review_notes, '{}'::jsonb) ? '주제' and not (coalesce(review_notes, '{}'::jsonb) ? '비공개이유')))`;

// ─────────────────────────────────────────── 출처 대조 (D85)
const 반각 = (s) => String(s ?? "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
/** 공백을 빼고, 숫자 사이 쉼표를 빼고, 전각 숫자를 반각으로. 자리[] = 접은 글 i 번째 글자의 원래 자리 */
export function 접기(s) {
  const src = 반각(s);
  let 글 = "";
  const 자리 = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (/\s/.test(c)) continue;
    if (c === "," && /\d/.test(src[i - 1] ?? "") && /\d/.test(src[i + 1] ?? "")) continue;
    글 += c;
    자리.push(i);
  }
  return { 글, 자리, src };
}
const 접은 = (s) => 접기(s).글;

const 고유끝 = /(?:대학교|대학|위원회|재단|전형|고시|방안|과정|대회|교과서|대|부|청|원|법)$/;
const 흔한말 = new Set(["시대", "세대", "기대", "반대", "최대", "상대", "전부", "일부", "내부", "외부", "공부", "학원", "지원", "인원",
  "정원", "회원", "병원", "모집인원", "가운데", "대부분", "방법", "어떤방법", "문법", "해법", "과정", "대회", "전형", "학부", "학원", "원", "부", "대", "청", "법"]);
const 조사떼기 = (w) => w.replace(/(?:으로부터|에서부터|에서는|에서도|에게서|으로는|으로도|이라는|이라고|으로|에서|에게|까지|부터|처럼|보다|이라|에는|에도|와의|과의|은|는|이|가|을|를|의|에|와|과|도|만|로)$/, "");
const 제도말 = /의무화|도입|신설|시행|폐지|개정|확대|축소|필수/g;

/** 숫자 토큰. 목록 번호·「n단계」·(n) 은 fact-check.mjs 규칙 그대로 뺀다 */
function 숫자들(문장) {
  const t = 반각(문장)
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^\s*\d+[.)]\s/, "")
    .replace(/\(\s*\d+\s*\)/g, "")
    .replace(/\d+\s*단계/g, "")
    .replace(/(\d),(?=\d{3})/g, "$1");
  return [...new Set(t.match(/\d+(?:\.\d+)?/g) ?? [])];
}
function 고유명사들(문장) {
  const 말 = [];
  for (const w of 반각(문장).replace(/\]\([^)]*\)/g, "]").match(/[가-힣]+/g) ?? []) {
    const x = 조사떼기(w);
    if (x.length >= 2 && 고유끝.test(x) && !흔한말.has(x)) 말.push(x);
  }
  for (const w of 문장.replace(/\]\([^)]*\)/g, "]").replace(/https?:\/\/\S+/g, " ").match(/\b[A-Z][A-Za-z0-9]+/g) ?? []) 말.push(w);
  return [...new Set(말)];
}

/** 본문 → 마크다운 블록(제목 줄은 제 블록으로 떼어 낸다) */
function 블록들(body) {
  const out = [];
  for (const b of String(body ?? "").replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = b.split("\n");
    if (lines.length > 1 && /^#{1,4}\s/.test(lines[0])) { out.push(lines[0], lines.slice(1).join("\n")); continue; }
    out.push(b);
  }
  return out.filter((x) => x.trim());
}
const 제목줄 = (b) => /^#{1,4}\s/.test(b.trim());
const 그림줄 = (b) => /^!\[[^\]]*\]\([^)]*\)$/.test(b.trim());
const 출처절 = (b) => /^#{1,4}\s*(?:출처|참고)\s*$/.test(b.trim());

/** 본문의 문장 — 제목·그림·출처 절은 뺀다. 문단 번호를 같이 준다 */
function 본문문장(body) {
  const out = [];
  let 출처안 = false;
  블록들(body).forEach((b, 문단) => {
    if (제목줄(b)) { 출처안 = 출처절(b); return; }
    if (출처안 || 그림줄(b)) return;
    for (const s of b.split(/(?<=[.!?…])\s+|\n+/).map((x) => x.trim()).filter(Boolean)) out.push({ 문장: s, 문단 });
  });
  return out;
}

/**
 * 문장별로 대조할 것을 뽑는다. 셋 다 비면 대상 아님.
 * 숫자만 있고 이름·제도어가 없는 문장(「2단계에서 70%에 면접 30%」)은 같은 문단 앞 문장의 이름·제도어를 빌린다 —
 * 무엇의 숫자인지가 앞 문장에 있다. 빌린 것은 창을 찾을 때만 쓴다
 */
export function 주장뽑기(body) {
  const out = [];
  const 문단말 = new Map();
  for (const { 문장, 문단 } of 본문문장(body)) {
    const 숫자 = 숫자들(문장);
    const 고유명사 = 고유명사들(문장);
    const 제도어 = [...new Set(문장.match(제도말) ?? [])];
    const 앞 = 문단말.get(문단) ?? { 고유명사: [], 제도어: [] };
    문단말.set(문단, { 고유명사: [...new Set([...앞.고유명사, ...고유명사])], 제도어: [...new Set([...앞.제도어, ...제도어])] });
    if (!숫자.length && !고유명사.length && !제도어.length) continue;
    const 빌림 = 숫자.length && !고유명사.length && !제도어.length ? 앞 : null;
    out.push({ 문장, 숫자, 고유명사, 제도어, ...(빌림 && (빌림.고유명사.length || 빌림.제도어.length) ? { 빌린말: 빌림 } : {}) });
  }
  return out;
}

const 숫자자리 = (글, n) => {
  const out = [];
  const re = new RegExp(`(?<![\\d.])${n.replace(/\./g, "\\.")}(?![\\d])`, "g");
  for (const m of 글.matchAll(re)) out.push(m.index);
  return out;
};
const 말자리 = (글, w) => {
  const out = [];
  const x = 접은(w);
  if (!x) return out;
  for (let i = 글.indexOf(x); i >= 0; i = 글.indexOf(x, i + 1)) out.push(i);
  return out;
};

/**
 * 원문에서 주장을 판정할 창을 찾는다(D85). 비교는 공백 무시.
 *   숫자 있음: 숫자 전부가 원문에 있고, 각 숫자 ±300자 안에 이름·제도어 중 하나 이상
 *   숫자 없음: 이름(있으면)과 제도어(있으면)가 한 창(±300자) 안에
 * 창은 최대 3개, 600자. 원래 글(공백 그대로)로 돌려준다
 */
export function 창찾기(원문, 주장) {
  const { 글, 자리, src } = 접기(원문);
  if (!글) return [];
  const 말 = [...(주장.고유명사 ?? []), ...(주장.제도어 ?? []), ...(주장.빌린말?.고유명사 ?? []), ...(주장.빌린말?.제도어 ?? [])];
  const 말위치 = [...new Set(말)].flatMap((w) => 말자리(글, w));
  const 가까이 = (pos) => 말위치.some((p) => Math.abs(p - pos) <= 300);
  const 중심들 = [];
  if (주장.숫자?.length) {
    for (const n of 주장.숫자) {
      const 맞는곳 = 숫자자리(글, n).filter(가까이);
      if (!맞는곳.length) return [];
      중심들.push(...맞는곳);
    }
  } else {
    const 이름 = 주장.고유명사 ?? [];
    const 제도 = 주장.제도어 ?? [];
    if (!이름.length && !제도.length) return [];
    const 기준 = (이름.length ? 이름 : 제도).flatMap((w) => 말자리(글, w));
    for (const pos of 기준) {
      const 안 = (ws) => !ws.length || ws.some((w) => 말자리(글, w).some((p) => Math.abs(p - pos) <= 300));
      if (안(이름) && 안(제도)) 중심들.push(pos);
    }
    if (!중심들.length) return [];
  }
  const 창 = [];
  for (const c of [...new Set(중심들)].sort((a, b) => a - b)) {
    if (창.length >= 3) break;
    if (창.some(([a, b]) => c >= a && c < b)) continue;
    const a = Math.max(0, c - 300);
    const b = Math.min(글.length, a + 600);
    창.push([a, b]);
  }
  return 창.map(([a, b]) => src.slice(자리[a], 자리[b - 1] + 1));
}

const 판정값 = new Set(["맞음", "다름", "없음"]);
/** 모델 답에서 JSON 을 꺼낸다. 못 꺼내면 null */
export function JSON꺼내기(text) {
  const t = String(text ?? "").replace(/```(?:json)?/g, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

/**
 * 출처 대조 판정 읽기. 대상 = [{id, 창들[]}] → Map(id → {판정, 근거, 왜?}).
 * 근거가 그 문장의 창 부분문자열(공백 무시)이 아니면 「없음」 — 판정 모델이 근거를 지어내면 여기서 떨어진다.
 * JSON 이 깨지면 전부 「없음」(fail-closed)
 */
export function 판정읽기(text, 대상) {
  const j = JSON꺼내기(text);
  const 줄들 = Array.isArray(j?.판정) ? j.판정 : null;
  const out = new Map();
  for (const d of 대상) {
    if (!줄들) { out.set(d.id, { 판정: "없음", 근거: "", 왜: "판정 답을 못 읽음" }); continue; }
    const r = 줄들.find((x) => String(x?.id) === String(d.id));
    const 판정 = 판정값.has(r?.판정) ? r.판정 : "없음";
    const 근거 = String(r?.근거 ?? "").trim();
    if (판정 === "없음") { out.set(d.id, { 판정, 근거: "", ...(r ? {} : { 왜: "판정이 빠짐" }) }); continue; }
    const k = 접은(근거);
    const 창안 = k.length >= 4 && d.창들.some((w) => 접은(w).includes(k));
    out.set(d.id, 창안 ? { 판정, 근거 } : { 판정: "없음", 근거: "", 왜: "근거가 원문에 없음" });
  }
  return out;
}

/**
 * 문장을 지운다. 지운 뒤 80자 안 되는 문단은 문단째, 빈 ## 절은 소제목째.
 * 첫 문단(제목·그림 아닌 첫 블록)이 통째로 사라지면 첫문단지움 — 글의 머리가 없어진 것이다
 */
export function 문장지우기(body, 문장들) {
  const 지울것 = [...new Set((문장들 ?? []).map(String).filter(Boolean))];
  if (!지울것.length) return { body, 지운것: [], 첫문단지움: false };
  const 블록 = 블록들(body).map((t) => ({ t, 바뀜: false, 지움: false }));
  const 첫 = 블록.findIndex((b) => !제목줄(b.t) && !그림줄(b.t));
  const 지운것 = [];
  for (const s of 지울것) {
    const b = 블록.find((x) => !x.지움 && !제목줄(x.t) && x.t.includes(s));
    if (!b) continue;
    b.t = b.t.replace(s, "").replace(/[ \t]{2,}/g, " ").replace(/^[ \t]+|[ \t]+$/gm, "").trim();
    b.바뀜 = true;
    지운것.push(s);
  }
  for (const b of 블록) {
    if (!b.바뀜) continue;
    if (b.t.length < 80) {
      if (b.t) 지운것.push(`(문단째) ${b.t}`);
      b.지움 = true;
    }
  }
  // 빈 절 — 다음 제목(또는 끝)까지 남은 블록이 없으면 소제목째
  for (let i = 0; i < 블록.length; i++) {
    if (블록[i].지움 || !제목줄(블록[i].t)) continue;
    let 있음 = false;
    for (let j = i + 1; j < 블록.length && !제목줄(블록[j].t); j++) if (!블록[j].지움) { 있음 = true; break; }
    if (!있음) { 블록[i].지움 = true; 지운것.push(`(빈 절 소제목) ${블록[i].t}`); }
  }
  return { body: 블록.filter((b) => !b.지움).map((b) => b.t).join("\n\n"), 지운것, 첫문단지움: 첫 >= 0 && 블록[첫].지움 };
}

/** 이미지 줄을 빼고 공백을 하나로 접은 본문의 sha1. 도해는 이미지 줄만 더하므로 해시가 안 바뀐다 */
export function 본문해시(body) {
  const t = String(body ?? "").replace(/\r/g, "").split("\n")
    .filter((l) => !/^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(l)).join("\n").replace(/\s+/g, " ").trim();
  return sha1(t);
}

/** 다듬기 결과를 받아도 되나 — 숫자(개수까지)·소제목·링크가 원문과 같고 길이가 0.9~1.15배. 안 되면 이유 */
export function 다듬기검사(전, 후) {
  const 숫자 = (s) => (String(s).match(/\d+/g) ?? []).sort().join(",");
  const 소제목 = (s) => (String(s).match(/^#{1,4}\s+.*$/gm) ?? []).map((x) => x.trim()).join("\n");
  const 링크 = (s) => (String(s).match(/\]\(([^)]+)\)/g) ?? []).sort().join("\n");
  if (!후 || 후.length < 전.length * 0.9 || 후.length > 전.length * 1.15) return `길이가 ${전.length}→${String(후 ?? "").length}자로 너무 바뀜`;
  if (숫자(후) !== 숫자(전)) return "숫자가 원문과 달라짐";
  if (소제목(후) !== 소제목(전) || 링크(후) !== 링크(전)) return "소제목이나 링크가 바뀜";
  return null;
}

/**
 * 감수 한 회차 뒤 무엇을 하나(D87).
 *   같은 KST 날 두 번째 → 미룸 · 한도·네트워크 → 미룸(회차 안 셈) · 통과 → 통과 · 실패 1·2회 → 내일다시 · 3회 → 버림
 */
export function 다음행동({ 회차 = 1, 결과, 오늘감수있음 = false } = {}) {
  if (오늘감수있음) return "미룸";
  if (결과 === "통과") return "통과";
  if (결과 !== "실패") return "미룸";
  return 회차 >= 3 ? "버림" : "내일다시";
}

/**
 * 원장 관점 감수 답 읽기(D81 c). 통과 = 본문에 있는 걸림 0 그리고 말리기 문장이 본문에 그대로 있음.
 * 본문에 없는 걸림 문장은 버리되 기록한다. JSON 이 깨지면 실패
 */
export function 관점읽기(text, body) {
  const j = JSON꺼내기(text);
  if (!j || !Array.isArray(j.걸림)) return { 통과: false, 걸림: [], 버린걸림: [], 말리기: "", 왜: "감수 답을 못 읽음" };
  const 본 = 접은(body);
  const 걸림 = [];
  const 버린걸림 = [];
  for (const g of j.걸림) {
    const 문장 = String(g?.문장 ?? "").trim();
    if (!문장) continue;
    (본.includes(접은(문장)) ? 걸림 : 버린걸림).push({ 문장, 종류: String(g?.종류 ?? "") });
  }
  const 말리기 = String(j.말리기 ?? "").trim();
  const 말리기있음 = 말리기.length >= 8 && 본.includes(접은(말리기));
  const 왜 = 걸림.length ? `광고로 읽힐 곳 ${걸림.length}곳(${[...new Set(걸림.map((g) => g.종류))].join("·")})`
    : !말리기있음 ? "「하지 말라」는 문장을 본문에서 못 댐" : "";
  return { 통과: !걸림.length && 말리기있음, 걸림, 버린걸림, 말리기, 왜 };
}

// ─────────────────────────────────────────── 화면·보고 한 줄
/**
 * post_reviews 행들 → 사람 말 한 줄(현황판 규칙: 로그 조각·영문 키·JSON 금지). 없으면 null.
 *   rows [{kind, slug, attempt, passed, why, at}] — 최근 것부터든 아니든 상관없다
 */
export function 글기록말(rows = [], now = Date.now()) {
  const 주 = 주시작(now);
  const 이번주 = rows.filter((r) => Date.parse(String(r.at)) >= 주).sort((a, b) => Date.parse(String(b.at)) - Date.parse(String(a.at)));
  const 최근 = (k) => 이번주.find((r) => r.kind === k);
  const 내림 = rows.filter((r) => r.kind === "내림" && now - Date.parse(String(r.at)) < 7 * 하루);
  const 덧 = 내림.length ? ` · 최근 7일 원장이 내린 글 ${내림.length}편` : "";
  const 못냄 = 최근("못냄");
  if (못냄) return `이번 주 못 냄 — ${못냄.why || "주제 2개 다 3번 걸림"}${덧}`;
  const 발행 = 최근("발행");
  if (발행) return `${KST월일(발행.at)} 자동 발행 — ${발행.why || "제목 기록 없음"}${덧}`;
  const 감수 = 최근("감수");
  const 버림 = 최근("버림");
  if (감수 && (!버림 || Date.parse(String(감수.at)) > Date.parse(String(버림.at)))) {
    return `이번 주 글: 감수 ${감수.attempt ?? "?"}/3회 — ${감수.passed ? "통과, 도해가 붙으면 나감" : 감수.why || "걸림"}${덧}`;
  }
  if (버림) return `이번 주 글: ${버림.why || "3번 걸려 버림"} — 다음 주제로${덧}`;
  const 고름 = 최근("고름");
  if (고름) return `이번 주 글: 주제 고름 — ${고름.why || "이유 기록 없음"}${덧}`;
  const 부족 = 이번주.filter((r) => r.kind === "재료부족");
  if (부족.length) return `이번 주 글: 주제 ${부족.length}개가 재료 부족으로 미뤄짐${덧}`;
  return 내림.length ? `최근 7일 원장이 내린 글 ${내림.length}편` : null;
}

/** 현황판·아침 보고용 — 최근 8일 post_reviews 를 읽어 한 줄. 표가 없거나 못 읽으면 null */
export async function 글기록읽기(q, client = 1) {
  try {
    const rows = await q(`select kind, slug, attempt, passed, why, at from academy.post_reviews
      where client_id = $1 and at > now() - interval '8 days' order by at desc limit 50`, [client]);
    return 글기록말(rows);
  } catch { return null; }
}

// ─────────────────────────────────────────── 발행·내리기 (D89·D91)
/** 기록 한 줄. 표가 아직 없어도 발행·내리기는 멈추지 않는다 */
export const 기록하기 = (q, r) => q(
  `insert into academy.post_reviews (client_id, slug, topic_key, kind, attempt, passed, stages, why)
   values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
  [r.client ?? 1, r.slug ?? null, r.topic_key, r.kind, r.attempt ?? null, r.passed ?? null, JSON.stringify(r.stages ?? {}), r.why ?? null]);

/** 스위치 — 'on' 이어야만 참. 못 읽으면 거짓(D89) */
export async function 자동발행켜짐(q) {
  try {
    const [r] = await q(`select value from geo.settings where key = 'post_auto_publish'`, []);
    return r?.value === "on";
  } catch { return false; }
}

/**
 * 발행해도 되나. 원장 버튼 조건(그림 있음·비공개이유 없음·본문 그림이 다 저장됨) 그대로.
 * 자동이면 더해서: 감수 통과 + 본문해시 일치 + 스위치 on. 아니면 {ok:false, 왜}
 */
export async function 발행가능(q, slug, { 자동 = false } = {}) {
  const [p] = await q(
    `select body, published, coalesce(review_notes, '{}'::jsonb) notes,
            position('![' in body) > 0 그림,
            coalesce(review_notes, '{}'::jsonb) ? '비공개이유' 내림,
            exists (select 1 from regexp_matches(body, '/blog/img/([^/)\\s]+)/([a-z0-9-]+)\\.svg', 'g') m
                     where not exists (select 1 from academy.post_images i where i.slug = m[1] and i.name = m[2])) 빠진그림
       from academy.posts where slug = $1`, [slug]);
  if (!p) return { ok: false, 왜: "글이 없음" };
  if (p.published) return { ok: false, 왜: "이미 발행됨" };
  if (p.내림) return { ok: false, 왜: "내린 글이라 다시 못 냄" };
  if (!p.그림) return { ok: false, 왜: "도해가 아직 없음" };
  if (p.빠진그림) return { ok: false, 왜: "본문 그림 중 저장 안 된 것이 있음" };
  if (!자동) return { ok: true, 왜: "" };
  const 감수 = p.notes?.감수;
  if (감수?.통과 !== true) return { ok: false, 왜: "자동 감수를 통과하지 않음" };
  if (본문해시(p.body) !== 감수.해시) return { ok: false, 왜: "감수 뒤 본문이 바뀜" };
  if (!(await 자동발행켜짐(q))) return { ok: false, 왜: "자동 발행 스위치가 꺼져 있거나 못 읽음" };
  return { ok: true, 왜: "" };
}

const 활동 = (q, clientId, action, summary, ok = true) => q(
  `insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1, 'content', $2, $3, $4)`,
  [clientId, action, ok, String(summary).slice(0, 1000)]).catch(() => {});

/**
 * 발행 — publishDraft 의 update + 알림 일감 + 검토 일감 완료 + 활동을 옮겨 왔다(D82).
 * 누가 '원장' = 원장 판단이 감수(자동 조건 안 봄) · '자동' = 부르기 전에 발행가능(자동) 을 봐야 한다
 * 자동 글(notes.주제)이면 post_reviews '발행' — 같은 주제를 다시 고르지 않는다
 */
export async function 발행(q, slug, { 누가 = "원장" } = {}) {
  const [p] = await q(
    `update academy.posts set published=true, published_at=now(), updated_at=now()
      where slug=$1 and not published and position('![' in body) > 0
        and not (coalesce(review_notes, '{}'::jsonb) ? '비공개이유')
        and not exists (select 1 from regexp_matches(body, '/blog/img/([^/)\\s]+)/([a-z0-9-]+)\\.svg', 'g') m
                         where not exists (select 1 from academy.post_images i where i.slug = m[1] and i.name = m[2]))
      returning client_id, title, review_notes->'주제'->>'키' 주제키`, [slug]);
  if (!p) return { ok: false };
  const 자동 = 누가 === "자동";
  // sticky: 정찰 같은 신호에서 나온 일이 아니다. 없으면 회사 루프가 「신호 사라짐」으로 바로 닫는다
  await q(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority)
     values ($1, 'deliver', 'announce', $2, $3, $4, $5::jsonb, 20)
     on conflict (client_id, dedupe_key) do update set status='대기', attempts=0, next_try_at=now(), updated_at=now(),
       payload = geo.agent_tasks.payload || excluded.payload`,
    [p.client_id, `announce-${slug}`, `새 글 알리기: ${p.title}`,
      자동 ? "자동 감수를 통과해 발행한 글을 검색엔진에 알리고 네이버 이관·구글 색인 요청을 잡습니다."
        : "원장이 사실 확인 후 발행한 글을 검색엔진에 알리고 네이버 이관·구글 색인 요청을 잡습니다.",
      JSON.stringify({ slug, sticky: true })],
  ).catch((e) => 활동(q, p.client_id, "발행 알림 일감 만들기 실패", String(e), false));
  await q(
    `update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = evidence || $3
      where client_id=$1 and dedupe_key=$2 and status <> '완료'`,
    [p.client_id, `review-${slug}`, 자동 ? "\n자동 감수 통과 발행" : "\n원장 확인 후 발행"],
  ).catch(() => {});
  await 활동(q, p.client_id, 자동 ? "자동 감수 통과 발행" : "원장 승인 발행", `${p.title} (/blog/${slug})`);
  if (p.주제키) {
    await 기록하기(q, { client: p.client_id, slug, topic_key: p.주제키, kind: "발행", passed: true, why: `「${p.title}」${자동 ? "" : " (원장 버튼)"}` })
      .catch(() => {});
  }
  return { ok: true, title: p.title, clientId: p.client_id };
}

/**
 * 내리기(D91) — published=false + 비공개이유(재발행 차단 장치 재사용) + post_reviews '내림' + 활동
 * + 색인 알림 일감(announce-removal) + 네이버 글이 있으면 사람 일감(로그인이 필요해 자동으로 못 지운다)
 */
export async function 내리기(q, slug, { 이유 = "", 블로그 = "force11", now = Date.now() } = {}) {
  const 말 = `원장 내림 ${KST월일(now)}: ${String(이유).trim().slice(0, 200) || "이유 안 적음"}`;
  const [p] = await q(
    `update academy.posts set published=false, updated_at=now(),
            review_notes = coalesce(review_notes, '{}'::jsonb) || jsonb_build_object('비공개이유', $2::text)
      where slug=$1 and published
      returning client_id, title, naver_log_no, coalesce(review_notes->'주제'->>'키', '') 주제키`, [slug, 말]);
  if (!p) return { ok: false };
  await 기록하기(q, { client: p.client_id, slug, topic_key: p.주제키 || `slug:${slug}`, kind: "내림", why: 말 }).catch(() => {});
  await 활동(q, p.client_id, "원장 내림", `${p.title} (/blog/${slug}) — ${말}`);
  await q(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority)
     values ($1, 'deliver', 'announce-removal', $2, $3, '내린 글 주소를 검색엔진에 다시 알려 목록에서 빠지게 합니다.', $4::jsonb, 20)
     on conflict (client_id, dedupe_key) do update set status='대기', attempts=0, next_try_at=now(), updated_at=now(),
       payload = geo.agent_tasks.payload || excluded.payload`,
    [p.client_id, `announce-removal-${slug}`, `내린 글 알리기: ${p.title}`, JSON.stringify({ slug, sticky: true })],
  ).catch((e) => 활동(q, p.client_id, "내린 글 알림 일감 만들기 실패", String(e), false));
  if (p.naver_log_no) {
    await q(
      `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority, status, link)
       values ($1, 'deliver', 'human', $2, $3, '사이트에서는 내렸습니다. 네이버 블로그 글은 로그인이 필요해 직접 비공개로 돌리거나 지워 주세요.', $4::jsonb, 15, '사람 대기', $5)
       on conflict (client_id, dedupe_key) do update set status='사람 대기', updated_at=now(), link=excluded.link`,
      [p.client_id, `naver-remove-${slug}`, `네이버 글도 내려 주세요: ${p.title}`, JSON.stringify({ slug, sticky: true }),
        `https://blog.naver.com/${블로그}/${p.naver_log_no}`],
    ).catch((e) => 활동(q, p.client_id, "네이버 내리기 일감 만들기 실패", String(e), false));
  }
  return { ok: true, title: p.title };
}

/**
 * 3회차 실패 — 버린다(D87). 버린 이유를 남기고, 초안·도해를 지우고, 재료를 돌려주고, 기록한다.
 * 지우기 전에 이유를 남긴다 — 지운 뒤에는 본문을 못 읽는다(discardDraft 와 같은 순서)
 */
export async function 버리기(q, slug, { 왜 = "" } = {}) {
  const [p] = await q(`select client_id, title, body, coalesce(review_notes->'주제'->>'키', '') 주제키 from academy.posts where slug=$1 and not published`, [slug]);
  if (!p) return { ok: false };
  await q(
    `insert into academy.draft_feedback (client_id, slug, title, reasons, note, excerpt) values ($1, $2, $3, $4::text[], $5, $6)`,
    [p.client_id, slug, p.title, ["자동 감수 3회 실패"], String(왜).slice(0, 300), String(p.body ?? "").slice(0, 600)]).catch(() => {});
  const 지움 = await q(`delete from academy.posts where slug=$1 and not published returning slug`, [slug]);
  if (!지움.length) return { ok: false };
  await q(`delete from academy.post_images where slug=$1`, [slug]).catch(() => {});
  await q(`update academy.materials set used_in = array_remove(used_in, $1) where $1 = any(used_in)`, [slug]).catch(() => {});
  await q(
    `update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence = evidence || '\n자동 감수 3회 실패로 버림'
      where client_id=$1 and dedupe_key = any($2)`,
    [p.client_id, [`review-${slug}`, `illustrate-${slug}`, `illustrate-human-${slug}`]]).catch(() => {});
  await 기록하기(q, { client: p.client_id, slug, topic_key: p.주제키 || `slug:${slug}`, kind: "버림", passed: false, why: `「${p.title}」 3번 걸려 버림 — ${왜}` }).catch(() => {});
  await 활동(q, p.client_id, "자동 글 버림", `${p.title} — ${왜}`);
  return { ok: true, title: p.title };
}
